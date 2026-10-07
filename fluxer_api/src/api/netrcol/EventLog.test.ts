// SPDX-License-Identifier: AGPL-3.0-or-later

import {createChannelID, createGuildID, createUserID} from '@app/api/BrandedTypes';
import {Config} from '@app/api/Config';
import type {IChannelRepository} from '@app/api/channel/IChannelRepository';
import {BatchBuilder, setCassandraQueryExecutorForTesting, upsertOne} from '@app/api/database/CassandraQueryExecution';
import {Db} from '@app/api/database/CassandraTypes';
import {ensurePostgresKvSchema, PostgresKvQueryExecutor} from '@app/api/database/PostgresKvQueryExecutor';
import type {GuildMemberRow} from '@app/api/database/types/GuildTypes';
import {GuildMemberRepository} from '@app/api/guild/repositories/GuildMemberRepository';
import type {IGuildRepositoryAggregate} from '@app/api/guild/repositories/IGuildRepositoryAggregate';
import {setInjectedWorkerService} from '@app/api/middleware/ServiceRegistry';
import {EventLogDeliveryService} from '@app/api/netrcol/EventLogDeliveryService';
import {eventLogMessage} from '@app/api/netrcol/EventLogMessages';
import {EventLogOutbox, EventLogRepository} from '@app/api/netrcol/EventLogRepository';
import {EVENT_LOG_LANGUAGES, EventLogService} from '@app/api/netrcol/EventLogService';
import {eventLogWakeup} from '@app/api/netrcol/EventLogWakeup';
import {ModuleSettingsRepository} from '@app/api/netrcol/ModuleSettingsRepository';
import {InMemoryCassandraQueryExecutor} from '@app/api/test/InMemoryCassandraQueryExecutor';
import {MockSnowflakeService} from '@app/api/test/mocks/MockSnowflakeService';
import {NoopWorkerService} from '@app/api/test/NoopWorkerService';
import type {WorkerDependencies} from '@app/api/worker/WorkerDependencies';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import {EVENT_LOG_CATALOG, eventLogAvailable} from '@fluxer/constants/src/EventLogConstants';
import {EventLogUpdateRequest} from '@fluxer/schema/src/domains/guild/GuildEventLogSchemas';
import {getDefaultPostgresClient, initPostgres, shutdownPostgres} from '@pkgs/postgres/src/Client';
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';

const guildId = createGuildID(100n);
const ownerId = createUserID(200n);
const subjectId = createUserID(300n);
const channelId = createChannelID(400n);
const settings = {
	enabled: true,
	channel_id: '400',
	events: ['member_join', 'member_leave'] as Array<'member_join' | 'member_leave'>,
	language: 'tr',
};
const postgresUrl = process.env.NETRCOL_TEST_POSTGRES_URL;

