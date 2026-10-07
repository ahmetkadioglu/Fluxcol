// SPDX-License-Identifier: AGPL-3.0-or-later

import {createHash, randomUUID} from 'node:crypto';
import type {ChannelID, GuildID, UserID} from '@app/api/BrandedTypes';
import {createChannelID, createUserID} from '@app/api/BrandedTypes';
import {Config} from '@app/api/Config';
import {
	BatchBuilder,
	executeConditional,
	fetchMany,
	fetchOne,
	upsertOne,
} from '@app/api/database/CassandraQueryExecution';
import {defineTable} from '@app/api/database/CassandraTableDsl';
import {Db, type PreparedQuery} from '@app/api/database/CassandraTypes';
import type {ISnowflakeService} from '@app/api/infrastructure/ISnowflakeService';
import {getSnowflakeService} from '@app/api/middleware/ServiceRegistry';
import {
	ApplicationSettingsRecords as EventLogRecords,
	type GuildRecord,
} from '@app/api/netrcol/ApplicationSettingsRecords';
import {eventLogContext} from '@app/api/netrcol/EventLogContext';
import {eventLogWakeup} from '@app/api/netrcol/EventLogWakeup';
import {ModuleSettingsRepository} from '@app/api/netrcol/ModuleSettingsRepository';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {eventLogAvailable, eventLogChannel} from '@fluxer/constants/src/EventLogConstants';
import {ConflictError} from '@fluxer/errors/src/domains/core/ConflictError';
import {
	type EventLogEvent,
	EventLogHistoryEntry,
	EventLogPayload,
	EventLogSettings,
} from '@fluxer/schema/src/domains/guild/GuildEventLogSchemas';

export {EventLogRecords};
export interface EventLogConfig {
	settings: EventLogSettings;
	approved_by: string;
	revision: number;
}
export interface EventLogDelivery {
	queue: string;
	event_id: bigint;
	guild_id: GuildID;
	subject_id: UserID;
	channel_id: ChannelID;
	approved_by: string;
	revision: number;
	kind: EventLogEvent | 'test';
	language: string;
	occurred_at: number;
	status: string;
	attempts: number;
	lease_token: string;
	lease_until: number;
	next_attempt_at: number;
	terminal_reason: EventLogHistoryEntry['reason'];
	payload?: string;
	source_id?: string;
}
export const EventLogOutbox = defineTable<EventLogDelivery, 'queue' | 'event_id', 'queue'>({
	name: 'netrcol_event_log_outbox',
	columns: [
		'queue',
		'event_id',
		'guild_id',
		'subject_id',
		'channel_id',
		'approved_by',
		'revision',
		'kind',
		'language',
		'occurred_at',
		'status',
		'attempts',
		'lease_token',
		'lease_until',
		'next_attempt_at',
		'terminal_reason',
		'payload',
		'source_id',
	],
	primaryKey: ['queue', 'event_id'],
	partitionKey: ['queue'],
});
export const EVENT_LOG_RETENTION_SECONDS = 30 * 24 * 60 * 60;
const OUTBOX_RETENTION_SECONDS = 7 * 24 * 60 * 60;
export const eventLogSupported = () => Config.instance.selfHosted && Config.database.backend === 'postgres';
export const eventLogStopped = () => process.env.NETRCOL_AUTOMATIONS_ENABLED === 'false';

export class EventLogRepository {
	async getConfig(guildId: GuildID): Promise<EventLogConfig> {
		const row = await fetchOne<GuildRecord>(
			EventLogRecords.select({where: [EventLogRecords.where.eq('guild_id'), EventLogRecords.where.eq('key')]}).bind({
				guild_id: guildId,
				key: 'config',
			}),
		);
		const language = await new ModuleSettingsRepository().override(guildId);
		if (!row)
			return {
				settings: {
					enabled: false,
					channel_id: null,
					events: ['member_join', 'member_leave'],
					language: language ?? 'en-US',
					schema_version: 2,
					category_channels: {},
					event_channels: {},
					capture_message_content: false,
				},
				approved_by: '',
				revision: 0,
			};
		const stored = JSON.parse(row.value) as {settings: unknown; approved_by: string};
		return {
			settings: {
				schema_version: 2,
				category_channels: {},
				event_channels: {},
				capture_message_content: false,
				...EventLogSettings.parse(stored.settings),
				...(language ? {language} : {}),
			},
			approved_by: stored.approved_by,
			revision: row.version,
		};
	}

