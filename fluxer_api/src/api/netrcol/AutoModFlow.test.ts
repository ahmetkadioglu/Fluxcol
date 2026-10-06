// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount, type TestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {createGuildID, createUserID} from '@app/api/BrandedTypes';
import {authorizeBot, createTestBotAccount} from '@app/api/bot/tests/BotTestUtils';
import {Config} from '@app/api/Config';
import {loadFixture, sendMessageWithAttachments} from '@app/api/channel/tests/AttachmentTestUtils';
import {setCassandraQueryExecutorForTesting} from '@app/api/database/CassandraQueryExecution';
import {ensurePostgresKvSchema, PostgresKvQueryExecutor} from '@app/api/database/PostgresKvQueryExecutor';
import {getPngDataUrl} from '@app/api/emoji/tests/EmojiTestUtils';
import {GuildMemberEventService} from '@app/api/guild/services/member/GuildMemberEventService';
import {
	acceptInvite,
	addMemberRole,
	createChannel,
	createChannelInvite,
	createGuild,
	createRole,
	deleteRole,
	removeMemberRole,
	updateGuild,
	updateRole,
	updateRolePositions,
} from '@app/api/guild/tests/GuildTestUtils';
import {getMessages, sendMessage} from '@app/api/message/tests/MessageTestUtils';
import {ServiceMiddleware} from '@app/api/middleware/ServiceMiddleware';
import {getChannelRepository, getGuildRepository, getUserRepository} from '@app/api/middleware/ServiceSingletons';
import {AutoModProcessor} from '@app/api/netrcol/AutoModProcessor';
import {type AutoModJob, AutoModRepository, autoModKey} from '@app/api/netrcol/AutoModRepository';
import {AUTO_MOD_NUKE_ACTIONS} from '@app/api/netrcol/AutoModSources';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {NoopLogger} from '@app/api/test/mocks/NoopLogger';
import {TEST_CREDENTIALS} from '@app/api/test/TestConstants';
import {createBuilder, createBuilderWithoutAuth} from '@app/api/test/TestRequestBuilder';
import type {HonoEnv} from '@app/api/types/HonoEnv';
import {createWebhook, deleteWebhook, updateWebhook} from '@app/api/webhook/tests/WebhookTestUtils';
import processAutoMod from '@app/api/worker/tasks/ProcessAutoMod';
import {clearWorkerDependencies, setWorkerDependenciesForTest} from '@app/api/worker/WorkerContext';
import type {AutoModAction} from '@fluxer/constants/src/AutoModConstants';
import {MessageTypes} from '@fluxer/constants/src/ChannelConstants';
import type {ChannelResponse} from '@fluxer/schema/src/domains/channel/ChannelSchemas';
import type {GuildAuditLogListResponse} from '@fluxer/schema/src/domains/guild/GuildAuditLogSchemas';
import type {AutoModSettings, AutoModSettingsResponse} from '@fluxer/schema/src/domains/guild/GuildAutoModSchemas';
import {defaultAutoModPermissions, defaultAutoModSettings} from '@fluxer/schema/src/domains/guild/GuildAutoModSchemas';
import type {GuildStickerResponse} from '@fluxer/schema/src/domains/guild/GuildEmojiSchemas';
import type {GuildResponse} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';
import type {MessageResponse} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {getDefaultPostgresClient, initPostgres, shutdownPostgres} from '@pkgs/postgres/src/Client';
import {Hono} from 'hono';
import {afterAll, afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

describe('Actual Fluxer operations → AutoMod → moderation', () => {
	let harness: ApiTestHarness,
		owner: TestAccount,
		member: TestAccount,
		guild: GuildResponse,
		source: ChannelResponse,
		logs: ChannelResponse;
	const original = {
		selfHosted: Config.instance.selfHosted,
		backend: Config.database.backend,
	};
	const url = process.env.NETRCOL_TEST_POSTGRES_URL;
	const repository = new AutoModRepository();
	const path = () => `/guilds/${guild.id}/application-settings/automod`;
	beforeEach(async () => {
		Config.instance.selfHosted = original.selfHosted;
		Config.database.backend = original.backend;
		harness = await createApiTestHarness();
		if (url) {
			await initPostgres({url, kvTable: 'kv_automod_flow'});
			await ensurePostgresKvSchema(getDefaultPostgresClient());
			await getDefaultPostgresClient().query('TRUNCATE kv_automod_flow');
			setCassandraQueryExecutorForTesting(new PostgresKvQueryExecutor(getDefaultPostgresClient()));
		}
		owner = await createTestAccount(harness);
		member = await createTestAccount(harness);
		guild = await createGuild(harness, owner.token, 'Isolated AutoMod test');
		source = await createChannel(harness, owner.token, guild.id, 'source');
		logs = await createChannel(harness, owner.token, guild.id, 'automod');
		const invite = await createChannelInvite(harness, owner.token, source.id);
		await acceptInvite(harness, member.token, invite.code);
		Config.instance.selfHosted = true;
		Config.database.backend = 'postgres';
	});
	afterEach(async () => {
		vi.restoreAllMocks();
		clearWorkerDependencies();
		Config.instance.selfHosted = original.selfHosted;
		Config.database.backend = original.backend;
		delete process.env.NETRCOL_AUTOMATIONS_ENABLED;
		await harness.shutdown();
	});
	afterAll(async () => {
		if (url) await shutdownPostgres();
	});
	async function configure(change: (s: AutoModSettings) => void) {
		const s = defaultAutoModSettings();
		s.enabled = true;
		s.channel_id = logs.id;
		change(s);
		return await createBuilder<AutoModSettingsResponse>(harness, owner.token)
			.put(path())
			.body({...s, revision: 0})
			.execute();
	}
	async function flush() {
		const app = new Hono<HonoEnv>();
		app.use(ServiceMiddleware);
		app.get('/flush', async (ctx) => {
			const processor = new AutoModProcessor(
				{
					guildRepository: getGuildRepository(),
					channelRepository: getChannelRepository(),
					userRepository: getUserRepository(),
					guildService: ctx.get('guildService'),
					channelService: ctx.get('channelService'),
					snowflakeService: ctx.get('snowflakeService'),
				},
				repository,
			);
			let after: string | undefined;
			for (let page = 0; page < 10; page++) {
				const rows = await repository.pending(after);
				if (!rows.length) break;
				for (const row of rows) {
					after = row.id;
					const job = await repository.claim(row);
					if (job) await processor.process(row, job);
				}
				if (rows.length < 50) break;
			}
			return ctx.json({ok: true});
		});
		expect((await app.request('/flush')).status).toBe(200);
	}
	async function runWorker(
		payload: {ids?: Array<string>} = {},
		options: {cancel?: boolean; failDispatch?: boolean} = {},
	): Promise<{processed: number}> {
		const app = new Hono<HonoEnv>();
		app.use(ServiceMiddleware);
		app.get('/work', async (ctx) => {
			const channelService = ctx.get('channelService');
			setWorkerDependenciesForTest({
				guildRepository: getGuildRepository(),
				channelRepository: getChannelRepository(),
				userRepository: getUserRepository(),
				guildService: ctx.get('guildService'),
				channelService,
				snowflakeService: ctx.get('snowflakeService'),
			});
			if (options.failDispatch)
				vi.spyOn(channelService.messages.dispatch, 'dispatchMessageCreate').mockRejectedValueOnce(
					new Error('Injected gateway dispatch failure after message persistence'),
				);
			return ctx.json(
				await processAutoMod(payload, {
					logger: new NoopLogger(),
					jobId: 1n,
					addJob: async () => 1n,
					reportProgress: async () => {},
					shouldCancel: async () => options.cancel ?? false,
					setContextLink: async () => {},
				}),
			);
		});
		const response = await app.request('/work');
		expect(response.status).toBe(200);
		return (await response.json()) as {processed: number};
	}
	it('deletes the matching message, sends one native system embed, and does not loop or redeliver', async () => {
		await configure((s) => {
			s.rules.bad_words.action = 'delete_warn';
			s.rules.bad_words.words = ['forbidden'];
		});
		await sendMessage(harness, member.token, source.id, 'forbidden');
		await flush();
		await flush();
		expect(await getMessages(harness, owner.token, source.id)).toHaveLength(0);
		const messages = await getMessages(harness, owner.token, logs.id);
		expect(messages).toHaveLength(1);
		expect(messages[0]!.author.id).toBe('0');
		expect(messages[0]!.author.username).toBe('Netrcol');
		expect(messages[0]!.author.system).toBe(true);
		expect(messages[0]!.embeds![0]!.title).toBe('AutoMod');
		expect(messages[0]!.mentions).toEqual([]);
		expect(
			(await repository.history(createGuildID(BigInt(guild.id)))).some(
				(entry) => entry.status === 'applied' && entry.rules?.includes('bad_words'),
			),
		).toBe(true);
	});
	it('persists caps limits and deletes only messages above the percentage after meeting the minimum', async () => {
		const saved = await configure((settings) => {
			settings.rules.excessive_caps.action = 'delete';
			settings.rules.excessive_caps.minimum_length = 15;
			settings.rules.excessive_caps.threshold = 70;
		});
		expect(saved.settings.rules.excessive_caps.minimum_length).toBe(15);
		expect(saved.settings.rules.excessive_caps.threshold).toBe(70);
		const loaded = await createBuilder<AutoModSettingsResponse>(harness, owner.token).get(path()).execute();
		expect(loaded.settings.rules.excessive_caps).toEqual(saved.settings.rules.excessive_caps);
		const short = await sendMessage(harness, member.token, source.id, `${'A'.repeat(14)} 1234567890 😀`);
		const atLimit = await sendMessage(harness, member.token, source.id, 'A'.repeat(14) + 'a'.repeat(6));
		await sendMessage(harness, member.token, source.id, 'A'.repeat(15) + 'a'.repeat(5));
		await flush();
		expect((await getMessages(harness, owner.token, source.id)).map((message) => message.id).sort()).toEqual(
			[short.id, atLimit.id].sort(),
		);
		expect(
			(await repository.history(createGuildID(BigInt(guild.id)))).filter(
				(entry) => entry.status === 'applied' && entry.rules?.includes('excessive_caps'),
			),
		).toHaveLength(1);
	});
	it('persists the emoji limit and deletes only messages exceeding it, counting joined sequences once', async () => {
		const saved = await configure((settings) => {
			settings.rules.excessive_emojis.action = 'delete';
			settings.rules.excessive_emojis.threshold = 12;
		});
		expect(saved.settings.rules.excessive_emojis.threshold).toBe(12);
		const loaded = await createBuilder<AutoModSettingsResponse>(harness, owner.token).get(path()).execute();
		expect(loaded.settings.rules.excessive_emojis).toEqual(saved.settings.rules.excessive_emojis);
		const content = '👩‍👩‍👧‍👦👍🏽🇹🇷1️⃣'.repeat(3);
		const atLimit = await sendMessage(harness, member.token, source.id, content);
		await sendMessage(harness, member.token, source.id, `${content}😀`);
		await flush();
		await flush();
		expect((await getMessages(harness, owner.token, source.id)).map((message) => message.id)).toEqual([atLimit.id]);
		expect(
			(await repository.history(createGuildID(BigInt(guild.id)))).filter(
				(entry) => entry.status === 'applied' && entry.rules?.includes('excessive_emojis'),
			),
		).toHaveLength(1);
	});
	it('persists the spoiler limit and applies it to both new and edited messages without duplicate deletion', async () => {
		const saved = await configure((settings) => {
			settings.rules.excessive_spoilers.action = 'delete';
			settings.rules.excessive_spoilers.threshold = 7;
		});
		expect(saved.settings.rules.excessive_spoilers.threshold).toBe(7);
		const loaded = await createBuilder<AutoModSettingsResponse>(harness, owner.token).get(path()).execute();
		expect(loaded.settings.rules.excessive_spoilers).toEqual(saved.settings.rules.excessive_spoilers);
		const content = '||first line\nsecond line|| '.repeat(7);
		const atLimit = await sendMessage(harness, member.token, source.id, content);
		await sendMessage(harness, member.token, source.id, `${content}||extra||`);
		await flush();
		expect((await getMessages(harness, owner.token, source.id)).map((message) => message.id)).toEqual([atLimit.id]);
		await createBuilder(harness, member.token)
			.patch(`/channels/${source.id}/messages/${atLimit.id}`)
			.body({content: `${content}||extra||`})
			.execute();
		await flush();
		await flush();
		expect(await getMessages(harness, owner.token, source.id)).toHaveLength(0);
		expect(
			(await repository.history(createGuildID(BigInt(guild.id)))).filter(
				(entry) => entry.status === 'applied' && entry.rules?.includes('excessive_spoilers'),
			),
		).toHaveLength(2);
	});
	it('persists the mention limit, counts repeated tags once and applies to creates and edits without duplicates', async () => {
		const roles = [];
		for (let index = 0; index < 4; index++) {
			roles.push(
				await createRole(harness, owner.token, guild.id, {
					name: `Mention ${index}`,
				}),
			);
		}
		const saved = await configure((settings) => {
			settings.rules.excessive_mentions.action = 'delete';
			settings.rules.excessive_mentions.threshold = 7;
		});
		expect(saved.settings.rules.excessive_mentions.threshold).toBe(7);
		const loaded = await createBuilder<AutoModSettingsResponse>(harness, owner.token).get(path()).execute();
		expect(loaded.settings.rules.excessive_mentions).toEqual(saved.settings.rules.excessive_mentions);
		const content = [
			`<@${owner.userId}>`,
			`<@${member.userId}>`,
			...roles.slice(0, 3).map((role) => `<@&${role.id}>`),
			'@everyone',
			'@here',
			`<@${owner.userId}>`,
			'@here',
			`<@!${owner.userId}>`,
			`<@!${member.userId}>`,
		].join(' ');
		const atLimit = await sendMessage(harness, member.token, source.id, content);
		const aboveLimit = `${content} <@&${roles[3]!.id}>`;
		await sendMessage(harness, member.token, source.id, aboveLimit);
		await flush();
		expect((await getMessages(harness, owner.token, source.id)).map((message) => message.id)).toEqual([atLimit.id]);
		await createBuilder(harness, member.token)
			.patch(`/channels/${source.id}/messages/${atLimit.id}`)
			.body({content: aboveLimit})
			.execute();
		await flush();
		await flush();
		expect(await getMessages(harness, owner.token, source.id)).toHaveLength(0);
		expect(
			(await repository.history(createGuildID(BigInt(guild.id)))).filter(
				(entry) => entry.status === 'applied' && entry.rules?.includes('excessive_mentions'),
			),
		).toHaveLength(2);
	});
	it('retains Zalgo sensitivity and scope, moderates creates and edits, and leaves ordinary accents intact', async () => {
		const saved = await configure((settings) => {
			settings.rules.zalgo.action = 'delete';
			settings.rules.zalgo.threshold = 5;
			settings.rules.zalgo.permissions = {
				...defaultAutoModPermissions(),
				users: {mode: 'include', ids: [member.userId]},
				channels: {mode: 'include', ids: [source.id]},
			};
		});
		const loaded = await createBuilder<AutoModSettingsResponse>(harness, owner.token).get(path()).execute();
		expect(loaded.settings.rules.zalgo).toEqual(saved.settings.rules.zalgo);
		expect(loaded.settings.rules.zalgo.threshold).toBe(5);
		const content = `Z${'\u0301'.repeat(5)}`;
		const atLimit = await sendMessage(harness, member.token, source.id, content);
		const accents = await sendMessage(harness, member.token, source.id, 'e\u0301'.repeat(12));
		const aboveLimit = `${content}\u0301`;
		await sendMessage(harness, member.token, source.id, aboveLimit);
		await flush();
		expect((await getMessages(harness, owner.token, source.id)).map((message) => message.id).sort()).toEqual(
			[atLimit.id, accents.id].sort(),
		);
		await createBuilder(harness, member.token)
			.patch(`/channels/${source.id}/messages/${atLimit.id}`)
			.body({content: aboveLimit})
			.execute();
		await flush();
		await flush();
		expect((await getMessages(harness, owner.token, source.id)).map((message) => message.id)).toEqual([accents.id]);
		expect(
			(await repository.history(createGuildID(BigInt(guild.id)))).filter(
				(entry) => entry.status === 'applied' && entry.rules?.includes('zalgo'),
			),
		).toHaveLength(2);
	});
	it('persists maximum characters and four rule scopes, preserving exact-length Unicode messages and deleting only longer creates and edits', async () => {
		const role = await createRole(harness, owner.token, guild.id, {name: 'Role exception'});
		await addMemberRole(harness, owner.token, guild.id, member.userId, role.id);
		const category = await createChannel(harness, owner.token, guild.id, 'Scoped category', 4);
		await createBuilder(harness, owner.token).patch(`/channels/${source.id}`).body({parent_id: category.id}).execute();
		const saved = await configure((settings) => {
			settings.rules.character_limit.action = 'delete';
			settings.rules.character_limit.threshold = 500;
			settings.rules.character_limit.permissions = {
				users: {mode: 'include', ids: [member.userId]},
				roles: {mode: 'exclude', ids: [role.id]},
				channels: {mode: 'include', ids: [source.id]},
				categories: {mode: 'include', ids: [category.id]},
			};
		});
		const loaded = await createBuilder<AutoModSettingsResponse>(harness, owner.token).get(path()).execute();
		expect(loaded.settings.rules.character_limit).toEqual(saved.settings.rules.character_limit);
		expect(loaded.settings.rules.bad_words).toEqual(defaultAutoModSettings().rules.bad_words);
		const atLimit = await sendMessage(harness, member.token, source.id, '😀'.repeat(500));
		await flush();
		expect((await getMessages(harness, owner.token, source.id)).map((message) => message.id)).toEqual([atLimit.id]);
		expect(await getMessages(harness, owner.token, logs.id)).toHaveLength(0);
		const outside = await sendMessage(harness, member.token, logs.id, 'x'.repeat(501));
		await sendMessage(harness, member.token, source.id, 'x'.repeat(501));
		await flush();
		await flush();
		expect((await getMessages(harness, owner.token, source.id)).map((message) => message.id)).toEqual([atLimit.id]);
		expect(
			(await getMessages(harness, owner.token, logs.id)).filter((message) => message.author.id === '0'),
		).toHaveLength(1);
		await createBuilder(harness, member.token)
			.patch(`/channels/${source.id}/messages/${atLimit.id}`)
			.body({content: '😀'.repeat(501)})
			.execute();
		await flush();
		await flush();
		expect(await getMessages(harness, owner.token, source.id)).toHaveLength(0);
		const deliveries = await getMessages(harness, owner.token, logs.id);
		expect(deliveries.some((message) => message.id === outside.id)).toBe(true);
		expect(deliveries.filter((message) => message.author.id === '0')).toHaveLength(2);
		expect(
			(await repository.history(createGuildID(BigInt(guild.id)))).filter(
				(entry) => entry.status === 'applied' && entry.rules?.includes('character_limit'),
			),
		).toHaveLength(2);
	});
	it('evaluates edits and observes without deleting or warning', async () => {
		await configure((s) => {
			s.rules.character_limit.action = 'observe';
			s.rules.character_limit.threshold = 10;
		});
		const message = await sendMessage(harness, member.token, source.id, 'short');
		await flush();
		await createBuilder(harness, member.token)
			.patch(`/channels/${source.id}/messages/${message.id}`)
			.body({content: 'longer than ten'})
			.execute();
		await flush();
		expect(await getMessages(harness, owner.token, source.id)).toHaveLength(1);
		expect(await getMessages(harness, owner.token, logs.id)).toHaveLength(0);
		expect(
			(await repository.history(createGuildID(BigInt(guild.id)))).some((entry) => entry.status === 'observed'),
		).toBe(true);
	});
	it('persists a shared URL whitelist and deletes only nonmatching invites through the actual message pipeline', async () => {
		const saved = await configure((settings) => {
			settings.link_whitelist = ['https://fluxer.app/invite/Allowed'];
			settings.rules.server_invites.action = 'delete';
			settings.rules.external_links.action = 'delete';
			settings.rules.server_invites.permissions = {
				...defaultAutoModPermissions(),
				channels: {mode: 'include', ids: [source.id]},
			};
		});
		expect(saved.settings.link_whitelist).toEqual(['https://fluxer.app/invite/Allowed']);
		const allowed = await sendMessage(harness, member.token, source.id, 'https://fluxer.app/invite/Allowed123');
		await flush();
		expect(await getMessages(harness, owner.token, logs.id)).toHaveLength(0);
		await sendMessage(harness, member.token, source.id, 'https://fluxer.app/invite/allowed123');
		await flush();
		const messages = await getMessages(harness, owner.token, source.id);
		expect(messages.map((message) => message.id)).toEqual([allowed.id]);
		expect(await getMessages(harness, owner.token, logs.id)).toHaveLength(1);
	});
	it('leaves a corrected message intact when an older queued check arrives', async () => {
		await configure((s) => {
			s.rules.bad_words.action = 'delete_warn';
			s.rules.bad_words.words = ['forbidden'];
		});
		const message = await sendMessage(harness, member.token, source.id, 'forbidden');
		await createBuilder(harness, member.token)
			.patch(`/channels/${source.id}/messages/${message.id}`)
			.body({content: 'corrected'})
			.execute();
		await flush();
		expect((await getMessages(harness, owner.token, source.id))[0]!.content).toBe('corrected');
		expect(await getMessages(harness, owner.token, logs.id)).toHaveLength(0);
	});
	it('persists a 600-second anti-spam window and counts new messages across only its selected channels', async () => {
		const second = await createChannel(harness, owner.token, guild.id, 'second-source');
		const saved = await configure((settings) => {
			settings.rules.anti_spam.action = 'delete';
			settings.rules.anti_spam.threshold = 3;
			settings.rules.anti_spam.window_seconds = 600;
			settings.rules.anti_spam.permissions = {
				...defaultAutoModPermissions(),
				users: {mode: 'include', ids: [member.userId]},
				channels: {mode: 'include', ids: [source.id, second.id]},
			};
		});
		const loaded = await createBuilder<AutoModSettingsResponse>(harness, owner.token).get(path()).execute();
		expect(loaded.settings.rules.anti_spam).toEqual(saved.settings.rules.anti_spam);
		const first = await sendMessage(harness, member.token, source.id, 'first');
		await flush();
		await createBuilder(harness, member.token)
			.patch(`/channels/${source.id}/messages/${first.id}`)
			.body({content: 'edited first'})
			.execute();
		await sendMessage(harness, member.token, logs.id, 'outside scope');
		await flush();
		const other = await sendMessage(harness, member.token, second.id, 'second');
		await flush();
		expect((await getMessages(harness, owner.token, second.id)).map((message) => message.id)).toEqual([other.id]);
		await sendMessage(harness, member.token, source.id, 'third reaches limit');
		await flush();
		await flush();
		expect((await getMessages(harness, owner.token, source.id)).map((message) => message.content)).toEqual([
			'edited first',
		]);
		const deliveries = await getMessages(harness, owner.token, logs.id);
		expect(deliveries.filter((message) => message.author.id === '0')).toHaveLength(1);
		expect(deliveries.some((message) => message.content === 'outside scope')).toBe(true);
		expect(
			(await repository.history(createGuildID(BigInt(guild.id)))).filter(
				(entry) => entry.status === 'applied' && entry.rules?.includes('anti_spam'),
			),
		).toHaveLength(1);
	});
	it('counts attachments and stickers across selected channels, ignores edits and plain links, and delivers once', async () => {
		const second = await createChannel(harness, owner.token, guild.id, 'second-source');
		const sticker = await createBuilder<GuildStickerResponse>(harness, owner.token)
			.post(`/guilds/${guild.id}/stickers`)
			.body({name: 'media_test', description: 'media test', tags: [], image: getPngDataUrl()})
			.execute();
		const saved = await configure((settings) => {
			settings.rules.media_spam.action = 'delete';
			settings.rules.media_spam.threshold = 3;
			settings.rules.media_spam.window_seconds = 600;
			settings.rules.media_spam.permissions = {
				...defaultAutoModPermissions(),
				users: {mode: 'include', ids: [member.userId]},
				channels: {mode: 'include', ids: [source.id, second.id]},
			};
		});
		const loaded = await createBuilder<AutoModSettingsResponse>(harness, owner.token).get(path()).execute();
		expect(loaded.settings.rules.media_spam).toEqual(saved.settings.rules.media_spam);
		const files = [0, 1].map((index) => ({index, filename: `media-${index}.png`, data: loadFixture('yeah.png')}));
		const first = await sendMessageWithAttachments(
			harness,
			member.token,
			source.id,
			{content: 'two files', attachments: files.map((file) => ({id: file.index, filename: file.filename}))},
			files,
		);
		expect(first.response.status, first.text).toBe(200);
		expect(first.json.attachments).toHaveLength(2);
		await flush();
		expect(await getMessages(harness, owner.token, logs.id)).toHaveLength(0);
		await createBuilder(harness, member.token)
			.patch(`/channels/${source.id}/messages/${first.json.id}`)
			.body({content: 'edited two files'})
			.execute();
		const plain = await sendMessage(harness, member.token, source.id, 'https://example.org/image.png 😀');
		await createBuilder<MessageResponse>(harness, member.token)
			.post(`/channels/${logs.id}/messages`)
			.body({content: 'outside scope', sticker_ids: [sticker.id]})
			.execute();
		await flush();
		expect((await getMessages(harness, owner.token, source.id)).map((message) => message.id)).toContain(first.json.id);
		expect(
			(await getMessages(harness, owner.token, logs.id)).filter((message) => message.author.id === '0'),
		).toHaveLength(0);
		const third = await createBuilder<MessageResponse>(harness, member.token)
			.post(`/channels/${second.id}/messages`)
			.body({sticker_ids: [sticker.id]})
			.execute();
		expect(third.stickers).toHaveLength(1);
		await flush();
		await flush();
		expect(await getMessages(harness, owner.token, second.id)).toHaveLength(0);
		expect((await getMessages(harness, owner.token, source.id)).map((message) => message.id).sort()).toEqual(
			[first.json.id, plain.id].sort(),
		);
		const deliveries = await getMessages(harness, owner.token, logs.id);
		const notifications = deliveries.filter((message) => message.author.id === '0');
		expect(notifications).toHaveLength(1);
		expect(notifications[0]!.author.username).toBe('Netrcol');
		expect(notifications[0]!.embeds![0]!.title).toBe('AutoMod');
		expect(deliveries.some((message) => message.content === 'outside scope')).toBe(true);
		expect(
			(await repository.history(createGuildID(BigInt(guild.id)))).filter(
				(entry) => entry.status === 'applied' && entry.rules?.includes('media_spam'),
			),
		).toHaveLength(1);
	});
	it('applies timeout using the native guild service', async () => {
		await configure((s) => {
			s.rules.external_links.action = 'delete_timeout';
		});
		await sendMessage(harness, member.token, source.id, 'https://example.org');
		await flush();
		const row = await getGuildRepository().getMember(
			createGuildID(BigInt(guild.id)),
			createUserID(BigInt(member.userId)),
		);
		expect(row!.communicationDisabledUntil!.getTime()).toBeGreaterThan(Date.now());
		expect(await getMessages(harness, owner.token, source.id)).toHaveLength(0);
	});
	it('honors channel exceptions and protects the owner', async () => {
		await configure((s) => {
			s.rules.character_limit.action = 'delete';
			s.rules.character_limit.threshold = 1;
			s.exempt_channel_ids = [source.id];
		});
		await sendMessage(harness, member.token, source.id, 'exempt');
		await sendMessage(harness, owner.token, logs.id, 'owner');
		await flush();
		expect(await getMessages(harness, owner.token, source.id)).toHaveLength(1);
		expect(await getMessages(harness, owner.token, logs.id)).toHaveLength(1);
	});
	it('persists partial-only words and applies independent user permissions over a role exemption', async () => {
		const role = await createRole(harness, owner.token, guild.id, {
			name: 'Exempt',
		});
		await addMemberRole(harness, owner.token, guild.id, member.userId, role.id);
		await configure((s) => {
			s.exempt_role_ids = [role.id];
			s.rules.bad_words.action = 'delete';
			s.rules.bad_words.partial_words = ['how'];
			s.rules.bad_words.permissions = {
				...defaultAutoModPermissions(),
				users: {mode: 'include', ids: [member.userId]},
				roles: {mode: 'exclude', ids: [role.id]},
			};
		});
		const saved = await createBuilder<AutoModSettingsResponse>(harness, owner.token).get(path()).execute();
		expect(saved.settings.rules.bad_words.words).toEqual([]);
		expect(saved.settings.rules.bad_words.partial_words).toEqual(['how']);
		await sendMessage(harness, member.token, source.id, 'SHOWCASE');
		await sendMessage(harness, owner.token, source.id, 'owner showcase');
		await flush();
		expect((await getMessages(harness, owner.token, source.id)).map((m) => m.content)).toEqual(['owner showcase']);
	});
	it('uses category scope from the native channel parent and still honors explicit user exemptions', async () => {
		const category = await createChannel(harness, owner.token, guild.id, 'Protected category', 4);
		await createBuilder(harness, owner.token).patch(`/channels/${source.id}`).body({parent_id: category.id}).execute();
		await configure((s) => {
			s.rules.bad_words.action = 'delete';
			s.rules.bad_words.words = ['forbidden'];
			s.permissions = {
				...defaultAutoModPermissions(),
				categories: {mode: 'include', ids: [category.id]},
			};
		});
		const saved = await createBuilder<AutoModSettingsResponse>(harness, owner.token).get(path()).execute();
		expect(saved.categories.some((c) => c.id === category.id)).toBe(true);
		await sendMessage(harness, member.token, source.id, 'forbidden');
		await sendMessage(harness, member.token, logs.id, 'forbidden outside category');
		await flush();
		expect(await getMessages(harness, owner.token, source.id)).toHaveLength(0);
		expect(
			(await getMessages(harness, owner.token, logs.id)).some((m) => m.content === 'forbidden outside category'),
		).toBe(true);
		await createBuilder(harness, owner.token)
			.put(path())
			.body({
				...saved.settings,
				permissions: {
					...saved.settings.permissions!,
					users: {mode: 'exclude', ids: [member.userId]},
				},
				revision: saved.revision,
			})
			.execute();
		await sendMessage(harness, member.token, source.id, 'forbidden exempt user');
		await flush();
		expect((await getMessages(harness, owner.token, source.id))[0]!.content).toBe('forbidden exempt user');
	});
	it('rejects scopes from another community and IDs that are not current members', async () => {
		const other = await createGuild(harness, owner.token, 'Other community');
		const category = await createChannel(harness, owner.token, other.id, 'Foreign category', 4);
		const settings = defaultAutoModSettings();
		for (const permissions of [
			{
				...defaultAutoModPermissions(),
				categories: {mode: 'include', ids: [category.id]},
			},
			{
				...defaultAutoModPermissions(),
				users: {mode: 'include', ids: ['99999999999999']},
			},
		])
			await createBuilder(harness, owner.token)
				.put(path())
				.body({...settings, permissions, revision: 0})
				.expect(400)
				.execute();
	});
	it('accepts native voice-channel chat in scope while keeping notification channels text-only', async () => {
		const voice = await createChannel(harness, owner.token, guild.id, 'Voice chat', 2);
		const settings = defaultAutoModSettings();
		settings.exempt_channel_ids = [voice.id];
		settings.permissions = {
			...defaultAutoModPermissions(),
			channels: {mode: 'exclude', ids: [voice.id]},
		};
		const saved = await createBuilder<AutoModSettingsResponse>(harness, owner.token)
			.put(path())
			.body({...settings, revision: 0})
			.execute();
		expect(saved.scope_channels.some((channel) => channel.id === voice.id)).toBe(true);
		await createBuilder(harness, owner.token)
			.put(path())
			.body({
				...saved.settings,
				channel_id: voice.id,
				revision: saved.revision,
			})
			.expect(400)
			.execute();
	});
	it('pauses queued moderation when settings change', async () => {
		const config = await configure((s) => {
			s.rules.character_limit.action = 'delete';
			s.rules.character_limit.threshold = 1;
		});
		await sendMessage(harness, member.token, source.id, 'retained');
		await createBuilder(harness, owner.token)
			.put(path())
			.body({...config.settings, enabled: false, revision: config.revision})
			.execute();
		await flush();
		expect(await getMessages(harness, owner.token, source.id)).toHaveLength(1);
	});
	it('enforces ownership, rejects stale revisions, and simulates without side effects', async () => {
		const config = await configure((s) => {
			s.rules.character_limit.action = 'delete';
			s.rules.character_limit.threshold = 1;
		});
		await createBuilder(harness, member.token).get(path()).expect(403).execute();
		await createBuilder(harness, owner.token)
			.put(path())
			.body({...config.settings, revision: 0})
			.expect(409)
			.execute();
		const preview = await createBuilder<{rules: Array<string>}>(harness, owner.token)
			.post(`${path()}/simulate`)
			.body({content: 'sample'})
			.execute();
		expect(preview.rules).toEqual(['character_limit']);
		expect(await getMessages(harness, owner.token, logs.id)).toHaveLength(0);
	});
	it('completes a join when the worker locks the community before its native join announcement', async () => {
		await createBuilder(harness, owner.token)
			.patch(`/guilds/${guild.id}`)
			.body({system_channel_id: source.id, system_channel_flags: 0})
			.execute();
		await configure((s) => {
			s.rules.anti_raid.action = 'lockdown';
			s.rules.anti_raid.threshold = 1;
		});
		const invite = await createChannelInvite(harness, owner.token, source.id);
		const newcomer = await createTestAccount(harness);
		const dispatch = GuildMemberEventService.prototype.dispatchGuildMemberAdd;
		vi.spyOn(GuildMemberEventService.prototype, 'dispatchGuildMemberAdd').mockImplementation(async function (
			this: GuildMemberEventService,
			...args: Parameters<GuildMemberEventService['dispatchGuildMemberAdd']>
		) {
			await dispatch.apply(this, args);
			// Reproduce the deployed worker waking immediately after the membership commit.
			await runWorker();
		});
		await acceptInvite(harness, newcomer.token, invite.code);
		await createBuilder(harness, owner.token).get(`/guilds/${guild.id}/members/${newcomer.userId}`).execute();
		const announcements = await getMessages(harness, owner.token, source.id);
		expect(announcements).toHaveLength(1);
		expect(announcements[0]!.type).toBe(MessageTypes.USER_JOIN);
		expect(announcements[0]!.author.id).toBe(newcomer.userId);
		expect(await repository.pending()).toHaveLength(0);
		const guildId = createGuildID(BigInt(guild.id));
		expect(await repository.holdUntil(guildId, 'raid_hold', await repository.config(guildId))).toBeGreaterThan(
			Date.now(),
		);
		expect((await repository.history(guildId)).filter((entry) => entry.rules?.includes('anti_raid'))).toHaveLength(1);
		expect(await getMessages(harness, owner.token, logs.id)).toHaveLength(1);
		await createBuilder(harness, newcomer.token)
			.post(`/channels/${source.id}/messages`)
			.body({content: 'still blocked during lockdown'})
			.expect(403)
			.execute();
	});
	it('keeps native join announcements out of member spam counters', async () => {
		await createBuilder(harness, owner.token)
			.patch(`/guilds/${guild.id}`)
			.body({system_channel_id: source.id, system_channel_flags: 0})
			.execute();
		await configure((s) => {
			s.rules.anti_spam.action = 'delete';
			s.rules.anti_spam.threshold = 2;
		});
		const newcomer = await createTestAccount(harness);
		const invite = await createChannelInvite(harness, owner.token, source.id);
		await acceptInvite(harness, newcomer.token, invite.code);
		const first = await sendMessage(harness, newcomer.token, source.id, 'first user message');
		await flush();
		const retained = await getMessages(harness, owner.token, source.id);
		expect(retained.some((message) => message.type === MessageTypes.USER_JOIN)).toBe(true);
		expect(retained.some((message) => message.id === first.id)).toBe(true);
		const second = await sendMessage(harness, newcomer.token, source.id, 'second user message');
		await flush();
		expect((await getMessages(harness, owner.token, source.id)).some((message) => message.id === second.id)).toBe(
			false,
		);
	});
	it('continues to moderate real replies after excluding native system announcements', async () => {
		const originalMessage = await sendMessage(harness, owner.token, source.id, 'reply target');
		await configure((s) => {
			s.rules.bad_words.action = 'delete';
			s.rules.bad_words.words = ['forbidden'];
		});
		const reply = await createBuilder<MessageResponse>(harness, member.token)
			.post(`/channels/${source.id}/messages`)
			.body({content: 'forbidden', message_reference: {message_id: originalMessage.id}})
			.execute();
		expect(reply.type).toBe(MessageTypes.REPLY);
		await runWorker();
		expect((await getMessages(harness, owner.token, source.id)).map((message) => message.id)).toEqual([
			originalMessage.id,
		]);
	});
	it('locks joins and non-owner messages after an actual join burst', async () => {
		const config = await configure((s) => {
			s.rules.anti_raid.action = 'lockdown';
			s.rules.anti_raid.threshold = 2;
			s.rules.anti_raid.new_account_days = 7;
		});
		expect(
			(await createBuilder<AutoModSettingsResponse>(harness, owner.token).get(path()).execute()).settings.rules
				.anti_raid.new_account_days,
		).toBe(7);
		const invite = await createChannelInvite(harness, owner.token, source.id);
		const joined: Array<string> = [];
		for (let n = 0; n < 2; n++) {
			const account = await createTestAccount(harness);
			joined.push(account.userId);
			await acceptInvite(harness, account.token, invite.code);
		}
		await flush();
		await flush();
		const guildId = createGuildID(BigInt(guild.id));
		const samples = await repository.record(guildId, `window:${config.revision}:join:guild`);
		expect(
			JSON.parse(samples!.value)
				.map((sample: {user_id: string}) => sample.user_id)
				.sort(),
		).toEqual(joined.sort());
		expect(
			(await repository.history(guildId)).filter(
				(entry) => entry.status === 'applied' && entry.rules?.includes('anti_raid'),
			),
		).toHaveLength(1);
		const notifications = await getMessages(harness, owner.token, logs.id);
		expect(notifications).toHaveLength(1);
		expect(notifications[0]!.author.username).toBe('Netrcol');
		await createBuilder(harness, member.token)
			.post(`/channels/${source.id}/messages`)
			.body({content: 'blocked'})
			.expect(403)
			.execute();
		const newcomer = await createTestAccount(harness);
		await createBuilder(harness, newcomer.token).post(`/invites/${invite.code}`).expect(403).execute();
		await sendMessage(harness, owner.token, source.id, 'owner can recover');
	});
	it('quarantines a rapid administrative actor while keeping owner recovery available', async () => {
		const role = await createRole(harness, owner.token, guild.id, {
			name: 'administrator',
		});
		await updateRole(harness, owner.token, guild.id, role.id, {
			permissions: '8',
		});
		await addMemberRole(harness, owner.token, guild.id, member.userId, role.id);
		const config = await configure((s) => {
			s.rules.anti_nuke.action = 'lockdown';
			s.rules.anti_nuke.threshold = 2;
			s.rules.anti_nuke.window_seconds = 30;
			s.rules.anti_nuke.log_only = true;
		});
		await createChannel(harness, member.token, guild.id, 'burst-one');
		await createChannel(harness, member.token, guild.id, 'burst-two');
		await flush();
		await flush();
		const guildId = createGuildID(BigInt(guild.id));
		expect(await repository.holdUntil(guildId, `nuke_hold:${member.userId}`, await repository.config(guildId))).toBe(0);
		const observed = await repository.history(guildId);
		expect(observed.filter((entry) => entry.status === 'observed')).toHaveLength(1);
		expect(observed.find((entry) => entry.status === 'observed')!.actions).toEqual(['observe']);
		expect(await getMessages(harness, owner.token, logs.id)).toHaveLength(0);
		await createChannel(harness, member.token, guild.id, 'log-only-allows-this');
		const enforced = await createBuilder<AutoModSettingsResponse>(harness, owner.token)
			.put(path())
			.body({
				...config.settings,
				revision: config.revision,
				rules: {...config.settings.rules, anti_nuke: {...config.settings.rules.anti_nuke, log_only: false}},
			})
			.execute();
		expect(enforced.settings.rules.anti_nuke.log_only).toBe(false);
		expect(enforced.settings.rules.anti_nuke.window_seconds).toBe(30);
		await createChannel(harness, member.token, guild.id, 'enforce-one');
		await createChannel(harness, member.token, guild.id, 'enforce-two');
		await flush();
		await flush();
		const history = await repository.history(guildId);
		expect(history.filter((entry) => entry.status === 'applied')).toHaveLength(1);
		expect(history.find((entry) => entry.status === 'applied')!.actions).toEqual(['lockdown']);
		const notifications = await getMessages(harness, owner.token, logs.id);
		expect(notifications).toHaveLength(1);
		expect(notifications[0]!.author.username).toBe('Netrcol');
		await createBuilder(harness, member.token)
			.post(`/guilds/${guild.id}/channels`)
			.body({name: 'blocked', type: 0})
			.expect(403)
			.execute();
		await createChannel(harness, owner.token, guild.id, 'owner-recovery');
	});
	it('honors role exceptions and the bot exclusion setting', async () => {
		const role = await createRole(harness, owner.token, guild.id, {
			name: 'exempt',
		});
		await addMemberRole(harness, owner.token, guild.id, member.userId, role.id);
		const config = await configure((s) => {
			s.rules.character_limit.action = 'delete';
			s.rules.character_limit.threshold = 1;
			s.exempt_role_ids = [role.id];
		});
		await sendMessage(harness, member.token, source.id, 'role exempt');
		await flush();
		expect(await getMessages(harness, owner.token, source.id)).toHaveLength(1);
		await createBuilderWithoutAuth(harness)
			.post(`/test/users/${member.userId}/set-bot-flag`)
			.body({is_bot: true})
			.execute();
		const response = await createBuilder<AutoModSettingsResponse>(harness, owner.token)
			.put(path())
			.body({
				...config.settings,
				exempt_role_ids: [],
				revision: config.revision,
			})
			.execute();
		await sendMessage(harness, member.token, source.id, 'bot exempt');
		await flush();
		expect(await getMessages(harness, owner.token, source.id)).toHaveLength(2);
		await createBuilder(harness, owner.token)
			.put(path())
			.body({
				...response.settings,
				ignore_bots: false,
				revision: response.revision,
			})
			.execute();
		await sendMessage(harness, member.token, source.id, 'moderated bot');
		await flush();
		expect(await getMessages(harness, owner.token, source.id)).toHaveLength(2);
	});
	it('counts normalized repeated messages across scoped channels, but not other users, edits or exempt channels', async () => {
		const second = await createChannel(harness, owner.token, guild.id, 'second');
		const other = await createTestAccount(harness);
		const invite = await createChannelInvite(harness, owner.token, source.id);
		await acceptInvite(harness, other.token, invite.code);
		await configure((s) => {
			s.rules.repeated_text.action = 'delete_warn';
			s.rules.repeated_text.threshold = 3;
			s.rules.repeated_text.permissions = {
				...defaultAutoModPermissions(),
				channels: {mode: 'include', ids: [source.id, second.id]},
			};
		});
		const first = await sendMessage(harness, member.token, source.id, 'same text');
		await runWorker();
		await sendMessage(harness, other.token, source.id, 'same text');
		await sendMessage(harness, member.token, logs.id, 'same text');
		await createBuilder(harness, member.token)
			.patch(`/channels/${source.id}/messages/${first.id}`)
			.body({content: 'SAME TEXT'})
			.execute();
		await runWorker();
		const secondMessage = await sendMessage(harness, member.token, second.id, 'same\u200b  text');
		await runWorker();
		expect((await getMessages(harness, owner.token, second.id)).map((m) => m.id)).toEqual([secondMessage.id]);
		await sendMessage(harness, member.token, source.id, 'SAME   TEXT');
		await runWorker();
		await runWorker();
		expect(await getMessages(harness, owner.token, source.id)).toHaveLength(2);
		expect((await getMessages(harness, owner.token, logs.id)).filter((m) => m.author.id === '0')).toHaveLength(1);
		expect(
			(await repository.history(createGuildID(BigInt(guild.id)))).find((e) => e.status === 'applied')!.rules,
		).toEqual(['repeated_text']);
	});
	it.each<AutoModAction>(['disabled', 'observe', 'warn', 'delete', 'delete_warn', 'timeout', 'delete_timeout'])(
		'executes the %s action with the correct native message, timeout and notification outcome',
		async (action) => {
			await configure((s) => {
				s.rules.bad_words.action = action;
				s.rules.bad_words.words = ['forbidden'];
				// Keep the module enabled while testing an individually disabled rule.
				if (action === 'disabled') s.rules.character_limit.action = 'observe';
			});
			const message = await sendMessage(harness, member.token, source.id, 'forbidden');
			await runWorker();
			await runWorker();
			const deletes = ['delete', 'delete_warn', 'delete_timeout'].includes(action);
			const timesOut = ['timeout', 'delete_timeout'].includes(action);
			expect((await getMessages(harness, owner.token, source.id)).map((m) => m.id)).toEqual(
				deletes ? [] : [message.id],
			);
			const current = await getGuildRepository().getMember(
				createGuildID(BigInt(guild.id)),
				createUserID(BigInt(member.userId)),
			);
			expect((current!.communicationDisabledUntil?.getTime() ?? 0) > Date.now()).toBe(timesOut);
			const notices = await getMessages(harness, owner.token, logs.id);
			expect(notices).toHaveLength(['disabled', 'observe'].includes(action) ? 0 : 1);
			for (const notice of notices) {
				expect(notice.author.username).toBe('Netrcol');
				expect(notice.author.system).toBe(true);
				expect(notice.mentions).toEqual([]);
				expect(JSON.stringify(notice.embeds)).not.toContain('forbidden');
			}
			const history = (await repository.history(createGuildID(BigInt(guild.id)))).filter((e) =>
				e.rules?.includes('bad_words'),
			);
			expect(history).toHaveLength(action === 'disabled' ? 0 : 1);
			if (history.length) expect(history[0]!.status).toBe(action === 'observe' ? 'observed' : 'applied');
		},
	);
	it('combines matching rules into one deletion, one timeout and one system notification', async () => {
		await configure((s) => {
			s.rules.bad_words.action = 'delete_warn';
			s.rules.bad_words.words = ['forbidden'];
			s.rules.external_links.action = 'delete_timeout';
			s.rules.character_limit.action = 'warn';
			s.rules.character_limit.threshold = 5;
		});
		await sendMessage(harness, member.token, source.id, 'forbidden https://example.org');
		await runWorker();
		await runWorker();
		expect(await getMessages(harness, owner.token, source.id)).toHaveLength(0);
		expect(await getMessages(harness, owner.token, logs.id)).toHaveLength(1);
		const history = (await repository.history(createGuildID(BigInt(guild.id)))).filter((e) => e.status === 'applied');
		expect(history).toHaveLength(1);
		expect(history[0]!.rules).toEqual(['bad_words', 'external_links', 'character_limit']);
		const current = await getGuildRepository().getMember(
			createGuildID(BigInt(guild.id)),
			createUserID(BigInt(member.userId)),
		);
		expect(current!.communicationDisabledUntil!.getTime()).toBeGreaterThan(Date.now());
	});
	it('does not shorten a longer existing timeout when a queued violation is processed', async () => {
		await configure((s) => {
			s.rules.bad_words.action = 'delete_timeout';
			s.rules.bad_words.words = ['forbidden'];
		});
		await sendMessage(harness, member.token, source.id, 'forbidden');
		const until = new Date(Date.now() + 3600000).toISOString();
		await createBuilder(harness, owner.token)
			.patch(`/guilds/${guild.id}/members/${member.userId}`)
			.body({communication_disabled_until: until})
			.execute();
		await runWorker();
		const current = await getGuildRepository().getMember(
			createGuildID(BigInt(guild.id)),
			createUserID(BigInt(member.userId)),
		);
		expect(current!.communicationDisabledUntil!.toISOString()).toBe(until);
		expect(await getMessages(harness, owner.token, source.id)).toHaveLength(0);
	});
	it('allows exact and subdomain exceptions, blocks lookalike domains and checks edited external links', async () => {
		await configure((s) => {
			s.rules.external_links.action = 'delete';
			s.rules.external_links.allowed_domains = ['example.org'];
			s.link_whitelist = ['https://other.test/Allowed/'];
		});
		for (const content of [
			'https://example.org',
			'https://docs.example.org/help',
			'https://other.test/Allowed/page',
			'plain text',
		]) {
			await sendMessage(harness, member.token, source.id, content);
			await runWorker();
		}
		for (const content of [
			'https://example.org.evil.test',
			'https://notexample.org',
			'https://other.test/allowed/page',
			'www.evil.test',
		]) {
			await sendMessage(harness, member.token, source.id, content);
			await runWorker();
		}
		expect(await getMessages(harness, owner.token, source.id)).toHaveLength(4);
		const message = await sendMessage(harness, member.token, source.id, 'initially safe');
		await runWorker();
		await createBuilder(harness, member.token)
			.patch(`/channels/${source.id}/messages/${message.id}`)
			.body({content: 'https://evil.test'})
			.execute();
		await runWorker();
		expect(await getMessages(harness, owner.token, source.id)).toHaveLength(4);
		expect(await getMessages(harness, owner.token, logs.id)).toHaveLength(5);
	});
	it('recovers an expired worker lease without losing or duplicating moderation', async () => {
		await configure((s) => {
			s.rules.bad_words.action = 'delete_warn';
			s.rules.bad_words.words = ['forbidden'];
		});
		await sendMessage(harness, member.token, source.id, 'forbidden');
		const row = (await repository.pending())[0]!;
		expect(await repository.claim(row)).not.toBeNull();
		expect(await runWorker({ids: [row.id]})).toEqual({processed: 0});
		const now = Date.now();
		vi.spyOn(Date, 'now').mockReturnValue(now + 61000);
		expect(await runWorker({ids: [row.id]})).toEqual({processed: 1});
		await runWorker();
		expect(await repository.pending()).toHaveLength(0);
		expect(await getMessages(harness, owner.token, source.id)).toHaveLength(0);
		expect(await getMessages(harness, owner.token, logs.id)).toHaveLength(1);
	});
	it('retries a notification dispatch failure using the persisted system message ID', async () => {
		await configure((s) => {
			s.rules.bad_words.action = 'delete_warn';
			s.rules.bad_words.words = ['forbidden'];
		});
		await sendMessage(harness, member.token, source.id, 'forbidden');
		await runWorker({}, {failDispatch: true});
		const row = (await repository.pending())[0]!;
		const job = JSON.parse(row.value) as AutoModJob;
		expect(job.status).toBe('pending');
		expect(job.warning_id).toBeTruthy();
		expect(await getMessages(harness, owner.token, logs.id)).toHaveLength(1);
		vi.spyOn(Date, 'now').mockReturnValue(job.next_attempt_at + 1);
		await runWorker({ids: [row.id]});
		await runWorker();
		expect(await repository.pending()).toHaveLength(0);
		expect((await getMessages(harness, owner.token, logs.id)).map((m) => m.id)).toEqual([job.warning_id]);
		expect(
			(await repository.history(createGuildID(BigInt(guild.id)))).filter((e) => e.status === 'applied'),
		).toHaveLength(1);
	});
	it('keeps a missing notification target explicit, finishes failed delivery after retries and does not use another channel', async () => {
		await configure((s) => {
			s.rules.bad_words.action = 'delete_warn';
			s.rules.bad_words.words = ['forbidden'];
		});
		await createBuilder(harness, owner.token).delete(`/channels/${logs.id}`).expect(204).execute();
		await sendMessage(harness, member.token, source.id, 'forbidden');
		await runWorker();
		for (let attempt = 1; attempt < 6; attempt++) {
			const row = (await repository.pending())[0]!;
			const job = JSON.parse(row.value) as AutoModJob;
			vi.spyOn(Date, 'now').mockReturnValue(job.next_attempt_at + 1);
			await runWorker({ids: [row.id]});
		}
		expect(await repository.pending()).toHaveLength(0);
		expect(await getMessages(harness, owner.token, source.id)).toHaveLength(0);
		expect(
			(await repository.history(createGuildID(BigInt(guild.id)))).filter((e) => e.status === 'failed'),
		).toHaveLength(1);
	});
	it('supports cancellation and drains more than one queue page without duplicate system messages', async () => {
		await configure((s) => {
			s.rules.bad_words.action = 'delete_warn';
			s.rules.bad_words.words = ['forbidden'];
		});
		for (let n = 0; n < 55; n++) await sendMessage(harness, member.token, source.id, `forbidden ${n}`);
		expect(await runWorker({}, {cancel: true})).toEqual({processed: 0});
		expect(await getMessages(harness, owner.token, source.id, {limit: '100'})).toHaveLength(55);
		expect(await runWorker()).toEqual({processed: 55});
		expect(await runWorker()).toEqual({processed: 0});
		expect(await repository.pending()).toHaveLength(0);
		expect(await getMessages(harness, owner.token, source.id)).toHaveLength(0);
		const notices = await getMessages(harness, owner.token, logs.id, {limit: '100'});
		expect(notices).toHaveLength(55);
		expect(new Set(notices.map((m) => m.id)).size).toBe(55);
	});
	it('releases raid restrictions after expiry and preserves owner recovery and read access during the hold', async () => {
		await configure((s) => {
			s.rules.anti_raid.action = 'lockdown';
			s.rules.anti_raid.threshold = 1;
			s.duration_seconds = 10;
		});
		const invite = await createChannelInvite(harness, owner.token, source.id);
		const newcomer = await createTestAccount(harness);
		await acceptInvite(harness, newcomer.token, invite.code);
		await runWorker();
		await createBuilder(harness, member.token)
			.post(`/channels/${source.id}/messages`)
			.body({content: 'blocked'})
			.expect(403)
			.execute();
		await getMessages(harness, member.token, source.id);
		await sendMessage(harness, owner.token, source.id, 'recovery');
		const now = Date.now();
		vi.spyOn(Date, 'now').mockReturnValue(now + 11000);
		await sendMessage(harness, member.token, source.id, 'released');
		const next = await createTestAccount(harness);
		await acceptInvite(harness, next.token, invite.code);
	});
	it('ingests every one of the seventeen Anti Nuke audit producers from actual administrative operations', async () => {
		const victim = await createTestAccount(harness);
		const invite = await createChannelInvite(harness, owner.token, source.id);
		await acceptInvite(harness, victim.token, invite.code);
		const targetRole = await createRole(harness, owner.token, guild.id, {name: 'target'});
		const admin = await createRole(harness, owner.token, guild.id, {name: 'administrator', permissions: '8'});
		await updateRolePositions(harness, owner.token, guild.id, [{id: admin.id, position: 2}]);
		await addMemberRole(harness, owner.token, guild.id, member.userId, admin.id);
		const bot = await createTestBotAccount(harness);
		await configure((s) => {
			s.rules.anti_nuke.action = 'observe';
			s.rules.anti_nuke.threshold = 1;
		});
		await updateGuild(harness, member.token, guild.id, {name: 'administrative operation'});
		const channel = await createChannel(harness, member.token, guild.id, 'administrative-channel');
		await createBuilder(harness, member.token).patch(`/channels/${channel.id}`).body({name: 'renamed'}).execute();
		for (const allow of ['2048', '34816'])
			await createBuilder(harness, member.token)
				.put(`/channels/${channel.id}/permissions/${targetRole.id}`)
				.body({type: 0, allow, deny: '0'})
				.expect(204)
				.execute();
		await createBuilder(harness, member.token)
			.delete(`/channels/${channel.id}/permissions/${targetRole.id}`)
			.expect(204)
			.execute();
		await createBuilder(harness, member.token).delete(`/channels/${channel.id}`).expect(204).execute();
		const role = await createRole(harness, member.token, guild.id, {name: 'created by actor'});
		await updateRole(harness, member.token, guild.id, role.id, {name: 'renamed by actor'});
		await deleteRole(harness, member.token, guild.id, role.id);
		await addMemberRole(harness, member.token, guild.id, victim.userId, targetRole.id);
		await removeMemberRole(harness, member.token, guild.id, victim.userId, targetRole.id);
		await createBuilder(harness, member.token)
			.delete(`/guilds/${guild.id}/members/${victim.userId}`)
			.expect(204)
			.execute();
		await acceptInvite(harness, victim.token, invite.code);
		await createBuilder(harness, member.token)
			.put(`/guilds/${guild.id}/bans/${victim.userId}`)
			.body({reason: 'isolated test'})
			.expect(204)
			.execute();
		await authorizeBot(harness, member.token, bot.appId, ['bot'], guild.id, '0');
		const webhook = await createWebhook(harness, source.id, member.token, 'administrative hook');
		await updateWebhook(harness, webhook.id, member.token, {name: 'renamed hook'});
		await deleteWebhook(harness, webhook.id, member.token);
		const audit = await createBuilder<GuildAuditLogListResponse>(harness, owner.token)
			.get(`/guilds/${guild.id}/audit-logs?limit=100`)
			.execute();
		const entries = audit.audit_log_entries.filter(
			(e) => e.user_id === member.userId && AUTO_MOD_NUKE_ACTIONS.has(e.action_type),
		);
		expect(new Set(entries.map((e) => e.action_type))).toEqual(AUTO_MOD_NUKE_ACTIONS);
		expect(AUTO_MOD_NUKE_ACTIONS.size).toBe(17);
		const pending = await repository.pending();
		for (const entry of entries) expect(pending.some((row) => row.id === autoModKey(`audit:${entry.id}`))).toBe(true);
		await runWorker();
		await runWorker();
		expect(
			(await repository.history(createGuildID(BigInt(guild.id)))).filter((e) => e.status === 'observed'),
		).toHaveLength(entries.length);
		expect(await getMessages(harness, owner.token, logs.id)).toHaveLength(0);
	});
	it.each(['webhook_update', 'webhook_delete', 'bot_add'] as const)(
		'prevents a quarantined administrator from bypassing the hold through %s',
		async (operation) => {
			const admin = await createRole(harness, owner.token, guild.id, {name: 'administrator', permissions: '8'});
			await addMemberRole(harness, owner.token, guild.id, member.userId, admin.id);
			const webhook = await createWebhook(harness, source.id, owner.token, 'protected hook');
			const bot = await createTestBotAccount(harness);
			await configure((s) => {
				s.rules.anti_nuke.action = 'lockdown';
				s.rules.anti_nuke.log_only = false;
				s.rules.anti_nuke.threshold = 1;
			});
			await createChannel(harness, member.token, guild.id, 'triggers quarantine');
			await runWorker();
			if (operation === 'webhook_update')
				await createBuilder(harness, member.token)
					.patch(`/webhooks/${webhook.id}`)
					.body({name: 'must not change'})
					.expect(403)
					.execute();
			else if (operation === 'webhook_delete')
				await createBuilder(harness, member.token).delete(`/webhooks/${webhook.id}`).expect(403).execute();
			else
				await createBuilder(harness, member.token)
					.post('/oauth2/authorize/consent')
					.body({client_id: bot.appId, scope: 'bot', guild_id: guild.id, permissions: '0'})
					.expect(403)
					.execute();
			const current = await createBuilder<{name: string}>(harness, owner.token)
				.get(`/webhooks/${webhook.id}`)
				.execute();
			expect(current.name).toBe('protected hook');
			await createBuilder(harness, owner.token)
				.get(`/guilds/${guild.id}/members/${bot.botUserId}`)
				.expect(404)
				.execute();
			await createChannel(harness, owner.token, guild.id, 'owner recovery');
			const now = Date.now();
			vi.spyOn(Date, 'now').mockReturnValue(now + 601000);
			if (operation === 'webhook_update')
				await updateWebhook(harness, webhook.id, member.token, {name: 'released after expiry'});
			else if (operation === 'webhook_delete') await deleteWebhook(harness, webhook.id, member.token);
			else await authorizeBot(harness, member.token, bot.appId, ['bot'], guild.id, '0');
		},
	);
	it('does not count ordinary message moderation or invitation housekeeping as Anti Nuke activity', async () => {
		const admin = await createRole(harness, owner.token, guild.id, {name: 'administrator', permissions: '8'});
		await addMemberRole(harness, owner.token, guild.id, member.userId, admin.id);
		const message = await sendMessage(harness, owner.token, source.id, 'moderated message');
		await configure((s) => {
			s.rules.anti_nuke.action = 'lockdown';
			s.rules.anti_nuke.log_only = false;
			s.rules.anti_nuke.threshold = 1;
		});
		await createBuilder(harness, member.token)
			.delete(`/channels/${source.id}/messages/${message.id}`)
			.expect(204)
			.execute();
		const invite = await createChannelInvite(harness, member.token, source.id);
		await createBuilder(harness, member.token).delete(`/invites/${invite.code}`).expect(204).execute();
		await runWorker();
		const guildId = createGuildID(BigInt(guild.id));
		expect((await repository.history(guildId)).filter((e) => e.rules?.includes('anti_nuke'))).toHaveLength(0);
		expect(await repository.holdUntil(guildId, `nuke_hold:${member.userId}`, await repository.config(guildId))).toBe(0);
		await sendMessage(harness, member.token, source.id, 'still permitted');
	});
	it('keeps quarantine specific to its community and lets the owner manage webhooks and authorize bots', async () => {
		const admin = await createRole(harness, owner.token, guild.id, {name: 'administrator', permissions: '8'});
		await addMemberRole(harness, owner.token, guild.id, member.userId, admin.id);
		const webhook = await createWebhook(harness, source.id, owner.token, 'owner recovery hook');
		const bot = await createTestBotAccount(harness);
		const other = await createGuild(harness, member.token, 'Other isolated community');
		const otherChannel = await createChannel(harness, member.token, other.id, 'other');
		const otherHook = await createWebhook(harness, otherChannel.id, member.token, 'unrelated');
		await configure((s) => {
			s.rules.anti_nuke.action = 'lockdown';
			s.rules.anti_nuke.log_only = false;
			s.rules.anti_nuke.threshold = 1;
		});
		await createChannel(harness, member.token, guild.id, 'triggers quarantine');
		await runWorker();
		await updateWebhook(harness, otherHook.id, member.token, {name: 'unaffected community'});
		await updateWebhook(harness, webhook.id, owner.token, {name: 'owner can repair'});
		await deleteWebhook(harness, webhook.id, owner.token);
		await authorizeBot(harness, owner.token, bot.appId, ['bot'], guild.id, '0');
	});
	it.runIf(Boolean(url))(
		'rolls back actual message creation and edits when AutoMod outbox persistence fails',
		async () => {
			await configure((s) => {
				s.rules.bad_words.action = 'delete';
				s.rules.bad_words.words = ['forbidden'];
			});
			const safe = await sendMessage(harness, member.token, source.id, 'unchanged');
			await runWorker();
			const client = getDefaultPostgresClient();
			await client.query(
				"CREATE OR REPLACE FUNCTION reject_automod_queue() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.table_name = 'netrcol_auto_mod_queue' THEN RAISE EXCEPTION 'injected outbox failure'; END IF; RETURN NEW; END $$",
			);
			await client.query(
				'CREATE TRIGGER reject_automod_queue BEFORE INSERT OR UPDATE ON kv_automod_flow FOR EACH ROW EXECUTE FUNCTION reject_automod_queue()',
			);
			try {
				await createBuilder(harness, member.token)
					.post(`/channels/${source.id}/messages`)
					.body({content: 'forbidden create'})
					.expect(500)
					.execute();
				await createBuilder(harness, member.token)
					.patch(`/channels/${source.id}/messages/${safe.id}`)
					.body({content: 'forbidden edit'})
					.expect(500)
					.execute();
				expect((await getMessages(harness, owner.token, source.id)).map((m) => m.content)).toEqual(['unchanged']);
				expect(await repository.pending()).toHaveLength(0);
			} finally {
				await client.query('DROP TRIGGER reject_automod_queue ON kv_automod_flow');
				await client.query('DROP FUNCTION reject_automod_queue()');
			}
		},
	);
	it('pauses moderation after ownership transfer and the operator stop switch', async () => {
		await configure((s) => {
			s.rules.character_limit.action = 'delete';
			s.rules.character_limit.threshold = 1;
		});
		await sendMessage(harness, member.token, source.id, 'before transfer');
		await createBuilder(harness, owner.token)
			.post(`/guilds/${guild.id}/transfer-ownership`)
			.body({
				new_owner_id: member.userId,
				password: TEST_CREDENTIALS.STRONG_PASSWORD,
			})
			.execute();
		await flush();
		expect(await getMessages(harness, member.token, source.id)).toHaveLength(1);
		const config = await createBuilder<AutoModSettingsResponse>(harness, member.token).get(path()).execute();
		expect(config.status).toBe('owner_changed');
		await createBuilder(harness, member.token)
			.put(path())
			.body({...config.settings, revision: config.revision})
			.execute();
		await sendMessage(harness, owner.token, source.id, 'stop preserves this');
		process.env.NETRCOL_AUTOMATIONS_ENABLED = 'false';
		await flush();
		expect(await getMessages(harness, member.token, source.id)).toHaveLength(2);
	});
});
