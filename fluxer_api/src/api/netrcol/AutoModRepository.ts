// SPDX-License-Identifier: AGPL-3.0-or-later

import {createHash, randomUUID} from 'node:crypto';
import type {GuildID, UserID} from '@app/api/BrandedTypes';
import {executeConditional, fetchMany, fetchOne, upsertOne} from '@app/api/database/CassandraQueryExecution';
import {defineTable} from '@app/api/database/CassandraTableDsl';
import {Db, type PreparedQuery} from '@app/api/database/CassandraTypes';
import {Logger} from '@app/api/Logger';
import {getWorkerService} from '@app/api/middleware/ServiceRegistry';
import type {AutoModInput, AutoModSample} from '@app/api/netrcol/AutoModEngine';
import {eventLogStopped, eventLogSupported} from '@app/api/netrcol/EventLogRepository';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {
	AUTO_MOD_MAX_WINDOW_SECONDS,
	type AutoModAction,
	type AutoModRuleId,
} from '@fluxer/constants/src/AutoModConstants';
import {ConflictError} from '@fluxer/errors/src/domains/core/ConflictError';
import {
	AutoModHistoryEntry,
	AutoModSettings,
	defaultAutoModSettings,
} from '@fluxer/schema/src/domains/guild/GuildAutoModSchemas';

