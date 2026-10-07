// SPDX-License-Identifier: AGPL-3.0-or-later
import {createTestAccount, type TestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {createGuildID, createRoleID, createUserID} from '@app/api/BrandedTypes';
import {authorizeBot, createTestBotAccount} from '@app/api/bot/tests/BotTestUtils';
import {Config} from '@app/api/Config';
import {setCassandraQueryExecutorForTesting} from '@app/api/database/CassandraQueryExecution';
import {ensurePostgresKvSchema, PostgresKvQueryExecutor} from '@app/api/database/PostgresKvQueryExecutor';
import {
	acceptInvite,
	addMemberRole,
	createChannel,
	createChannelInvite,
	createGuild,
	createRole,
	deleteRole,
	leaveGuild,
	updateRole,
} from '@app/api/guild/tests/GuildTestUtils';
import {ServiceMiddleware} from '@app/api/middleware/ServiceMiddleware';
import {getGuildRepository, getUserRepository} from '@app/api/middleware/ServiceSingletons';
import {automaticRoleEligible} from '@app/api/netrcol/AutomaticRolePolicy';
import {AutomaticRoleProcessor} from '@app/api/netrcol/AutomaticRoleProcessor';
import {AutomaticRoleRepository} from '@app/api/netrcol/AutomaticRoleRepository';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {NoopLogger} from '@app/api/test/mocks/NoopLogger';
import {createBuilder, createBuilderWithoutAuth} from '@app/api/test/TestRequestBuilder';
import type {HonoEnv} from '@app/api/types/HonoEnv';
import processAutomaticRoles from '@app/api/worker/tasks/ProcessAutomaticRoles';
import {clearWorkerDependencies, setWorkerDependenciesForTest} from '@app/api/worker/WorkerContext';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {
	AutomaticRoleSettings,
	type AutomaticRoleSettingsResponse,
} from '@fluxer/schema/src/domains/guild/GuildAutomaticRoleSchemas';
import type {GuildResponse} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';
import {getDefaultPostgresClient, initPostgres, shutdownPostgres} from '@pkgs/postgres/src/Client';
import {Hono} from 'hono';
import {afterAll, afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

describe('Real membership → durable automatic roles → native role update', () => {
	let harness: ApiTestHarness,
		owner: TestAccount,
		member: TestAccount,
		guild: GuildResponse,
		roleId: string,
		invite: string;
	const original = {selfHosted: Config.instance.selfHosted, backend: Config.database.backend};
	const url = process.env.NETRCOL_TEST_POSTGRES_URL;
	const repository = new AutomaticRoleRepository();
	const path = () => `/guilds/${guild.id}/application-settings/automatic-roles`;
	const gid = () => createGuildID(BigInt(guild.id));
	const uid = () => createUserID(BigInt(member.userId));
	beforeEach(async () => {
		Config.instance.selfHosted = original.selfHosted;
		Config.database.backend = original.backend;
		harness = await createApiTestHarness();
		if (url) {
			await initPostgres({url, kvTable: 'kv_automatic_role_flow'});
			await ensurePostgresKvSchema(getDefaultPostgresClient());
			await getDefaultPostgresClient().query('TRUNCATE kv_automatic_role_flow');
			setCassandraQueryExecutorForTesting(new PostgresKvQueryExecutor(getDefaultPostgresClient()));
		}
		owner = await createTestAccount(harness);
		member = await createTestAccount(harness);
		guild = await createGuild(harness, owner.token, 'Isolated automatic roles');
		roleId = (await createRole(harness, owner.token, guild.id, {name: 'Member', permissions: '0'})).id;
		const channel = await createChannel(harness, owner.token, guild.id, 'general');
		invite = (await createChannelInvite(harness, owner.token, channel.id)).code;
		Config.instance.selfHosted = true;
		Config.database.backend = 'postgres';
	});
	afterEach(async () => {
		clearWorkerDependencies();
		vi.restoreAllMocks();
		Config.instance.selfHosted = original.selfHosted;
		Config.database.backend = original.backend;
		delete process.env.NETRCOL_AUTOMATIONS_ENABLED;
		await harness.shutdown();
	});
	afterAll(async () => {
		if (url) await shutdownPostgres();
	});
	async function configure(change: Partial<AutomaticRoleSettings> = {}, revision = 0, token = owner.token) {
		return createBuilder<AutomaticRoleSettingsResponse>(harness, token)
			.put(path())
			.body({enabled: true, member_role_ids: [roleId], bot_role_ids: [], delay_seconds: 0, ...change, revision})
			.execute();
	}
	async function flush(forceDue = false, failAfterWrite = false) {
		const app = new Hono<HonoEnv>();
		app.use(ServiceMiddleware);
		app.get('/flush', async (ctx) => {
			const service = ctx.get('guildService');
			if (failAfterWrite) {
				const real = service.members.systemAddMemberRole.bind(service.members);
				vi.spyOn(service.members, 'systemAddMemberRole').mockImplementationOnce(async (params) => {
					await real(params);
					throw new Error('Injected worker interruption after assignment');
				});
			}
			const processor = new AutomaticRoleProcessor(
				{guildRepository: getGuildRepository(), userRepository: getUserRepository(), guildService: service},
				repository,
			);
			for (const row of await repository.pending()) {
				if (forceDue) {
					const job = JSON.parse(row.value);
					job.next_attempt_at = 0;
					job.lease_until = 0;
					await repository.update(row, job);
				}
				const job = await repository.claim(row);
				if (!job) continue;
				try {
					await processor.process(row, job);
				} catch (err) {
					if (!failAfterWrite) throw err;
					await repository.update(row, {...job, status: 'pending', lease_until: 0});
				}
			}
			return ctx.json({ok: true});
		});
		expect((await app.request('/flush')).status).toBe(200);
	}
	async function roles() {
		return [...(await getGuildRepository().getMember(gid(), uid()))!.roleIds].map(String);
	}
	async function runWorker() {
		const app = new Hono<HonoEnv>();
		app.use(ServiceMiddleware);
		app.get('/work', async (ctx) => {
			setWorkerDependenciesForTest({
				guildRepository: getGuildRepository(),
				userRepository: getUserRepository(),
				guildService: ctx.get('guildService'),
			});
			return ctx.json(
				await processAutomaticRoles(
					{},
					{
						logger: new NoopLogger(),
						jobId: 1n,
						addJob: async () => 1n,
						reportProgress: async () => {},
						shouldCancel: async () => false,
						setContextLink: async () => {},
					},
				),
			);
		});
		expect((await app.request('/work')).status).toBe(200);
	}
	it('is disabled by default, requires login and restricts both settings and history to owners', async () => {
		const settings = await createBuilder<AutomaticRoleSettingsResponse>(harness, owner.token).get(path()).execute();
		expect(settings.settings).toEqual({enabled: false, member_role_ids: [], bot_role_ids: [], delay_seconds: 0});
		await createBuilderWithoutAuth(harness).get(path()).expect(401).execute();
		await acceptInvite(harness, member.token, invite);
		for (const suffix of ['', '/history'])
			await createBuilder(harness, member.token)
				.get(path() + suffix)
				.expect(403)
				.execute();
		await createBuilder(harness, member.token)
			.put(path())
			.body({...settings.settings, revision: 0})
			.expect(403)
			.execute();
	});
	it('assigns selected roles once, emits a system audit entry, preserves manual roles and does not backfill', async () => {
		await configure();
		await acceptInvite(harness, member.token, invite);
		const manual = await createRole(harness, owner.token, guild.id, {name: 'Manual', permissions: '0'});
		await addMemberRole(harness, owner.token, guild.id, member.userId, manual.id);
		await flush();
		await flush();
		expect(await roles()).toEqual(expect.arrayContaining([roleId, manual.id]));
		expect(await repository.pending()).toHaveLength(0);
		const history = await repository.history(gid());
		expect(history.filter((e) => e.status === 'assigned')).toHaveLength(1);
		expect(history.find((e) => e.status === 'assigned')?.actor_id).toBe('0');
		const audit = await createBuilder<{audit_log_entries: Array<{user_id: string; action_type: number}>}>(
			harness,
			owner.token,
		)
			.get(`/guilds/${guild.id}/audit-logs`)
			.execute();
		expect(audit.audit_log_entries.some((e) => e.user_id === '0')).toBe(true);
		await configure({member_role_ids: [manual.id]}, 1);
		expect(await repository.pending()).toHaveLength(0);
	});
	it('enforces delay and persists pending work until it is due', async () => {
		await configure({delay_seconds: 60});
		await acceptInvite(harness, member.token, invite);
		await flush();
		expect(await roles()).toEqual([]);
		expect(await repository.pending()).toHaveLength(1);
		await flush(true);
		expect(await roles()).toContain(roleId);
	});
	it.each(['member_left', 'policy_changed', 'stopped'] as const)('cancels delayed jobs for %s', async (reason) => {
		await configure({delay_seconds: 60});
		await acceptInvite(harness, member.token, invite);
		if (reason === 'member_left') await leaveGuild(harness, member.token, guild.id);
		if (reason === 'policy_changed') await configure({enabled: false}, 1);
		if (reason === 'stopped') process.env.NETRCOL_AUTOMATIONS_ENABLED = 'false';
		await flush(true);
		expect((await repository.history(gid())).find((e) => e.reason === reason)?.status).toBe('skipped');
	});
	it('separates leave/rejoin memberships and refuses a stale membership write', async () => {
		await configure({delay_seconds: 60});
		await acceptInvite(harness, member.token, invite);
		const previous = (await getGuildRepository().getMember(gid(), uid()))!.joinedAt.getTime();
		await leaveGuild(harness, member.token, guild.id);
		await acceptInvite(harness, member.token, invite);
		expect((await getGuildRepository().getMember(gid(), uid()))!.joinedAt.getTime()).not.toBe(previous);
		await expect(
			getGuildRepository().addSystemMemberRole(gid(), uid(), createRoleID(BigInt(roleId)), previous),
		).rejects.toThrow();
		await flush(true);
		expect(await roles()).toContain(roleId);
		expect((await repository.history(gid())).filter((e) => e.status === 'assigned')).toHaveLength(1);
		expect((await repository.history(gid())).some((e) => e.reason === 'member_left')).toBe(true);
	});
	it('blocks privileged, foreign, duplicate and everyone roles and invalid delays', async () => {
		const staff = await createRole(harness, owner.token, guild.id, {
			name: 'Admin',
			permissions: String(Permissions.ADMINISTRATOR),
		});
		const other = await createGuild(harness, owner.token, 'Other');
		const foreign = await createRole(harness, owner.token, other.id, {name: 'Foreign', permissions: '0'});
		for (const ids of [[staff.id], [guild.id], [foreign.id], [roleId, roleId]])
			await createBuilder(harness, owner.token)
				.put(path())
				.body({enabled: true, member_role_ids: ids, bot_role_ids: [], delay_seconds: 0, revision: 0})
				.expect(400)
				.execute();
		for (const delay of [-1, 3601, 1.5])
			expect(
				AutomaticRoleSettings.safeParse({
					enabled: true,
					member_role_ids: [roleId],
					bot_role_ids: [],
					delay_seconds: delay,
				}).success,
			).toBe(false);
		const role = (await getGuildRepository().getRole(createRoleID(BigInt(roleId)), gid()))!;
		expect(automaticRoleEligible(Object.assign(Object.create(role), {managed: true}), gid())).toBe(false);
	});
	it.each(['deleted', 'elevated'] as const)('revalidates a %s role at execution time', async (mode) => {
		await configure({delay_seconds: 60});
		await acceptInvite(harness, member.token, invite);
		if (mode === 'deleted') await deleteRole(harness, owner.token, guild.id, roleId);
		else await updateRole(harness, owner.token, guild.id, roleId, {permissions: String(Permissions.MANAGE_ROLES)});
		await flush(true);
		expect(await roles()).not.toContain(roleId);
		expect((await repository.history(gid())).some((e) => e.reason === 'role_unavailable')).toBe(true);
	});
	it('rejects stale configuration revisions and pauses after an ownership transfer', async () => {
		const settings = await configure({delay_seconds: 60});
		await acceptInvite(harness, member.token, invite);
		await createBuilder(harness, owner.token)
			.put(path())
			.body({...settings.settings, revision: 0})
			.expect(409)
			.execute();
		await createBuilder(harness, owner.token)
			.post(`/guilds/${guild.id}/transfer-ownership`)
			.body({new_owner_id: member.userId, password: owner.password})
			.execute();
		expect(
			(await createBuilder<AutomaticRoleSettingsResponse>(harness, member.token).get(path()).execute()).status,
		).toBe('owner_changed');
		await flush(true);
		expect(await roles()).toEqual([]);
		await configure({}, 1, member.token);
		expect(
			(await createBuilder<AutomaticRoleSettingsResponse>(harness, member.token).get(path()).execute()).status,
		).toBe('enabled');
	});
	it('keeps bot assignments separate and skips bots until roles are selected', async () => {
		await configure();
		const bot = await createTestBotAccount(harness);
		await authorizeBot(harness, owner.token, bot.appId, ['bot'], guild.id, '0');
		await flush();
		expect((await getGuildRepository().getMember(gid(), createUserID(BigInt(bot.botUserId))))!.roleIds.size).toBe(0);
		expect((await repository.history(gid())).some((e) => e.reason === 'no_roles')).toBe(true);
		await configure({member_role_ids: [], bot_role_ids: [roleId]}, 1);
		const bot2 = await createTestBotAccount(harness);
		await authorizeBot(harness, owner.token, bot2.appId, ['bot'], guild.id, '0');
		await flush();
		expect(
			(await getGuildRepository().getMember(gid(), createUserID(BigInt(bot2.botUserId))))!.roleIds.has(
				createRoleID(BigInt(roleId)),
			),
		).toBe(true);
	});
	it('reconciles worker interruption after a role was already written', async () => {
		await configure();
		await acceptInvite(harness, member.token, invite);
		await flush(false, true);
		expect(await roles()).toContain(roleId);
		vi.restoreAllMocks();
		await flush(true);
		await flush(true);
		expect((await repository.history(gid())).filter((e) => e.status === 'assigned')).toHaveLength(1);
		expect(await repository.pending()).toHaveLength(0);
	});
	it('enforces one queue lease and deduplicates the completed join source', async () => {
		await configure();
		await acceptInvite(harness, member.token, invite);
		const [row] = await repository.pending();
		expect(
			(await Promise.all([repository.claim({...row!}), repository.claim({...row!})])).filter(Boolean),
		).toHaveLength(1);
		await flush(true);
		const memberRow = (await getGuildRepository().getMember(gid(), uid()))!;
		expect(await repository.prepare(gid(), uid(), memberRow.joinedAt)).toHaveLength(0);
	});
	it('merges concurrent system role additions without dropping either role', async () => {
		await acceptInvite(harness, member.token, invite);
		const second = await createRole(harness, owner.token, guild.id, {name: 'Second', permissions: '0'});
		const joined = (await getGuildRepository().getMember(gid(), uid()))!.joinedAt.getTime();
		await Promise.all(
			[roleId, second.id].map((id) =>
				getGuildRepository().addSystemMemberRole(gid(), uid(), createRoleID(BigInt(id)), joined),
			),
		);
		expect(await roles()).toEqual(expect.arrayContaining([roleId, second.id]));
	});
	it('continues assigning valid roles when another selected role disappears', async () => {
		const second = await createRole(harness, owner.token, guild.id, {name: 'Second', permissions: '0'});
		await configure({member_role_ids: [roleId, second.id]});
		await acceptInvite(harness, member.token, invite);
		await deleteRole(harness, owner.token, guild.id, roleId);
		await flush();
		expect(await roles()).toContain(second.id);
		expect((await repository.history(gid())).find((e) => e.reason === 'role_unavailable')?.role_ids).toEqual([
			second.id,
		]);
	});
	it.runIf(Boolean(url))('rolls back membership if durable outbox insertion fails', async () => {
		await configure();
		const client = getDefaultPostgresClient();
		await client.query(
			"CREATE OR REPLACE FUNCTION reject_automatic_role_queue() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.table_name = 'netrcol_automatic_role_queue' THEN RAISE EXCEPTION 'injected outbox failure'; END IF; RETURN NEW; END $$",
		);
		await client.query(
			'CREATE TRIGGER reject_automatic_role_queue BEFORE INSERT OR UPDATE ON kv_automatic_role_flow FOR EACH ROW EXECUTE FUNCTION reject_automatic_role_queue()',
		);
		try {
			await createBuilder(harness, member.token).post(`/invites/${invite}`).body({}).expect(500).execute();
			expect(await getGuildRepository().getMember(gid(), uid())).toBeNull();
			expect(await repository.pending()).toHaveLength(0);
		} finally {
			await client.query('DROP TRIGGER reject_automatic_role_queue ON kv_automatic_role_flow');
			await client.query('DROP FUNCTION reject_automatic_role_queue()');
		}
	});
	it.runIf(Boolean(url))(
		'keeps completed jobs terminal and reconciles history after a persistence interruption',
		async () => {
			await configure();
			await acceptInvite(harness, member.token, invite);
			const client = getDefaultPostgresClient();
			await client.query(
				"CREATE OR REPLACE FUNCTION reject_automatic_role_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.table_name = 'netrcol_automatic_role_records' AND NEW.row_data->>'key' LIKE 'history:%' THEN RAISE EXCEPTION 'injected history failure'; END IF; RETURN NEW; END $$",
			);
			await client.query(
				'CREATE TRIGGER reject_automatic_role_history BEFORE INSERT OR UPDATE ON kv_automatic_role_flow FOR EACH ROW EXECUTE FUNCTION reject_automatic_role_history()',
			);
			try {
				await runWorker();
				expect(await roles()).toContain(roleId);
				expect(JSON.parse((await repository.pending())[0]!.value).status).toBe('done');
			} finally {
				await client.query('DROP TRIGGER reject_automatic_role_history ON kv_automatic_role_flow');
				await client.query('DROP FUNCTION reject_automatic_role_history()');
			}
			await runWorker();
			expect(await repository.pending()).toHaveLength(0);
			expect((await repository.history(gid())).filter((e) => e.status === 'assigned')).toHaveLength(1);
		},
	);
});
