// SPDX-License-Identifier: AGPL-3.0-or-later

import {createHash, randomUUID} from 'node:crypto';
import type {GuildID, UserID} from '@app/api/BrandedTypes';
import {executeConditional, fetchMany, fetchOne, upsertOne} from '@app/api/database/CassandraQueryExecution';
import {defineTable} from '@app/api/database/CassandraTableDsl';
import {Db, type PreparedQuery} from '@app/api/database/CassandraTypes';
import {Logger} from '@app/api/Logger';
import {getWorkerService} from '@app/api/middleware/ServiceRegistry';
import {eventLogStopped, eventLogSupported} from '@app/api/netrcol/EventLogRepository';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {ConflictError} from '@fluxer/errors/src/domains/core/ConflictError';
import {
	AutomaticRoleHistoryEntry,
	AutomaticRoleSettings,
	defaultAutomaticRoleSettings,
} from '@fluxer/schema/src/domains/guild/GuildAutomaticRoleSchemas';

interface AutomaticRoleRecord {
	guild_id: GuildID;
	key: string;
	value: string;
	version: number;
}
export const AutomaticRoleRecords = defineTable<AutomaticRoleRecord, 'guild_id' | 'key', 'guild_id'>({
	name: 'netrcol_automatic_role_records',
	columns: ['guild_id', 'key', 'value', 'version'],
	primaryKey: ['guild_id', 'key'],
	partitionKey: ['guild_id'],
});
export interface AutomaticRoleConfig {
	settings: AutomaticRoleSettings;
	approved_by: string;
	revision: number;
}
export interface AutomaticRoleJob {
	id: string;
	guild_id: string;
	user_id: string;
	joined_at: number;
	occurred_at: number;
	revision: number;
	approved_by: string;
	role_ids: Array<string>;
	completed_roles: Array<string>;
	status: 'pending' | 'running' | 'done';
	attempts: number;
	lease: string;
	lease_until: number;
	next_attempt_at: number;
	outcome?: AutomaticRoleHistoryEntry['reason'];
	result?: AutomaticRoleHistoryEntry['status'];
}
interface QueueRow {
	queue: string;
	id: string;
	guild_id: GuildID;
	value: string;
	version: number;
}
export const AutomaticRoleQueue = defineTable<QueueRow, 'queue' | 'id', 'queue'>({
	name: 'netrcol_automatic_role_queue',
	columns: ['queue', 'id', 'guild_id', 'value', 'version'],
	primaryKey: ['queue', 'id'],
	partitionKey: ['queue'],
});
const RETENTION = 7 * 86400;
export const automaticRoleKey = (source: string) => createHash('sha256').update(source).digest('hex');
export class AutomaticRoleRepository {
	async record(guildId: GuildID, key: string) {
		return fetchOne<AutomaticRoleRecord>(
			AutomaticRoleRecords.select({
				where: [AutomaticRoleRecords.where.eq('guild_id'), AutomaticRoleRecords.where.eq('key')],
			}).bind({
				guild_id: guildId,
				key,
			}),
		);
	}
	async config(guildId: GuildID): Promise<AutomaticRoleConfig> {
		const row = await this.record(guildId, 'config');
		if (!row) return {settings: defaultAutomaticRoleSettings(), approved_by: '', revision: 0};
		const stored = JSON.parse(row.value);
		return {
			settings: AutomaticRoleSettings.parse(stored.settings),
			approved_by: stored.approved_by,
			revision: row.version,
		};
	}
	async save(guildId: GuildID, userId: UserID, settings: AutomaticRoleSettings, revision: number) {
		const row = {
			guild_id: guildId,
			key: 'config',
			value: JSON.stringify({settings, approved_by: userId.toString()}),
			version: revision + 1,
		};
		const applied = await executeConditional(
			AutomaticRoleRecords.conditionalBatch([
				revision === 0
					? {action: 'insert', row}
					: {
							action: 'patch',
							pk: {guild_id: guildId, key: 'config'},
							patch: {value: Db.set(row.value), version: Db.set(row.version)},
							expected: {version: revision},
						},
				{
					action: 'insert',
					row: {
						guild_id: guildId,
						key: `history:${String(Date.now()).padStart(16, '0')}:${randomUUID()}`,
						value: JSON.stringify({
							id: randomUUID(),
							user_id: null,
							role_ids: [],
							reason: 'none',
							actor_id: userId.toString(),
							status: 'saved',
							at: Date.now(),
						}),
						version: 1,
					},
					ttlSeconds: 90 * 86400,
				},
			]),
		);
		if (!applied)
			throw new ConflictError({
				code: APIErrorCodes.CONFLICT,
				message: 'AutomaticRole settings changed. Reload before saving.',
			});
	}
	async prepare(guildId: GuildID, userId: UserID, joinedAt: Date): Promise<Array<PreparedQuery>> {
		if (!eventLogSupported() || eventLogStopped()) return [];
		const config = await this.config(guildId);
		if (!config.settings.enabled) return [];
		const id = automaticRoleKey(`join:${guildId}:${userId}:${joinedAt.getTime()}`);
		if (await this.record(guildId, `completed:${id}`)) return [];
		const job: AutomaticRoleJob = {
			id,
			guild_id: String(guildId),
			user_id: String(userId),
			joined_at: joinedAt.getTime(),
			occurred_at: Date.now(),
			revision: config.revision,
			approved_by: config.approved_by,
			role_ids: [],
			completed_roles: [],
			status: 'pending',
			attempts: 0,
			lease: '',
			lease_until: 0,
			next_attempt_at: Date.now() + config.settings.delay_seconds * 1000,
		};
		const query = AutomaticRoleQueue.insertIfNotExistsWithTtl(
			{queue: 'events', id, guild_id: guildId, value: JSON.stringify(job), version: 1},
			RETENTION,
		);
		return [
			{
				...query,
				cql: query.cql.replace(/\s+IF NOT EXISTS/i, ''),
				kvMeta: {...query.kvMeta!, ifNotExists: false, ignoreConflict: true},
				afterCommit: () => {
					void getWorkerService()
						.addJob('processAutomaticRoles', {ids: [id]}, {skipLedger: true})
						.catch((err) => Logger.warn({err}, 'Automatic role wake-up failed; recovery sweep will retry'));
				},
			},
		];
	}
	async pending(after?: string, ids?: Array<string>) {
		return fetchMany<QueueRow>(
			AutomaticRoleQueue.select({
				where: [
					AutomaticRoleQueue.where.eq('queue'),
					...(ids ? [AutomaticRoleQueue.where.in('id', 'ids')] : after ? [AutomaticRoleQueue.where.gt('id')] : []),
				],
				orderBy: {col: 'id', direction: 'ASC'},
				limit: 50,
			}).bind({queue: 'events', ...(after ? {id: after} : {}), ...(ids ? {ids} : {})}),
		);
	}
	async update(row: QueueRow, job: AutomaticRoleJob) {
		const applied = await executeConditional(
			AutomaticRoleQueue.conditionalPatchByPk(
				{queue: row.queue, id: row.id},
				{value: Db.set(JSON.stringify(job)), version: Db.set(row.version + 1)},
				{version: row.version},
			),
		);
		if (applied) {
			row.value = JSON.stringify(job);
			row.version++;
		}
		return applied;
	}
	async ownsLease(row: QueueRow, job: AutomaticRoleJob) {
		const current = await fetchOne<QueueRow>(
			AutomaticRoleQueue.select({
				where: [AutomaticRoleQueue.where.eq('queue'), AutomaticRoleQueue.where.eq('id')],
			}).bind({
				queue: row.queue,
				id: row.id,
			}),
		);
		if (!current || current.version !== row.version) return false;
		const active = JSON.parse(current.value) as AutomaticRoleJob;
		return active.status === 'running' && active.lease === job.lease && active.lease_until > Date.now();
	}
	async claim(row: QueueRow) {
		const job = JSON.parse(row.value) as AutomaticRoleJob;
		if (job.status === 'done') return job;
		if (job.next_attempt_at > Date.now() || job.lease_until > Date.now()) return null;
		const next: AutomaticRoleJob = {
			...job,
			status: 'running',
			attempts: job.attempts + 1,
			lease: randomUUID(),
			lease_until: Date.now() + 60000,
		};
		return (await this.update(row, next)) ? next : null;
	}
	async history(guildId: GuildID) {
		const rows = await fetchMany<AutomaticRoleRecord>(
			AutomaticRoleRecords.select({
				where: [
					AutomaticRoleRecords.where.eq('guild_id'),
					AutomaticRoleRecords.where.gte('key', 'start'),
					AutomaticRoleRecords.where.lt('key', 'end'),
				],
				orderBy: {col: 'key', direction: 'DESC'},
				limit: 50,
			}).bind({guild_id: guildId, start: 'history:', end: 'history;'}),
		);
		return rows.map((row) => AutomaticRoleHistoryEntry.parse(JSON.parse(row.value)));
	}
	async finish(
		guildId: GuildID,
		row: QueueRow,
		job: AutomaticRoleJob,
		status: AutomaticRoleHistoryEntry['status'],
		reason: AutomaticRoleHistoryEntry['reason'] = 'none',
	) {
		const terminal: AutomaticRoleJob = {
			...job,
			status: 'done',
			outcome: job.outcome ?? reason,
			result: job.result ?? status,
		};
		if (job.status !== 'done' && !(await this.update(row, terminal))) return;
		await upsertOne(
			AutomaticRoleRecords.insertWithTtl(
				{
					guild_id: guildId,
					key: `history:${String(job.occurred_at).padStart(16, '0')}:${job.id}`,
					value: JSON.stringify({
						id: job.id,
						actor_id: '0',
						user_id: job.user_id,
						role_ids: job.completed_roles,
						status: terminal.result,
						reason: terminal.outcome,
						at: job.occurred_at,
					}),
					version: 1,
				},
				30 * 86400,
			),
		);
		await upsertOne(
			AutomaticRoleRecords.insertWithTtl(
				{guild_id: guildId, key: `completed:${job.id}`, value: terminal.outcome ?? reason, version: 1},
				RETENTION,
			),
		);
		await executeConditional(
			AutomaticRoleQueue.conditionalDeleteByPk({queue: row.queue, id: row.id}, {version: row.version}),
		);
	}
}