interface AutoModRecord {
	guild_id: GuildID;
	key: string;
	value: string;
	version: number;
}
export const AutoModRecords = defineTable<AutoModRecord, 'guild_id' | 'key', 'guild_id'>({
	name: 'netrcol_auto_mod_records',
	columns: ['guild_id', 'key', 'value', 'version'],
	primaryKey: ['guild_id', 'key'],
	partitionKey: ['guild_id'],
});
export interface AutoModConfig {
	settings: AutoModSettings;
	approved_by: string;
	revision: number;
}
export interface AutoModJob extends AutoModInput {
	revision: number;
	approved_by: string;
	rules?: Array<AutoModRuleId>;
	status: 'pending' | 'running' | 'done';
	attempts: number;
	lease: string;
	lease_until: number;
	next_attempt_at: number;
	warning_id: string | null;
	outcome?: string;
	actions?: Array<AutoModAction>;
}
interface QueueRow {
	queue: string;
	id: string;
	guild_id: GuildID;
	value: string;
	version: number;
}
export const AutoModQueue = defineTable<QueueRow, 'queue' | 'id', 'queue'>({
	name: 'netrcol_auto_mod_queue',
	columns: ['queue', 'id', 'guild_id', 'value', 'version'],
	primaryKey: ['queue', 'id'],
	partitionKey: ['queue'],
});
const RETENTION = 7 * 86400;
export const autoModKey = (source: string) => createHash('sha256').update(source).digest('hex');
export class AutoModRepository {
	async record(guildId: GuildID, key: string) {
		return fetchOne<AutoModRecord>(
			AutoModRecords.select({where: [AutoModRecords.where.eq('guild_id'), AutoModRecords.where.eq('key')]}).bind({
				guild_id: guildId,
				key,
			}),
		);
	}
	async config(guildId: GuildID): Promise<AutoModConfig> {
		const row = await this.record(guildId, 'config');
		if (!row) return {settings: defaultAutoModSettings(), approved_by: '', revision: 0};
		const stored = JSON.parse(row.value);
		return {settings: AutoModSettings.parse(stored.settings), approved_by: stored.approved_by, revision: row.version};
	}
	async save(guildId: GuildID, userId: UserID, settings: AutoModSettings, revision: number) {
		const row = {
			guild_id: guildId,
			key: 'config',
			value: JSON.stringify({settings, approved_by: userId.toString()}),
			version: revision + 1,
		};
		const applied = await executeConditional(
			AutoModRecords.conditionalBatch([
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
							rule: null,
							actor_id: userId.toString(),
							status: 'saved',
							at: Date.now(),
							action: 'config',
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
				message: 'AutoMod settings changed. Reload before saving.',
			});
	}
	async prepare(guildId: GuildID, input: AutoModInput): Promise<Array<PreparedQuery>> {
		if (!eventLogSupported() || eventLogStopped()) return [];
		const config = await this.config(guildId);
		if (!config.settings.enabled || !Object.values(config.settings.rules).some((rule) => rule.action !== 'disabled'))
			return [];
		if (await this.record(guildId, `completed:${input.id}`)) return [];
		const job: AutoModJob = {
			...input,
			revision: config.revision,
			approved_by: config.approved_by,
			status: 'pending',
			attempts: 0,
			lease: '',
			lease_until: 0,
			next_attempt_at: 0,
			warning_id: null,
		};
		const query = AutoModQueue.insertIfNotExistsWithTtl(
			{queue: 'events', id: input.id, guild_id: guildId, value: JSON.stringify(job), version: 1},
			RETENTION,
		);
		return [
			{
				...query,
				cql: query.cql.replace(/\s+IF NOT EXISTS/i, ''),
				kvMeta: {...query.kvMeta!, ifNotExists: false, ignoreConflict: true},
				afterCommit: () => {
					void getWorkerService()
						.addJob('processAutoMod', {ids: [input.id]}, {skipLedger: true})
						.catch((err) => Logger.warn({err}, 'AutoMod wake-up failed; recovery sweep will retry'));
				},
			},
		];
	}
	async pending(after?: string, ids?: Array<string>) {
		return fetchMany<QueueRow>(
			AutoModQueue.select({
				where: [
					AutoModQueue.where.eq('queue'),
					...(ids ? [AutoModQueue.where.in('id', 'ids')] : after ? [AutoModQueue.where.gt('id')] : []),
				],
				orderBy: {col: 'id', direction: 'ASC'},
				limit: 50,
			}).bind({queue: 'events', ...(after ? {id: after} : {}), ...(ids ? {ids} : {})}),
		);
	}
	async update(row: QueueRow, job: AutoModJob) {
		const applied = await executeConditional(
			AutoModQueue.conditionalPatchByPk(
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
	async ownsLease(row: QueueRow, job: AutoModJob) {
		const current = await fetchOne<QueueRow>(
			AutoModQueue.select({where: [AutoModQueue.where.eq('queue'), AutoModQueue.where.eq('id')]}).bind({
				queue: row.queue,
				id: row.id,
			}),
		);
		if (!current || current.version !== row.version) return false;
		const active = JSON.parse(current.value) as AutoModJob;
		return active.status === 'running' && active.lease === job.lease && active.lease_until > Date.now();
	}
	async claim(row: QueueRow) {
		const job = JSON.parse(row.value) as AutoModJob;
		if (job.status === 'done') return job;
		if (job.next_attempt_at > Date.now() || job.lease_until > Date.now()) return null;
		const next: AutoModJob = {
			...job,
			status: 'running',
			attempts: job.attempts + 1,
			lease: randomUUID(),
			lease_until: Date.now() + 60000,
		};
		return (await this.update(row, next)) ? next : null;
	}
	async sample(guildId: GuildID, key: string, sample: AutoModSample): Promise<Array<AutoModSample>> {
		for (let retry = 0; retry < 20; retry++) {
			const row = await this.record(guildId, key);
			const stored = row ? (JSON.parse(row.value) as Array<AutoModSample>) : [];
			if (stored.some((s) => s.id === sample.id)) return stored;
			const entries = [
				...stored.filter((s) => s.at > Math.max(Date.now(), sample.at) - AUTO_MOD_MAX_WINDOW_SECONDS * 1000),
				sample,
			]
				.sort((a, b) => a.at - b.at)
				.slice(-1000);
			const next = {guild_id: guildId, key, value: JSON.stringify(entries), version: (row?.version ?? 0) + 1};
			const applied = row
				? await executeConditional(
						AutoModRecords.conditionalPatchByPkWithTtl(
							{guild_id: guildId, key},
							{value: Db.set(next.value), version: Db.set(next.version)},
							{version: row.version},
							600,
						),
					)
				: await executeConditional(AutoModRecords.insertIfNotExistsWithTtl(next, 600));
			if (applied) return entries;
		}
		throw new Error('AutoMod counter contention');
	}
	async hold(guildId: GuildID, key: string, until: number, config: AutoModConfig) {
		for (let retry = 0; retry < 20; retry++) {
			const row = await this.record(guildId, key);
			const stored = row ? JSON.parse(row.value) : null;
			if (stored?.revision > config.revision) return;
			if (stored?.revision === config.revision && stored.approved_by === config.approved_by && stored.until >= until)
				return;
			const next = {
				guild_id: guildId,
				key,
				value: JSON.stringify({until, revision: config.revision, approved_by: config.approved_by}),
				version: (row?.version ?? 0) + 1,
			};
			const ttl = Math.max(1, Math.ceil((until - Date.now()) / 1000));
			const applied = row
				? await executeConditional(
						AutoModRecords.conditionalPatchByPkWithTtl(
							{guild_id: guildId, key},
							{value: Db.set(next.value), version: Db.set(next.version)},
							{version: row.version},
							ttl,
						),
					)
				: await executeConditional(AutoModRecords.insertIfNotExistsWithTtl(next, ttl));
			if (applied) return;
		}
		throw new Error('AutoMod hold contention');
	}
	async holdUntil(guildId: GuildID, key: string, config: AutoModConfig) {
		const row = await this.record(guildId, key);
		if (!row) return 0;
		const value = JSON.parse(row.value);
		return value.revision === config.revision && value.approved_by === config.approved_by ? (value.until as number) : 0;
	}
	async history(guildId: GuildID) {
		const rows = await fetchMany<AutoModRecord>(
			AutoModRecords.select({
				where: [
					AutoModRecords.where.eq('guild_id'),
					AutoModRecords.where.gte('key', 'start'),
					AutoModRecords.where.lt('key', 'end'),
				],
				orderBy: {col: 'key', direction: 'DESC'},
				limit: 50,
			}).bind({guild_id: guildId, start: 'history:', end: 'history;'}),
		);
		return rows.map((row) => AutoModHistoryEntry.parse(JSON.parse(row.value)));
	}
	async finish(guildId: GuildID, row: QueueRow, job: AutoModJob, status: string) {
		// Persist completion before history; a recovered terminal job reconciles both before queue removal.
		const terminal: AutoModJob = {...job, status: 'done', content: '', outcome: job.outcome ?? status};
		if (job.status !== 'done' && !(await this.update(row, terminal))) return;
		if (job.rules?.length || status === 'failed')
			await upsertOne(
				AutoModRecords.insertWithTtl(
					{
						guild_id: guildId,
						key: `history:${String(job.occurred_at).padStart(16, '0')}:${job.id}`,
						value: JSON.stringify({
							id: job.id,
							rules: job.rules ?? [],
							actions: job.actions ?? [],
							actor_id: job.user_id,
							channel_id: job.channel_id,
							status: terminal.outcome,
							at: job.occurred_at,
						}),
						version: 1,
					},
					30 * 86400,
				),
			);
		await upsertOne(
			AutoModRecords.insertWithTtl(
				{guild_id: guildId, key: `completed:${job.id}`, value: terminal.outcome ?? status, version: 1},
				RETENTION,
			),
		);
		await executeConditional(
			AutoModQueue.conditionalDeleteByPk({queue: row.queue, id: row.id}, {version: row.version}),
		);
	}
}