	async saveConfig(guildId: GuildID, actorId: UserID, settings: EventLogSettings, revision: number): Promise<void> {
		const auditId = `${Date.now().toString().padStart(16, '0')}:${randomUUID()}`;
		const audit: EventLogHistoryEntry = {
			id: auditId,
			kind: 'config_updated',
			status: 'saved',
			actor_id: actorId.toString(),
			subject_id: null,
			channel_id: settings.channel_id,
			message_id: null,
			revision: revision + 1,
			created_at: Date.now(),
			reason: 'none',
		};
		const config: GuildRecord = {
			guild_id: guildId,
			key: 'config',
			value: JSON.stringify({settings, approved_by: actorId.toString()}),
			version: revision + 1,
		};
		const applied = await executeConditional(
			EventLogRecords.conditionalBatch([
				revision === 0
					? {action: 'insert', row: config}
					: {
							action: 'patch',
							pk: {guild_id: guildId, key: 'config'},
							patch: {value: Db.set(config.value), version: Db.set(config.version)},
							expected: {version: revision},
						},
				{
					action: 'insert',
					row: {guild_id: guildId, key: `audit:${auditId}`, value: JSON.stringify(audit), version: 1},
					ttlSeconds: 90 * 24 * 60 * 60,
				},
			]),
		);
		if (!applied)
			throw new ConflictError({
				code: APIErrorCodes.CONFLICT,
				message: 'Event log settings changed. Reload before saving.',
			});
	}

	async prepareDelivery(
		guildId: GuildID,
		subjectId: UserID,
		kind: EventLogEvent | 'test',
		snowflake: ISnowflakeService,
		occurredAt = Date.now(),
		payload: EventLogPayload = {},
		sourceId: string = randomUUID(),
	): Promise<Array<PreparedQuery>> {
		if (!eventLogSupported() || eventLogStopped()) return [];
		const config = await this.getConfig(guildId);
		if (
			!config.settings.enabled ||
			!(kind === 'test'
				? payload.test_event
					? eventLogChannel(config.settings, payload.test_event)
					: config.settings.channel_id
				: eventLogChannel(config.settings, kind)) ||
			(kind !== 'test' && !config.settings.events.includes(kind))
		)
			return [];
		if (kind !== 'test' && !eventLogAvailable(kind)) return [];
		const channelId = createChannelID(
			BigInt(
				(kind === 'test'
					? payload.test_event
						? eventLogChannel(config.settings, payload.test_event)
						: config.settings.channel_id
					: eventLogChannel(config.settings, kind))!,
			),
		);
		const originKey = `source:${createHash('sha256').update(`${kind}:${sourceId}`).digest('hex')}`;
		const generatedId = await snowflake.generateForChannel(channelId);
		await executeConditional(
			EventLogRecords.insertIfNotExistsWithTtl(
				{guild_id: guildId, key: originKey, value: generatedId.toString(), version: 1},
				EVENT_LOG_RETENTION_SECONDS,
			),
		);
		const origin = await fetchOne<GuildRecord>(
			EventLogRecords.select({where: [EventLogRecords.where.eq('guild_id'), EventLogRecords.where.eq('key')]}).bind({
				guild_id: guildId,
				key: originKey,
			}),
		);
		const eventId = BigInt(origin!.value);
		const previous = await fetchOne<GuildRecord>(
			EventLogRecords.select({where: [EventLogRecords.where.eq('guild_id'), EventLogRecords.where.eq('key')]}).bind({
				guild_id: guildId,
				key: `run:${eventId.toString().padStart(20, '0')}`,
			}),
		);
		if (previous && ['sent', 'skipped', 'failed'].includes(JSON.parse(previous.value).status)) return [];
		const safePayload = EventLogPayload.parse(payload);
		if (!config.settings.capture_message_content) {
			delete safePayload.message_text;
			delete safePayload.previous_text;
			delete safePayload.transcript;
		}
		const delivery: EventLogDelivery = {
			queue: 'events',
			event_id: eventId,
			guild_id: guildId,
			subject_id: subjectId,
			channel_id: channelId,
			approved_by: config.approved_by,
			revision: config.revision,
			kind,
			language: config.settings.language,
			occurred_at: occurredAt,
			status: 'pending',
			attempts: 0,
			lease_token: '',
			lease_until: 0,
			next_attempt_at: 0,
			terminal_reason: 'none',
			payload: JSON.stringify(safePayload),
			source_id: sourceId,
		};
		return [
			{
				...idempotentInsert(EventLogOutbox.insertIfNotExistsWithTtl(delivery, OUTBOX_RETENTION_SECONDS)),
				afterCommit: () => eventLogWakeup.notify(eventId),
			},
			this.historyWrite(delivery, 'pending'),
		];
	}

