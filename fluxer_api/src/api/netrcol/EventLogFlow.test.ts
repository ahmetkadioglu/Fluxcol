// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount, type TestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {createChannelID, createEntranceSoundID, createGuildID, createUserID} from '@app/api/BrandedTypes';
import {authorizeBot, createTestBotAccount} from '@app/api/bot/tests/BotTestUtils';
import {Config} from '@app/api/Config';
import {setCassandraQueryExecutorForTesting} from '@app/api/database/CassandraQueryExecution';
import {ensurePostgresKvSchema, PostgresKvQueryExecutor} from '@app/api/database/PostgresKvQueryExecutor';
import {createEmoji, getPngDataUrl} from '@app/api/emoji/tests/EmojiTestUtils';
import {GuildModerationRepository} from '@app/api/guild/repositories/GuildModerationRepository';
import {
	acceptInvite,
	addMemberRole,
	createChannel,
	createChannelInvite,
	createGuild,
	createRole,
	deleteRole,
	removeMemberRole,
	updateRole,
} from '@app/api/guild/tests/GuildTestUtils';
import {deleteMessage, getMessages, pinMessage, sendMessage} from '@app/api/message/tests/MessageTestUtils';
import {ServiceMiddleware} from '@app/api/middleware/ServiceMiddleware';
import {getGatewayService} from '@app/api/middleware/ServiceRegistry';
import {
	getChannelRepository,
	getGuildRepository,
	getUserRepository,
	getWebhookRepository,
} from '@app/api/middleware/ServiceSingletons';
import {EntranceSound} from '@app/api/models/EntranceSound';
import {EventLogDeliveryService} from '@app/api/netrcol/EventLogDeliveryService';
import type {captureGatewayTransition} from '@app/api/netrcol/EventLogGateway';
import {EventLogRepository} from '@app/api/netrcol/EventLogRepository';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import type {NoopGatewayService} from '@app/api/test/NoopGatewayService';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import type {HonoEnv} from '@app/api/types/HonoEnv';
import {EntranceSoundRepository} from '@app/api/user/entrance_sound/EntranceSoundRepository';
import {createWebhook, updateWebhook} from '@app/api/webhook/tests/WebhookTestUtils';
import {AuditLogActionType} from '@fluxer/constants/src/AuditLogActionType';
import {EVENT_LOG_CATALOG, eventLogAvailable} from '@fluxer/constants/src/EventLogConstants';
import type {ChannelResponse} from '@fluxer/schema/src/domains/channel/ChannelSchemas';
import type {GuildStickerResponse} from '@fluxer/schema/src/domains/guild/GuildEmojiSchemas';
import type {GuildResponse} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';
import {getDefaultPostgresClient, initPostgres, shutdownPostgres} from '@pkgs/postgres/src/Client';
import {Hono} from 'hono';
import {afterAll, afterEach, beforeEach, describe, expect, it} from 'vitest';