describe(`Event logs (${postgresUrl ? 'PostgreSQL' : 'memory'})`, () => {
	let repository: EventLogRepository;
	let snowflake: MockSnowflakeService;
	let originalSelfHosted: boolean;
	let originalBackend: typeof Config.database.backend;
	let guild: {ownerId: typeof ownerId} | null;
	let member: object | null;
	let channel: {
		id: typeof channelId;
		guildId: typeof guildId;
		type: number;
		isSoftDeleted: boolean;
		position: number;
		name: string;
	} | null;
	let service: EventLogService;
	beforeAll(async () => {
		originalSelfHosted = Config.instance.selfHosted;
		originalBackend = Config.database.backend;
		if (postgresUrl) {
			await initPostgres({url: postgresUrl, kvTable: 'kv_event_logs_test'});
			await ensurePostgresKvSchema(getDefaultPostgresClient());
		}
	});
	beforeEach(async () => {
		vi.spyOn(eventLogWakeup, 'notify').mockImplementation(() => {});
		Config.instance.selfHosted = true;
		Config.database.backend = 'postgres';
		delete process.env.NETRCOL_AUTOMATIONS_ENABLED;
		if (postgresUrl) {
			await getDefaultPostgresClient().query('TRUNCATE kv_event_logs_test');
			setCassandraQueryExecutorForTesting(new PostgresKvQueryExecutor(getDefaultPostgresClient()));
		} else setCassandraQueryExecutorForTesting(new InMemoryCassandraQueryExecutor());
		repository = new EventLogRepository();
		snowflake = new MockSnowflakeService();
		guild = {ownerId};
		member = {};
		channel = {
			id: channelId,
			guildId,
			type: ChannelTypes.GUILD_TEXT,
			isSoftDeleted: false,
			position: 0,
			name: 'general',
		};
		service = new EventLogService(
			{findUnique: async () => guild, getMember: async () => member} as unknown as IGuildRepositoryAggregate,
			{
				findUnique: async () => channel,
				listGuildChannels: async () => (channel ? [channel] : []),
			} as unknown as IChannelRepository,
			repository,
		);
	});
	afterEach(async () => {
		await eventLogWakeup.drain();
		vi.restoreAllMocks();
	});
	afterAll(async () => {
		Config.instance.selfHosted = originalSelfHosted;
		Config.database.backend = originalBackend;
		delete process.env.NETRCOL_AUTOMATIONS_ENABLED;
		if (postgresUrl) await shutdownPostgres();
	});
	async function queued(kind: 'member_join' | 'member_leave' | 'test' = 'member_join') {
		await repository.saveConfig(guildId, ownerId, settings, 0);
		const batch = new BatchBuilder();
		for (const query of await repository.prepareDelivery(guildId, subjectId, kind, snowflake)) batch.addPrepared(query);
		await batch.execute();
		return (await repository.listPending())[0]!;
	}
	it('notifies only after an outbox record is committed and retrieves immediate targets by ID', async () => {
		await repository.saveConfig(guildId, ownerId, settings, 0);
		const queries = await repository.prepareDelivery(guildId, subjectId, 'member_join', snowflake);
		expect(eventLogWakeup.notify).not.toHaveBeenCalled();
		expect(await repository.listPending()).toHaveLength(0);
		const batch = new BatchBuilder();
		for (const query of queries) batch.addPrepared(query);
		await batch.execute();
		const row = (await repository.listPending())[0]!;
		expect(eventLogWakeup.notify).toHaveBeenCalledWith(row.event_id);
		expect(await repository.findByIds([row.event_id, row.event_id + 1000n])).toEqual([row]);
		expect(await repository.findByIds([])).toEqual([]);
	});
	it('keeps the committed outbox recoverable when the immediate publisher is unavailable', async () => {
		vi.mocked(eventLogWakeup.notify).mockRestore();
		const worker = new NoopWorkerService();
		const publish = vi.spyOn(worker, 'addJob').mockRejectedValue(new Error('broker unavailable'));
		setInjectedWorkerService(worker);
		try {
			const row = await queued();
			await eventLogWakeup.drain();
			expect(publish).toHaveBeenCalledOnce();
			expect(await repository.findByIds([row.event_id])).toEqual([row]);
			const claim = await repository.claim(row);
			expect(claim).not.toBeNull();
			await deliveryService().delivery.deliver(claim!);
			expect(await repository.listPending()).toEqual([]);
			expect(
				(await repository.history(guildId)).some((entry) => entry.kind === 'member_join' && entry.status === 'sent'),
			).toBe(true);
		} finally {
			setInjectedWorkerService(new NoopWorkerService());
		}
	});
	function deliveryService(existing: object | null = null, bot = false) {
		const createMessage = vi.fn(async (data: object) => ({message: data}));
		const dispatchMessageCreate = vi.fn(async () => {});
		const dependencies = {
			guildRepository: {findUnique: async () => guild, getMember: async () => ({nickname: 'Test member'})},
			channelRepository: {findUnique: async () => channel},
			userRepository: {findUnique: async () => ({isBot: bot, isSystem: false})},
			channelService: {
				messages: {
					writeLock: {
						withFreshMessage: async (_channel: unknown, _id: unknown, fn: (message: object | null) => Promise<void>) =>
							fn(existing),
					},
					persistence: {createMessage},
					dispatch: {dispatchMessageCreate},
				},
			},
		};
		return {
			delivery: new EventLogDeliveryService(dependencies as unknown as WorkerDependencies, repository),
			createMessage,
			dispatchMessageCreate,
		};
	}
	it('rejects non-owners, removed members, hosted and unsupported databases', async () => {
		await expect(service.read(guildId, subjectId)).rejects.toThrow();
		member = null;
		await expect(service.read(guildId, ownerId)).rejects.toThrow();
		member = {};
		Config.instance.selfHosted = false;
		await expect(service.history(guildId, ownerId)).rejects.toThrow();
		Config.instance.selfHosted = true;
		Config.database.backend = 'cassandra';
		await expect(service.save(guildId, ownerId, {...settings, revision: 0})).rejects.toThrow();
	});
	it.each(['foreign', 'voice', 'deleted', 'missing'])('rejects a %s log channel', async (caseName) => {
		if (caseName === 'foreign') channel!.guildId = createGuildID(999n);
		if (caseName === 'voice') channel!.type = ChannelTypes.GUILD_VOICE;
		if (caseName === 'deleted') channel!.isSoftDeleted = true;
		if (caseName === 'missing') channel = null;
		await expect(service.save(guildId, ownerId, {...settings, revision: 0})).rejects.toThrow();
		expect((await repository.getConfig(guildId)).revision).toBe(0);
	});
	it('validates events and language and allows an empty disabled configuration', async () => {
		await expect(service.save(guildId, ownerId, {...settings, events: [], revision: 0})).rejects.toThrow();
		await expect(service.save(guildId, ownerId, {...settings, language: 'zz', revision: 0})).rejects.toThrow();
		expect(
			EventLogUpdateRequest.safeParse({...settings, events: ['member_join', 'member_join'], revision: 0}).success,
		).toBe(false);
		expect(
			(await service.save(guildId, ownerId, {...settings, enabled: false, channel_id: null, events: [], revision: 0}))
				.status,
		).toBe('disabled');
	});
	it('saves configuration and audit together and refuses stale revisions', async () => {
		await service.save(guildId, ownerId, {...settings, revision: 0});
		await expect(service.save(guildId, ownerId, {...settings, language: 'de', revision: 0})).rejects.toThrow();
		expect((await repository.getConfig(guildId)).settings.language).toBe('tr');
		expect(await repository.history(guildId)).toHaveLength(1);
	});
	it('uses the shared language for new and already queued deliveries without dropping events', async () => {
		const row = await queued();
		expect(row.language).toBe('tr');
		await new ModuleSettingsRepository().save(guildId, ownerId, {message_language: 'de'}, 0);
		const {delivery, createMessage} = deliveryService();
		await delivery.deliver((await repository.claim(row))!);
		expect(createMessage).toHaveBeenCalledOnce();
		expect(createMessage.mock.calls[0]![0]).toMatchObject({processedEmbeds: [{title: 'Mitglied beigetreten'}]});
		await repository.enqueueTest(guildId, ownerId, snowflake, 'member_join');
		expect((await repository.listPending())[0]!.language).toBe('de');
	});
	it('upgrades version-one preferences without enabling any newly introduced events', async () => {
		await repository.saveConfig(guildId, ownerId, settings, 0);
		const stored = await repository.getConfig(guildId);
		expect(stored.settings).toEqual({
			...settings,
			schema_version: 2,
			category_channels: {},
			event_channels: {},
			capture_message_content: false,
		});
		expect(stored.settings.events).toEqual(['member_join', 'member_leave']);
		expect(stored.settings.language).toBe('tr');
		expect(stored.settings.channel_id).toBe('400');
	});
	it('rejects both events for which Fluxer has no producer', async () => {
		for (const event of ['member_prune', 'invite_update'] as const)
			await expect(service.save(guildId, ownerId, {...settings, events: [event], revision: 0})).rejects.toThrow();
	});
	it('uses per-event routing for real tests and does not reset a claimed duplicate', async () => {
		await repository.saveConfig(
			guildId,
			ownerId,
			{
				...settings,
				events: ['message_delete'],
				category_channels: {messages: '401'},
				event_channels: {message_delete: '402'},
			},
			0,
		);
		await repository.enqueueTest(guildId, ownerId, snowflake, 'message_delete');
		const test = (await repository.listPending())[0]!;
		expect(test.channel_id).toBe(402n);
		expect(JSON.parse(test.payload!).test_event).toBe('message_delete');
		const enqueue = async () => {
			const batch = new BatchBuilder();
			for (const statement of await repository.prepareDelivery(
				guildId,
				subjectId,
				'message_delete',
				snowflake,
				0,
				{actor_id: null},
				'stable-delete',
			))
				batch.addPrepared(statement);
			await batch.execute();
		};
		await enqueue();
		const candidate = (await repository.listPending()).find((item) => item.kind === 'message_delete')!;
		const claim = (await repository.claim(candidate))!;
		await enqueue();
		expect((await repository.listPending()).find((item) => item.kind === 'message_delete')!.lease_token).toBe(
			claim.lease_token,
		);
		await repository.finish(claim, 'sent', 'none');
		await enqueue();
		expect((await repository.listPending()).filter((item) => item.kind === 'message_delete')).toHaveLength(0);
	});
	it('advances through a burst while delayed retries remain at the head', async () => {
		await repository.saveConfig(
			guildId,
			ownerId,
			{...settings, events: EVENT_LOG_CATALOG.filter((event) => eventLogAvailable(event.id)).map((event) => event.id)},
			0,
		);
		for (let index = 0; index < 115; index++) {
			const batch = new BatchBuilder();
			for (const statement of await repository.prepareDelivery(
				guildId,
				subjectId,
				'message_create',
				snowflake,
				0,
				{},
				`burst:${index}`,
			))
				batch.addPrepared(statement);
			await batch.execute();
		}
		const firstPage = await repository.listPending();
		expect(firstPage).toHaveLength(50);
		const delayed = (await repository.claim(firstPage[0]!))!;
		await repository.retry(delayed);
		const secondPage = await repository.listPending(firstPage.at(-1)!.event_id);
		const thirdPage = await repository.listPending(secondPage.at(-1)!.event_id);
		expect([...firstPage, ...secondPage, ...thirdPage]).toHaveLength(115);
		expect(await repository.claim((await repository.listPending())[0]!)).toBeNull();
		expect(await repository.claim(thirdPage[0]!)).not.toBeNull();
	});
	it('has one winner for simultaneous settings updates', async () => {
		const results = await Promise.allSettled([
			repository.saveConfig(guildId, ownerId, settings, 0),
			repository.saveConfig(guildId, ownerId, {...settings, language: 'de'}, 0),
		]);
		expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
		expect(await repository.history(guildId)).toHaveLength(1);
	});
	it('pauses after ownership changes until the new owner saves', async () => {
		await queued();
		guild = {ownerId: subjectId};
		expect((await service.read(guildId, subjectId)).status).toBe('owner_changed');
		await expect(service.test(guildId, subjectId, snowflake)).rejects.toThrow();
		expect((await service.save(guildId, subjectId, {...settings, revision: 1})).status).toBe('enabled');
	});
	it('claims exclusively and ignores stale completion and retry attempts', async () => {
		const pending = await queued();
		const claims = await Promise.all([repository.claim(pending), repository.claim(pending)]);
		expect(claims.filter(Boolean)).toHaveLength(1);
		const old = claims.find(Boolean)!;
		const newer = await repository.claim(old, old.lease_until + 1);
		expect(newer).not.toBeNull();
		await repository.finish(old, 'failed', 'delivery_failed');
		await repository.retry(old);
		expect((await repository.listPending())[0]!.lease_token).toBe(newer!.lease_token);
		expect((await repository.history(guildId)).find((entry) => entry.kind === 'member_join')!.status).toBe('pending');
	});
	it('retries later with the same durable message ID', async () => {
		const row = (await repository.claim(await queued()))!;
		await repository.retry(row);
		const retry = (await repository.listPending())[0]!;
		expect(retry.event_id).toBe(row.event_id);
		expect(await repository.claim(retry)).toBeNull();
		expect(retry.next_attempt_at).toBeGreaterThan(Date.now());
	});
	it.each(['disabled', 'owner', 'revision', 'channel', 'stopped'])(
		'does not send after %s changes',
		async (caseName) => {
			const row = (await repository.claim(await queued()))!;
			if (caseName === 'disabled') await repository.saveConfig(guildId, ownerId, {...settings, enabled: false}, 1);
			if (caseName === 'owner') guild = {ownerId: subjectId};
			if (caseName === 'revision') await repository.saveConfig(guildId, ownerId, {...settings, language: 'de'}, 1);
			if (caseName === 'channel') channel = null;
			if (caseName === 'stopped') process.env.NETRCOL_AUTOMATIONS_ENABLED = 'false';
			const deps = deliveryService(null, caseName === 'bot');
			await deps.delivery.deliver(row);
			expect(deps.createMessage).not.toHaveBeenCalled();
			expect(await repository.listPending()).toHaveLength(0);
		},
	);
	it('includes bot operations', async () => {
		const row = (await repository.claim(await queued()))!;
		const deps = deliveryService(null, true);
		await deps.delivery.deliver(row);
		expect(deps.createMessage).toHaveBeenCalledOnce();
	});
	it('persists a system-authored message with all mentions disabled', async () => {
		const row = (await repository.claim(await queued()))!;
		const deps = deliveryService();
		await deps.delivery.deliver(row);
		expect(deps.createMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				messageId: row.event_id,
				userId: 0n,
				content: '',
				processedEmbeds: [
					expect.objectContaining({title: 'Üye katıldı', type: 'rich', description: '**Test member**'}),
				],
				allowedMentions: {parse: [], users: [], roles: [], replied_user: false},
			}),
		);
		expect(deps.dispatchMessageCreate).toHaveBeenCalledOnce();
		expect((await repository.history(guildId)).find((entry) => entry.kind === 'member_join')!.message_id).toBe(
			row.event_id.toString(),
		);
	});
	it('reconciles a persisted message without creating another message', async () => {
		const row = (await repository.claim(await queued('test')))!;
		const deps = deliveryService({id: row.event_id});
		await deps.delivery.deliver(row);
		expect(deps.createMessage).not.toHaveBeenCalled();
		expect(deps.dispatchMessageCreate).toHaveBeenCalledOnce();
		expect(await repository.listPending()).toHaveLength(0);
	});
	it('recovers terminal outcomes after a crash before acknowledgement', async () => {
		const row = (await repository.claim(await queued()))!;
		await upsertOne(
			EventLogOutbox.patchByPk(
				{queue: row.queue, event_id: row.event_id},
				{status: Db.set('sent'), terminal_reason: Db.set('none')},
			),
		);
		const recovery = (await repository.claim((await repository.listPending())[0]!))!;
		const deps = deliveryService();
		await deps.delivery.deliver(recovery);
		expect(deps.createMessage).not.toHaveBeenCalled();
		expect(await repository.listPending()).toHaveLength(0);
		expect((await repository.history(guildId)).find((entry) => entry.kind === 'member_join')!.status).toBe('sent');
	});
	it('queues only actual joins and departures, not profile edits or repeated removal', async () => {
		await repository.saveConfig(guildId, ownerId, settings, 0);
		const members = new GuildMemberRepository();
		const row = {
			guild_id: guildId,
			user_id: subjectId,
			joined_at: new Date(),
			role_ids: new Set(),
			nick: null,
			version: 1,
		} as unknown as GuildMemberRow;
		await members.upsertMember(row);
		await members.upsertMember({...row, nick: 'Updated'});
		expect(await repository.listPending()).toHaveLength(1);
		await members.deleteMember(guildId, subjectId);
		await members.deleteMember(guildId, subjectId);
		expect((await repository.listPending()).map((entry) => entry.kind)).toEqual(['member_join', 'member_leave']);
	});
	it.runIf(Boolean(postgresUrl))('rolls back membership and event records if their atomic batch fails', async () => {
		await repository.saveConfig(guildId, ownerId, settings, 0);
		const members = new GuildMemberRepository();
		const client = getDefaultPostgresClient();
		await client.query(
			"CREATE OR REPLACE FUNCTION reject_test_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.table_name = 'netrcol_event_log_outbox' THEN RAISE EXCEPTION 'injected test failure'; END IF; RETURN NEW; END $$",
		);
		await client.query(
			'CREATE TRIGGER reject_event BEFORE INSERT OR UPDATE ON kv_event_logs_test FOR EACH ROW EXECUTE FUNCTION reject_test_event()',
		);
		try {
			await expect(
				members.upsertMember({
					guild_id: guildId,
					user_id: subjectId,
					joined_at: new Date(),
					role_ids: new Set(),
					version: 1,
				} as unknown as GuildMemberRow),
			).rejects.toThrow();
			expect(await members.getMember(guildId, subjectId)).toBeNull();
			expect(await repository.listPending()).toHaveLength(0);
			expect(await repository.history(guildId)).toHaveLength(1);
			expect(eventLogWakeup.notify).not.toHaveBeenCalled();
		} finally {
			await client.query('DROP TRIGGER reject_event ON kv_event_logs_test');
			await client.query('DROP FUNCTION reject_test_event()');
		}
	});
	it('has localized, mention-free messages for every supported language', () => {
		expect(EVENT_LOG_LANGUAGES.size).toBe(34);
		for (const language of EVENT_LOG_LANGUAGES)
			for (const kind of ['member_join', 'member_leave', 'test'] as const) {
				const text = eventLogMessage(kind, language, '300', 0);
				expect(text).toContain('`300`');
				expect(text).not.toMatch(/<@|@everyone|@here/);
			}
	});
});