	async enqueueTest(
		guildId: GuildID,
		subjectId: UserID,
		snowflake: ISnowflakeService,
		event?: EventLogEvent,
	): Promise<void> {
		const batch = new BatchBuilder();
		for (const query of await this.prepareDelivery(guildId, subjectId, 'test', snowflake, Date.now(), {
			actor_id: subjectId.toString(),
			subject_id: subjectId.toString(),
			subject_type: 'user',
			...(event ? {test_event: event} : {}),
			details: {test: 'true'},
		}))
			batch.addPrepared(query);
		await batch.execute();
	}

	async listPending(after?: bigint): Promise<Array<EventLogDelivery>> {
		return fetchMany<EventLogDelivery>(
			EventLogOutbox.select({
				where: [
					EventLogOutbox.where.eq('queue'),
					...(after === undefined ? [] : [EventLogOutbox.where.gt('event_id')]),
				],
				orderBy: {col: 'event_id', direction: 'ASC'},
				limit: 50,
			}).bind({queue: 'events', ...(after === undefined ? {} : {event_id: after})}),
		);
	}

	async findByIds(eventIds: Array<bigint>): Promise<Array<EventLogDelivery>> {
		if (!eventIds.length) return [];
		return fetchMany<EventLogDelivery>(
			EventLogOutbox.select({
				where: [EventLogOutbox.where.eq('queue'), EventLogOutbox.where.in('event_id', 'event_ids')],
			}).bind({queue: 'events', event_ids: eventIds}),
		);
	}

	async claim(delivery: EventLogDelivery, now = Date.now()): Promise<EventLogDelivery | null> {
		if (['sent', 'skipped', 'failed'].includes(delivery.status)) return delivery;
		if (delivery.next_attempt_at > now || delivery.lease_until > now) return null;
		const claimed = {
			...delivery,
			status: 'running',
			attempts: delivery.attempts + 1,
			lease_token: randomUUID(),
			lease_until: now + 60_000,
		};
		const applied = await executeConditional(
			EventLogOutbox.conditionalPatchByPk(
				{queue: delivery.queue, event_id: delivery.event_id},
				{
					status: Db.set(claimed.status),
					attempts: Db.set(claimed.attempts),
					lease_token: Db.set(claimed.lease_token),
					lease_until: Db.set(claimed.lease_until),
				},
				{lease_token: delivery.lease_token, attempts: delivery.attempts},
			),
		);
		return applied ? claimed : null;
	}

	async finish(
		delivery: EventLogDelivery,
		status: 'sent' | 'skipped' | 'failed',
		reason: EventLogHistoryEntry['reason'] = 'none',
	): Promise<void> {
		const pk = {queue: delivery.queue, event_id: delivery.event_id};
		// Save a recoverable terminal result before acknowledging. An expired worker cannot overwrite a new lease.
		if (!['sent', 'skipped', 'failed'].includes(delivery.status)) {
			const applied = await executeConditional(
				EventLogOutbox.conditionalPatchByPk(
					pk,
					{status: Db.set(status), terminal_reason: Db.set(reason)},
					{lease_token: delivery.lease_token, status: 'running'},
				),
			);
			if (!applied) return;
		}
		await upsertOne(this.historyWrite(delivery, status, reason));
		await executeConditional(EventLogOutbox.conditionalDeleteByPk(pk, {lease_token: delivery.lease_token, status}));
	}

	async ownsLease(delivery: EventLogDelivery): Promise<boolean> {
		const row = await fetchOne<EventLogDelivery>(
			EventLogOutbox.select({where: [EventLogOutbox.where.eq('queue'), EventLogOutbox.where.eq('event_id')]}).bind({
				queue: delivery.queue,
				event_id: delivery.event_id,
			}),
		);
		return row?.lease_token === delivery.lease_token && row.status === 'running' && row.lease_until > Date.now();
	}

	async retry(delivery: EventLogDelivery): Promise<void> {
		await executeConditional(
			EventLogOutbox.conditionalPatchByPk(
				{queue: delivery.queue, event_id: delivery.event_id},
				{
					status: Db.set('pending'),
					lease_until: Db.set(0),
					next_attempt_at: Db.set(Date.now() + Math.min(300_000, 5_000 * 2 ** delivery.attempts)),
				},
				{lease_token: delivery.lease_token, status: 'running'},
			),
		);
		// Keep the initial pending history entry until a terminal outcome. A delayed retry
		// must never overwrite the result of a newer worker after releasing its lease.
	}