describe('Native community operations → event outbox → actual system messages', () => {
	let harness: ApiTestHarness, owner: TestAccount, guild: GuildResponse, logs: ChannelResponse, source: ChannelResponse;
	const repository = new EventLogRepository();
	const original = {selfHosted: Config.instance.selfHosted, backend: Config.database.backend};
	const postgresUrl = process.env.NETRCOL_TEST_POSTGRES_URL;
	afterAll(async () => {
		if (postgresUrl) await shutdownPostgres();
	});
	beforeEach(async () => {
		Config.instance.selfHosted = original.selfHosted;
		Config.database.backend = original.backend;
		harness = await createApiTestHarness();
		if (postgresUrl) {
			await initPostgres({url: postgresUrl, kvTable: 'kv_event_log_flows'});
			await ensurePostgresKvSchema(getDefaultPostgresClient());
			await getDefaultPostgresClient().query('TRUNCATE kv_event_log_flows');
			setCassandraQueryExecutorForTesting(new PostgresKvQueryExecutor(getDefaultPostgresClient()));
		}
		owner = await createTestAccount(harness);
		guild = await createGuild(harness, owner.token, 'Isolated event-log integration');
		logs = await createChannel(harness, owner.token, guild.id, 'event-logs');
		source = await createChannel(harness, owner.token, guild.id, 'private-source');
		Config.instance.selfHosted = true;
		Config.database.backend = 'postgres';
		await createBuilder(harness, owner.token)
			.put(`/guilds/${guild.id}/application-settings/event-logs`)
			.body({
				revision: 0,
				schema_version: 2,
				enabled: true,
				channel_id: logs.id,
				category_channels: {},
				event_channels: {},
				events: EVENT_LOG_CATALOG.filter((event) => eventLogAvailable(event.id)).map((event) => event.id),
				language: 'tr',
				capture_message_content: true,
			})
			.execute();
	});
	afterEach(async () => {
		Config.instance.selfHosted = original.selfHosted;
		Config.database.backend = original.backend;
		await harness?.shutdown();
	});
	async function flush(kinds: Array<string>) {
		const app = new Hono<HonoEnv>();
		app.use(ServiceMiddleware);
		app.get('/flush', async (ctx) => {
			const delivery = new EventLogDeliveryService(
				{
					guildRepository: getGuildRepository(),
					channelRepository: getChannelRepository(),
					userRepository: getUserRepository(),
					webhookRepository: getWebhookRepository(),
					channelService: ctx.get('channelService'),
					storageService: harness.storageService,
				},
				repository,
			);
			for (let page = 0; page < 10; page++) {
				const pending = await repository.listPending();
				if (!pending.length) break;
				for (const candidate of pending) {
					const claim = await repository.claim(candidate);
					if (claim) await delivery.deliver(claim);
				}
			}
			return ctx.json({ok: true});
		});
		expect((await app.request('/flush')).status).toBe(200);
		const history = await repository.history(createGuildID(BigInt(guild.id)));
		for (const kind of kinds)
			expect(
				history.some((entry) => entry.kind === kind && entry.status === 'sent'),
				kind,
			).toBe(true);
		const messages = await getMessages(harness, owner.token, logs.id, {limit: '100'});
		for (const entry of history.filter((entry) => entry.status === 'sent')) {
			const message = messages.find((message) => message.id === entry.message_id);
			expect(message, entry.kind).toBeDefined();
			expect(message!.author.id).toBe('0');
			expect(message!.author.username).toBe('Netrcol');
			expect(message!.author.system).toBe(true);
			expect(message!.content).not.toMatch(/<@|@everyone|@here/);
			expect(message!.embeds).toHaveLength(1);
			expect(message!.embeds![0]!.type).toBe('rich');
			expect(message!.embeds![0]!.title).toBeTruthy();
			expect(message!.embeds![0]!.timestamp).toBeTruthy();
		}
		expect(await repository.listPending()).toHaveLength(0);
		return messages;
	}
	it('captures private message creation, edit, pins, reactions, deletion and bulk text attachments', async () => {
		await createBuilder(harness, owner.token)
			.put(`/channels/${source.id}/permissions/${guild.id}`)
			.body({type: 0, allow: '0', deny: '1024'})
			.expect(204)
			.execute();
		const message = await sendMessage(harness, owner.token, source.id, 'önce @everyone');
		await createBuilder(harness, owner.token)
			.patch(`/channels/${source.id}/messages/${message.id}`)
			.body({content: 'sonra'})
			.execute();
		await pinMessage(harness, owner.token, source.id, message.id);
		await createBuilder(harness, owner.token).delete(`/channels/${source.id}/pins/${message.id}`).expect(204).execute();
		const reaction = `/channels/${source.id}/messages/${message.id}/reactions/${encodeURIComponent('👍')}`;
		await createBuilder(harness, owner.token).put(`${reaction}/@me`).expect(204).execute();
		await createBuilder(harness, owner.token).delete(`${reaction}/@me`).expect(204).execute();
		await createBuilder(harness, owner.token).put(`${reaction}/@me`).expect(204).execute();
		await createBuilder(harness, owner.token).delete(reaction).expect(204).execute();
		await createBuilder(harness, owner.token).put(`${reaction}/@me`).expect(204).execute();
		await createBuilder(harness, owner.token)
			.delete(`/channels/${source.id}/messages/${message.id}/reactions`)
			.expect(204)
			.execute();
		await deleteMessage(harness, owner.token, source.id, message.id);
		const m1 = await sendMessage(harness, owner.token, source.id, 'uzun döküm '.repeat(150));
		const m2 = await sendMessage(harness, owner.token, source.id, 'ikinci');
		await createBuilder(harness, owner.token)
			.post(`/channels/${source.id}/messages/bulk-delete`)
			.body({message_ids: [m1.id, m2.id]})
			.expect(204)
			.execute();
		const pending = await repository.listPending();
		const edit = JSON.parse(pending.find((event) => event.kind === 'message_update')!.payload!);
		expect(edit.previous_text).toBe('önce @everyone');
		expect(edit.message_text).toBe('sonra');
		const delivered = await flush([
			'message_create',
			'message_update',
			'message_delete',
			'message_bulk_delete',
			'message_pin',
			'message_unpin',
			'reaction_add',
			'reaction_remove',
			'reaction_clear',
			'reaction_clear_emoji',
			'channel_overwrite_create',
		]);
		const editEmbed = delivered.find((item) => item.embeds?.[0]?.title === 'Mesaj düzenlendi')!.embeds![0]!;
		expect(editEmbed.fields).toEqual([
			{name: 'Önce', value: 'önce @\u200beveryone', inline: false},
			{name: 'Sonra', value: 'sonra', inline: false},
		]);
		expect(editEmbed.description).toContain('#private-source');
		expect(editEmbed.description).not.toContain(owner.userId);
		expect(
			harness.storageService.uploadObjectSpy.mock.calls.some(([params]) => params.key.endsWith('event-log.txt')),
		).toBe(true);
	});
	it('captures channel, category, permission, role, community, webhook and expression mutations', async () => {
		const channel = await createChannel(harness, owner.token, guild.id, 'new');
		await createBuilder(harness, owner.token)
			.patch(`/channels/${channel.id}`)
			.body({name: 'renamed', topic: 'topic'})
			.execute();
		await createChannel(harness, owner.token, guild.id, 'category', 4);
		const role = await createRole(harness, owner.token, guild.id, {name: 'reviewers'});
		await updateRole(harness, owner.token, guild.id, role.id, {name: 'renamed reviewers', permissions: '1024'});
		await addMemberRole(harness, owner.token, guild.id, owner.userId, role.id);
		await removeMemberRole(harness, owner.token, guild.id, owner.userId, role.id);
		await createBuilder(harness, owner.token)
			.put(`/channels/${channel.id}/permissions/${role.id}`)
			.body({type: 0, allow: '1024', deny: '0'})
			.expect(204)
			.execute();
		await createBuilder(harness, owner.token)
			.put(`/channels/${channel.id}/permissions/${role.id}`)
			.body({type: 0, allow: '2048', deny: '0'})
			.expect(204)
			.execute();
		await createBuilder(harness, owner.token)
			.delete(`/channels/${channel.id}/permissions/${role.id}`)
			.expect(204)
			.execute();
		await deleteRole(harness, owner.token, guild.id, role.id);
		await createBuilder(harness, owner.token).delete(`/channels/${channel.id}`).expect(204).execute();
		await createBuilder(harness, owner.token).patch(`/guilds/${guild.id}`).body({name: 'renamed community'}).execute();
		const webhook = await createWebhook(harness, source.id, owner.token, 'native webhook');
		await updateWebhook(harness, webhook.id, owner.token, {name: 'renamed webhook'});
		await createBuilder(harness, owner.token).delete(`/webhooks/${webhook.id}`).expect(204).execute();
		const emoji = await createEmoji(harness, owner.token, guild.id, {name: 'logemoji', image: getPngDataUrl()});
		await createBuilder(harness, owner.token)
			.patch(`/guilds/${guild.id}/emojis/${emoji.id}`)
			.body({name: 'renamedemoji'})
			.execute();
		await createBuilder(harness, owner.token).delete(`/guilds/${guild.id}/emojis/${emoji.id}`).expect(204).execute();
		const sticker = await createBuilder<GuildStickerResponse>(harness, owner.token)
			.post(`/guilds/${guild.id}/stickers`)
			.body({name: 'log sticker', description: 'original', tags: ['log'], image: getPngDataUrl()})
			.execute();
		await createBuilder(harness, owner.token)
			.patch(`/guilds/${guild.id}/stickers/${sticker.id}`)
			.body({name: 'renamed sticker', description: 'updated', tags: ['log']})
			.execute();
		await createBuilder(harness, owner.token)
			.delete(`/guilds/${guild.id}/stickers/${sticker.id}`)
			.expect(204)
			.execute();
		await flush([
			'channel_create',
			'channel_update',
			'channel_delete',
			'channel_overwrite_create',
			'channel_overwrite_update',
			'channel_overwrite_delete',
			'role_create',
			'role_update',
			'role_delete',
			'member_role_update',
			'guild_update',
			'webhook_create',
			'webhook_update',
			'webhook_delete',
			'emoji_create',
			'emoji_update',
			'emoji_delete',
			'sticker_create',
			'sticker_update',
			'sticker_delete',
		]);
	});
	it('captures invitation use, membership, public profile and moderation', async () => {
		const member = await createTestAccount(harness);
		const invite = await createChannelInvite(harness, owner.token, source.id);
		await acceptInvite(harness, member.token, invite.code);
		await createBuilder(harness, member.token).patch('/users/@me').body({global_name: 'Visible profile'}).execute();
		await createBuilder(harness, owner.token)
			.patch(`/guilds/${guild.id}/members/${member.userId}`)
			.body({
				nick: 'new nickname',
				communication_disabled_until: new Date(Date.now() + 60000).toISOString(),
				mute: true,
				deaf: true,
			})
			.execute();
		const voice = await createChannel(harness, owner.token, guild.id, 'voice', 2);
		await createBuilder(harness, owner.token)
			.patch(`/guilds/${guild.id}/members/${member.userId}`)
			.body({channel_id: voice.id})
			.execute();
		await createBuilder(harness, owner.token)
			.patch(`/guilds/${guild.id}/members/${member.userId}`)
			.body({channel_id: null})
			.execute();
		await createBuilder(harness, owner.token)
			.delete(`/guilds/${guild.id}/members/${member.userId}`)
			.expect(204)
			.execute();
		await acceptInvite(harness, member.token, invite.code);
		await createBuilder(harness, owner.token)
			.put(`/guilds/${guild.id}/bans/${member.userId}`)
			.body({delete_message_days: 0})
			.expect(204)
			.execute();
		await createBuilder(harness, owner.token).delete(`/guilds/${guild.id}/bans/${member.userId}`).expect(204).execute();
		await createBuilder(harness, owner.token).delete(`/invites/${invite.code}`).expect(204).execute();
		await flush([
			'invite_create',
			'invite_use',
			'invite_delete',
			'member_join',
			'member_leave',
			'member_update',
			'user_profile_update',
			'member_timeout',
			'member_server_mute',
			'member_server_deaf',
			'member_move',
			'member_disconnect',
			'member_kick',
			'member_ban_add',
			'member_ban_remove',
		]);
	});
	it('deduplicates RPC retries, ignores initial presence, and delivers visible voice/status transitions', async () => {
		const base = {
			type: 'event_log_transition' as const,
			guild_id: BigInt(guild.id),
			user_id: owner.userId,
			source_id: 'stable-rpc',
			occurred_at: Date.now(),
			family: 'voice' as const,
			before: null,
			after: {channel_id: source.id},
		};
		const rpc = async (request: Parameters<typeof captureGatewayTransition>[1]) =>
			createBuilder(harness, '')
				.post('/internal/rpc')
				.header('x-fluxer-rpc-auth', Config.internal.gatewayRpcAuthToken)
				.body({...request, guild_id: guild.id})
				.execute();
		await createBuilder(harness, '')
			.post('/internal/rpc')
			.body({...base, guild_id: guild.id})
			.expect(401)
			.execute();
		await rpc(base);
		await rpc(base);
		await rpc({...base, family: 'presence', source_id: 'initial', after: {status: 'online'}});
		expect((await repository.listPending()).filter((event) => event.kind === 'voice_join')).toHaveLength(1);
		await rpc({
			...base,
			source_id: 'voice-flags',
			before: {
				channel_id: source.id,
				self_mute: false,
				self_deaf: false,
				self_video: false,
				self_stream: false,
				suppress: false,
			},
			after: {
				channel_id: logs.id,
				self_mute: true,
				self_deaf: true,
				self_video: true,
				self_stream: true,
				suppress: true,
			},
			actor_id: owner.userId,
		});
		await rpc({...base, source_id: 'voice-leave', before: {channel_id: source.id}, after: {channel_id: null}});
		await rpc({
			...base,
			family: 'presence',
			source_id: 'status',
			before: {status: 'online', custom_status: null},
			after: {status: 'offline', custom_status: 'public'},
		});
		await flush([
			'voice_join',
			'voice_leave',
			'voice_move',
			'voice_self_mute',
			'voice_self_deaf',
			'voice_video',
			'voice_stream',
			'voice_suppress',
			'presence_status',
			'presence_custom_status',
		]);
	});
	it('delivers bot addition and bot messages and announcement publishing', async () => {
		const bot = await createTestBotAccount(harness);
		await authorizeBot(harness, owner.token, bot.appId, ['bot'], guild.id, '8');
		await sendMessage(harness, `Bot ${bot.botToken}`, source.id, 'Bot operation');
		const announcement = await createChannel(harness, owner.token, guild.id, 'announcements', 5);
		const message = await sendMessage(harness, owner.token, announcement.id, 'announcement');
		await createBuilder(harness, owner.token)
			.post(`/channels/${announcement.id}/messages/${message.id}/crosspost`)
			.execute();
		await flush(['bot_add', 'message_create', 'message_publish']);
	});
	it.runIf(Boolean(postgresUrl))(
		'rolls back native audit and message edits/deletions when outbox persistence fails',
		async () => {
			const message = await sendMessage(harness, owner.token, source.id, 'before rollback');
			const client = getDefaultPostgresClient();
			await client.query(
				"CREATE OR REPLACE FUNCTION reject_flow_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.table_name = 'netrcol_event_log_outbox' THEN RAISE EXCEPTION 'injected failure'; END IF; RETURN NEW; END $$",
			);
			await client.query(
				'CREATE TRIGGER reject_flow_event BEFORE INSERT OR UPDATE ON kv_event_log_flows FOR EACH ROW EXECUTE FUNCTION reject_flow_event()',
			);
			const moderation = new GuildModerationRepository();
			const audit = {
				guild_id: createGuildID(BigInt(guild.id)),
				log_id: 123456789n,
				user_id: createUserID(BigInt(owner.userId)),
				target_id: '123',
				action_type: AuditLogActionType.ROLE_CREATE,
				reason: null,
				options: null,
				changes: null,
			};
			try {
				await expect(moderation.createAuditLog(audit)).rejects.toThrow();
				expect(await moderation.getAuditLog(audit.guild_id, audit.log_id)).toBeNull();
				await createBuilder(harness, owner.token)
					.patch(`/channels/${source.id}/messages/${message.id}`)
					.body({content: 'must roll back'})
					.expect(500)
					.execute();
				await createBuilder(harness, owner.token)
					.delete(`/channels/${source.id}/messages/${message.id}`)
					.expect(500)
					.execute();
				const messages = await getMessages(harness, owner.token, source.id);
				expect(messages.find((item) => item.id === message.id)?.content).toBe('before rollback');
				expect(
					(await repository.listPending()).some((item) =>
						['role_create', 'message_update', 'message_delete'].includes(item.kind),
					),
				).toBe(false);
			} finally {
				await client.query('DROP TRIGGER reject_flow_event ON kv_event_log_flows');
				await client.query('DROP FUNCTION reject_flow_event()');
			}
			await moderation.createAuditLog(audit);
			await flush(['role_create', 'message_create']);
		},
	);
	it('keeps metadata but excludes message text when capture is disabled', async () => {
		const state = await repository.getConfig(createGuildID(BigInt(guild.id)));
		await createBuilder(harness, owner.token)
			.put(`/guilds/${guild.id}/application-settings/event-logs`)
			.body({...state.settings, revision: state.revision, capture_message_content: false})
			.execute();
		const m1 = await sendMessage(harness, owner.token, source.id, 'private secret');
		const m2 = await sendMessage(harness, owner.token, source.id, 'second secret');
		await createBuilder(harness, owner.token)
			.patch(`/channels/${source.id}/messages/${m1.id}`)
			.body({content: 'edited secret'})
			.execute();
		await createBuilder(harness, owner.token)
			.post(`/channels/${source.id}/messages/bulk-delete`)
			.body({message_ids: [m1.id, m2.id]})
			.expect(204)
			.execute();
		for (const event of await repository.listPending()) expect(event.payload).not.toContain('secret');
		await flush(['message_create', 'message_update', 'message_bulk_delete']);
	});
	it('logs actual entrance-sound requests without storing audio URLs or archive data', async () => {
		const voice = await createChannel(harness, owner.token, guild.id, 'entrance voice', 2);
		const gateway = getGatewayService() as NoopGatewayService;
		gateway.setVoiceStatesForChannel({
			guildId: createGuildID(BigInt(guild.id)),
			channelId: createChannelID(BigInt(voice.id)),
			voiceStates: [{connectionId: 'test', userId: owner.userId, channelId: voice.id}],
		});
		await new EntranceSoundRepository().upsertSound(
			new EntranceSound({
				user_id: createUserID(BigInt(owner.userId)),
				sound_id: createEntranceSoundID(100n),
				name: 'test sound',
				hash: '0123456789abcdef',
				extension: 'wav',
				content_type: 'audio/wav',
				duration_ms: 500,
				size_bytes: 8044,
				created_at: new Date(),
				version: 1,
			}),
		);
		await createBuilder(harness, owner.token)
			.post(`/voice/channels/${voice.id}/entrance-sound`)
			.body({sound_id: '100'})
			.expect(204)
			.execute();
		const payload = JSON.parse(
			(await repository.listPending()).find((item) => item.kind === 'entrance_sound_play')!.payload!,
		);
		expect(payload.details).toEqual({duration_ms: '500', content_type: 'audio/wav'});
		expect(payload).not.toHaveProperty('url');
		await flush(['entrance_sound_play']);
	});
});