	async history(guildId: GuildID): Promise<Array<EventLogHistoryEntry>> {
		const sets = await Promise.all(
			['audit:', 'run:'].map((prefix) =>
				fetchMany<GuildRecord>(
					EventLogRecords.select({
						where: [
							EventLogRecords.where.eq('guild_id'),
							EventLogRecords.where.gte('key', 'start_key'),
							EventLogRecords.where.lt('key', 'end_key'),
						],
						orderBy: {col: 'key', direction: 'DESC'},
						limit: 50,
					}).bind({guild_id: guildId, start_key: prefix, end_key: `${prefix.slice(0, -1)};`}),
				),
			),
		);
		return sets
			.flat()
			.map((row) => EventLogHistoryEntry.parse(JSON.parse(row.value)))
			.sort((a, b) => b.created_at - a.created_at)
			.slice(0, 50);
	}

	private historyWrite(
		delivery: EventLogDelivery,
		status: EventLogHistoryEntry['status'],
		reason: EventLogHistoryEntry['reason'] = 'none',
	): PreparedQuery {
		const payload = delivery.payload ? EventLogPayload.parse(JSON.parse(delivery.payload)) : {};
		const entry: EventLogHistoryEntry = {
			id: delivery.event_id.toString(),
			kind: delivery.kind,
			status,
			actor_id: payload.actor_id ?? null,
			subject_id:
				payload.subject_id ?? (delivery.subject_id.toString() === '0' ? null : delivery.subject_id.toString()),
			subject_type: payload.subject_type,
			source_id: delivery.source_id,
			source_channel_id: payload.source_channel_id,
			test_event: payload.test_event,
			channel_id: delivery.channel_id.toString(),
			message_id: status === 'sent' ? delivery.event_id.toString() : null,
			revision: delivery.revision,
			created_at: delivery.occurred_at,
			reason,
		};
		const statement = (status === 'pending' ? EventLogRecords.insertIfNotExistsWithTtl : EventLogRecords.insertWithTtl)(
			{
				guild_id: delivery.guild_id,
				key: `run:${delivery.event_id.toString().padStart(20, '0')}`,
				value: JSON.stringify(entry),
				version: 1,
			},
			EVENT_LOG_RETENTION_SECONDS,
		);
		return status === 'pending' ? idempotentInsert(statement) : statement;
	}
}

function idempotentInsert(statement: PreparedQuery): PreparedQuery {
	return {
		...statement,
		cql: statement.cql.replace(/\s+IF NOT EXISTS/i, ''),
		kvMeta: {...statement.kvMeta!, ifNotExists: false, ignoreConflict: true},
	};
}

// This hook is used only by the membership repository, before its atomic PostgreSQL batch commits.
export async function prepareMembershipLog(
	guildId: GuildID,
	userId: UserID,
	kind: EventLogEvent,
): Promise<Array<PreparedQuery>> {
	if (!eventLogSupported() || eventLogStopped()) return [];
	const context = eventLogContext.getStore();
	const payload: EventLogPayload = {
		actor_id: context?.actor_id ?? null,
		subject_id: userId.toString(),
		subject_type: 'user',
		reason: context?.reason ?? null,
	};
	const source = `membership:${kind}:${userId}:${context?.request_id ?? randomUUID()}`;
	const statements = await prepareEventLog(guildId, kind, source, payload);
	if (kind === 'member_join' && context?.invite)
		statements.push(
			...(await prepareEventLog(guildId, 'invite_use', source, {...payload, details: {...context.invite}})),
		);
	return statements;
}

export async function prepareEventLog(
	guildId: GuildID,
	kind: EventLogEvent,
	sourceId: string,
	payload: EventLogPayload = {},
	occurredAt = Date.now(),
): Promise<Array<PreparedQuery>> {
	if (!eventLogSupported() || eventLogStopped()) return [];
	const subjectId =
		payload.subject_type === 'user' && payload.subject_id && /^\d{1,20}$/.test(payload.subject_id)
			? createUserID(BigInt(payload.subject_id))
			: createUserID(0n);
	return new EventLogRepository().prepareDelivery(
		guildId,
		subjectId,
		kind,
		getSnowflakeService(),
		occurredAt,
		payload,
		sourceId,
	);
}

export async function enqueueEventLog(
	guildId: GuildID,
	kind: EventLogEvent,
	sourceId: string,
	payload: EventLogPayload = {},
	occurredAt = Date.now(),
): Promise<void> {
	const statements = await prepareEventLog(guildId, kind, sourceId, payload, occurredAt);
	if (!statements.length) return;
	const batch = new BatchBuilder();
	for (const statement of statements) batch.addPrepared(statement);
	await batch.execute();
}
