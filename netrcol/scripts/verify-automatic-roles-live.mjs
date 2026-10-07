// SPDX-License-Identifier: AGPL-3.0-or-later
// Isolated native HTTP, gateway and deployed-worker verification. Existing accounts and communities are untouched.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash, randomBytes} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {setTimeout as sleep} from 'node:timers/promises';

if (!process.argv.includes('--run')) throw new Error('Use --run to create and clean up isolated local test fixtures.');
const origin = 'http://localhost:8088',
	runId = randomBytes(6).toString('hex');
const accounts = [],
	connections = [],
	results = [];
const report = {
	started_at: new Date().toISOString(),
	run_id: runId,
	transport: 'native HTTP + gateway + deployed worker',
	results,
	cleanup: [],
};
const fixtureMode = process.argv.includes('--seed-local-fixtures');
const docker = 'C:/Program Files/Docker/Docker/resources/bin/docker.exe';
function containerInput(container, command, input) {
	try {
		return execFileSync(docker, ['exec', '-i', container, ...command], {
			input,
			encoding: 'utf8',
			stdio: ['pipe', 'pipe', 'pipe'],
		}).trim();
	} catch {
		throw new Error('Local fixture operation failed; credentials omitted');
	}
}
async function seedAccount(label, password) {
	// Test-only provisioning for an owned local installation with CAPTCHA enabled.
	// Standard rows and token hashes; no existing user is read, altered, or granted permissions.
	const id = (
		(BigInt(Date.now() - 1420070400000) << 22n) |
		(1023n << 12n) |
		BigInt(randomBytes(2).readUInt16BE() & 4095)
	).toString();
	const token = `flx_${randomBytes(18).toString('hex')}`;
	const tag = (type, value) => ({__fluxer_type: type, value});
	const userId = tag('bigint', id),
		now = tag('date', new Date().toISOString());
	const hash = containerInput(
		'netrcol-local-api-1',
		[
			'node',
			'-e',
			"const fs=require('fs');require('argon2').hash(fs.readFileSync(0,'utf8')).then(hash=>process.stdout.write(hash));",
		],
		password,
	);
	const source = await readFile('fluxer_api/src/api/database/types/UserTypes.ts', 'utf8');
	const columns = [
		...source
			.split('export const USER_COLUMNS = [')[1]
			.split('] as const')[0]
			.matchAll(/'([^']+)'/g),
	].map((match) => match[1]);
	const user = Object.fromEntries(columns.map((column) => [column, null]));
	Object.assign(user, {
		user_id: userId,
		username: `ar_${label}_${runId}`,
		discriminator: 1,
		global_name: `Automatic roles test ${label}`,
		password_hash: hash,
		password_last_changed_at: now,
		email_verified: true,
		bot: false,
		system: false,
		// CAPTCHA is outside this fixture test. The source's reviewer exemption
		// is applied only to these fresh, disposable accounts, never existing users.
		flags: tag('bigint', String((1n << 39n) | (1n << 53n))),
		locale: 'en-US',
		last_active_at: now,
		last_active_ip: '127.0.0.1',
		version: 1,
	});
	const sessionHash = tag('buffer', createHash('sha256').update(token).digest('base64'));
	const session = {
		user_id: userId,
		session_id_hash: sessionHash,
		created_at: now,
		approx_last_used_at: now,
		client_ip: '127.0.0.1',
		client_user_agent: 'Netrcol local test fixture',
		client_os: 'Windows',
		client_country: null,
		version: 1,
	};
	const literal = (value) => `'${value.replace(/'/g, "''")}'`;
	const insert = (table, key, value) =>
		`INSERT INTO fluxer_kv (table_name,partition_key,row_key,row_data) VALUES (${literal(table)},${literal(key)},${literal(key)},${literal(JSON.stringify(value))}::jsonb);`;
	const sql = [
		'BEGIN;',
		insert('users', JSON.stringify(userId), user),
		insert('auth_sessions', JSON.stringify(sessionHash), session),
		insert('auth_sessions_by_user_id', `${JSON.stringify(userId)}\u001f${JSON.stringify(sessionHash)}`, {
			user_id: userId,
			session_id_hash: sessionHash,
		}),
		'COMMIT;',
	].join('\n');
	containerInput(
		'netrcol-local-postgres-1',
		['psql', '-U', 'fluxer', '-d', 'fluxer', '-v', 'ON_ERROR_STOP=1', '-q'],
		sql,
	);
	report.account_provisioning = 'fresh local PostgreSQL fixtures; signup/CAPTCHA not under test';
	return {id, token, password};
}

async function request(method, path, account, body, expected = [200, 201, 204]) {
	for (let attempt = 0; attempt < 8; attempt++) {
		const headers = {'accept-language': 'en-US'};
		if (account) headers.authorization = account.token;
		if (body !== undefined && !(body instanceof FormData)) headers['content-type'] = 'application/json';
		const started = performance.now();
		const response = await fetch(`${origin}/api${path}`, {
			method,
			headers,
			body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
			signal: AbortSignal.timeout(20000),
		});
		const text = await response.text();
		let data = null;
		try {
			data = text ? JSON.parse(text) : null;
		} catch {
			/* HTTP diagnostics below. */
		}
		if (response.status === 429) {
			await sleep(Math.max(100, Number(data?.retry_after ?? response.headers.get('retry-after') ?? 1) * 1000 + 50));
			continue;
		}
		if (!expected.includes(response.status))
			throw new Error(
				`${method} ${path}: HTTP ${response.status}, ${data?.code ?? text.slice(0, 200)} ${JSON.stringify(data?.errors ?? '')}`,
			);
		return {data, status: response.status, started, finished: performance.now()};
	}
	throw new Error(`${method} ${path}: rate limit did not clear`);
}
async function register(label) {
	const password = `Netrcol_${randomBytes(24).toString('base64url')}!`;
	if (fixtureMode) {
		const account = await seedAccount(label, password);
		accounts.push(account);
		return account;
	}
	const {data} = await request('POST', '/auth/register', null, {
		username: `ar_${label}_${runId}`,
		global_name: `Automatic roles test ${label}`,
		password,
		date_of_birth: '1990-01-01',
		consent: true,
	});
	assert.ok(data.token, 'Local registration must return a token');
	const account = {token: data.token, id: data.user_id, password};
	accounts.push(account);
	return account;
}
class Gateway {
	events = [];
	sequence = null;
	heartbeat = null;
	unexpected = [];
	constructor(account, guildId) {
		this.socket = new WebSocket('ws://localhost:8088/gateway?v=1&encoding=json');
		this.socket.addEventListener('message', ({data}) => {
			const payload = JSON.parse(data);
			if (payload.s !== undefined) this.sequence = payload.s;
			if (payload.op === 10) {
				this.heartbeat = setInterval(() => this.send({op: 1, d: this.sequence}), payload.d.heartbeat_interval / 2);
				this.send({
					op: 2,
					d: {
						token: account.token,
						properties: {os: 'Windows', browser: 'Netrcol verification', device: 'test'},
						...(guildId ? {initial_guild_id: guildId} : {}),
					},
				});
			} else if (payload.op === 1) this.send({op: 1, d: this.sequence});
			if (payload.op === 0) {
				this.events.push({type: payload.t, data: payload.d, received: performance.now()});
				if (
					guildId &&
					['GUILD_CREATE', 'GUILD_DELETE'].includes(payload.t) &&
					payload.d?.id === guildId &&
					payload.d?.unavailable
				)
					this.unexpected.push({event: payload.t, unavailable: true});
			}
			if ([7, 9, 12].includes(payload.op)) this.unexpected.push({op: payload.op, data: payload.d});
		});
		this.socket.addEventListener('close', ({code, reason}) => {
			clearInterval(this.heartbeat);
			if (!this.closing) this.unexpected.push({close: code, reason});
		});
		this.socket.addEventListener('error', () => this.unexpected.push({error: 'WebSocket error'}));
		connections.push(this);
	}
	send(payload) {
		if (this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(payload));
	}
	async wait(predicate, after = 0, timeout = 20000) {
		const deadline = performance.now() + timeout;
		while (performance.now() < deadline) {
			const event = this.events.find((entry) => entry.received >= after && predicate(entry));
			if (event) return event;
			if (this.unexpected.length) throw new Error(`Gateway failure: ${JSON.stringify(this.unexpected)}`);
			await sleep(20);
		}
		throw new Error(
			`Gateway event timeout; recent types=${this.events
				.slice(-12)
				.map((entry) => entry.type)
				.join(',')}`,
		);
	}
	close() {
		this.closing = true;
		clearInterval(this.heartbeat);
		this.socket.close(1000, 'Test finished');
	}
}
async function until(fn, label, timeout = 20000) {
	const deadline = performance.now() + timeout;
	while (performance.now() < deadline) {
		const result = await fn();
		if (result) return result;
		await sleep(150);
	}
	throw new Error(`Timeout: ${label}`);
}
async function check(name, fn) {
	console.log(`RUN ${name}`);
	const started = performance.now();
	try {
		const details = await fn();
		results.push({name, status: 'passed', duration_ms: Math.round(performance.now() - started), ...details});
		console.log(`PASS ${name}`);
	} catch (error) {
		results.push({name, status: 'failed', error: error.message});
		throw error;
	}
}
let owner, member, guild, invite, observer, memberRole, secondRole, botRole, manualRole, logChannel;
const applications = [];
const path = () => `/guilds/${guild.id}/application-settings/automatic-roles`;
const settings = async () => (await request('GET', path(), owner)).data;
const history = async () => (await request('GET', `${path()}/history`, owner)).data.entries;
const memberState = async (id = member.id) => (await request('GET', `/guilds/${guild.id}/members/${id}`, owner)).data;
async function configure(overrides = {}) {
	const current = await settings();
	return (await request('PUT', path(), owner, {...current.settings, ...overrides, revision: current.revision})).data;
}
async function join() {
	return request('POST', `/invites/${invite.code}`, member, {});
}
async function leave() {
	await request('DELETE', `/users/@me/guilds/${guild.id}`, member);
}
async function outcome(userId, after = 0) {
	return until(
		async () => (await history()).find((e) => e.user_id === userId && e.at >= after),
		'role assignment history',
	);
}
async function addBot() {
	const application = (
		await request('POST', '/oauth2/applications', owner, {
			name: `Automatic roles test bot ${applications.length}`,
			redirect_uris: [],
		})
	).data;
	applications.push(application.id);
	assert.ok(application.bot?.id, 'native bot application returned an identity');
	await request('POST', '/oauth2/authorize/consent', owner, {
		client_id: application.id,
		scope: 'bot',
		guild_id: guild.id,
		permissions: '0',
	});
	return application.bot.id;
}
try {
	await check('native setup and owner-only settings', async () => {
		owner = await register('owner');
		member = await register('member');
		guild = (await request('POST', '/guilds', owner, {name: `Automatic roles native test ${runId}`})).data;
		const channel = (await request('POST', `/guilds/${guild.id}/channels`, owner, {name: 'role-results', type: 0}))
			.data;
		logChannel = channel.id;
		invite = (await request('POST', `/channels/${channel.id}/invites`, owner, {})).data;
		const role = async (name, permissions = '0') =>
			(await request('POST', `/guilds/${guild.id}/roles`, owner, {name, permissions})).data;
		[memberRole, secondRole, botRole, manualRole] = await Promise.all(
			['Member', 'Community', 'Bot', 'Manual'].map((name) => role(name)),
		);
		const staff = await role('Administrator', '8');
		const current = await settings();
		assert.equal(current.status, 'disabled');
		assert.equal(current.roles.find((r) => r.id === staff.id).eligible, false);
		await request('GET', path(), member, undefined, [403]);
		await request('PUT', path(), owner, {...current.settings, member_role_ids: [staff.id], revision: 0}, [400]);
		await request('PUT', `/guilds/${guild.id}/application-settings/event-logs`, owner, {
			revision: 0,
			schema_version: 2,
			enabled: true,
			channel_id: logChannel,
			category_channels: {},
			event_channels: {},
			events: ['member_role_update'],
			language: 'en-US',
			capture_message_content: false,
		});
		observer = new Gateway(owner, guild.id);
		await observer.wait((e) => e.type === 'READY');
		observer.send({op: 14, d: {subscriptions: {[guild.id]: {active: true, sync: true}}}});
		return {guild_id: guild.id};
	});
	await check('member join assigns both native roles and emits gateway updates', async () => {
		await configure({enabled: true, member_role_ids: [memberRole.id, secondRole.id]});
		const joined = await join();
		const result = await outcome(member.id, Date.now() - 1000);
		assert.equal(result.status, 'assigned');
		assert.deepEqual(new Set((await memberState()).roles), new Set([memberRole.id, secondRole.id]));
		const event = await observer.wait(
			(e) => e.type === 'GUILD_MEMBER_UPDATE' && e.data.user?.id === member.id && e.data.roles?.includes(secondRole.id),
			joined.started,
		);
		assert.equal(result.actor_id, '0');
		assert.equal((await memberState(owner.id)).roles.length, 0, 'saving does not backfill existing owner');
		assert.equal((await history()).filter((e) => e.user_id === member.id).length, 1);
		const logged = await until(
			async () =>
				(await request('GET', `/channels/${logChannel}/messages?limit=50`, owner)).data.find(
					(m) => m.author.id === '0' && m.embeds?.[0]?.title === 'Member roles changed',
				),
			'native event log embed',
		);
		assert.equal(logged.author.username, 'Netrcol');
		assert.equal(logged.author.system, true);
		return {gateway_latency_ms: Math.round(event.received - joined.started), assigned_role_count: 2};
	});
	await check('delay preserves a role added while the assignment waits', async () => {
		await leave();
		await configure({delay_seconds: 3});
		const start = Date.now();
		await join();
		assert.equal((await memberState()).roles.length, 0);
		await request('PUT', `/guilds/${guild.id}/members/${member.id}/roles/${manualRole.id}`, owner, undefined);
		const result = await outcome(member.id, start);
		assert.equal(result.status, 'assigned');
		assert.ok(Date.now() - start >= 3000);
		assert.deepEqual(new Set((await memberState()).roles), new Set([manualRole.id, memberRole.id, secondRole.id]));
		return {elapsed_ms: Date.now() - start};
	});
	await check('configuration change cancels a pending join', async () => {
		await leave();
		await configure({delay_seconds: 3});
		const start = Date.now();
		await join();
		await configure({enabled: false});
		const result = await outcome(member.id, start);
		assert.equal(result.reason, 'policy_changed');
		assert.equal((await memberState()).roles.length, 0);
	});
	await check('member departure cancels a pending assignment', async () => {
		await leave();
		await configure({enabled: true, delay_seconds: 3});
		const start = Date.now();
		await join();
		await leave();
		assert.equal((await outcome(member.id, start)).reason, 'member_left');
		await request('GET', `/guilds/${guild.id}/members/${member.id}`, owner, undefined, [404]);
	});
	await check('bots skip member roles until a separate bot list is configured', async () => {
		await configure({delay_seconds: 0});
		const first = await addBot();
		assert.equal((await outcome(first)).reason, 'no_roles');
		assert.deepEqual((await memberState(first)).roles, []);
		await configure({bot_role_ids: [botRole.id]});
		const second = await addBot();
		assert.equal((await outcome(second)).status, 'assigned');
		assert.deepEqual((await memberState(second)).roles, [botRole.id]);
	});
	await check('stale save revision is rejected and deleted target roles are revalidated', async () => {
		await configure({member_role_ids: [secondRole.id], delay_seconds: 3});
		const current = await settings();
		await request('PUT', path(), owner, {...current.settings, revision: current.revision - 1}, [409]);
		const start = Date.now();
		await join();
		await request('DELETE', `/guilds/${guild.id}/roles/${secondRole.id}`, owner);
		assert.equal((await outcome(member.id, start)).reason, 'role_unavailable');
		assert.deepEqual((await memberState()).roles, []);
		assert.deepEqual(observer.unexpected, [], 'community did not become unavailable');
	});
} catch (error) {
	report.error = error.message;
	console.error(`FAIL ${error.message}`);
	process.exitCode = 1;
} finally {
	for (const connection of connections) connection.close();
	for (const id of applications) {
		try {
			await request('DELETE', `/oauth2/applications/${id}`, owner, {password: owner.password});
			report.cleanup.push({application_id: id, deleted: true});
		} catch (error) {
			report.cleanup.push({application_id: id, error: error.message});
			process.exitCode = 1;
		}
	}
	if (guild) {
		try {
			await request('POST', `/guilds/${guild.id}/delete`, owner, {password: owner.password});
			report.cleanup.push({guild_id: guild.id, deleted: true});
		} catch (error) {
			report.cleanup.push({guild_id: guild.id, error: error.message});
			process.exitCode = 1;
		}
	}
	for (const account of accounts) {
		try {
			await request('POST', '/users/@me/delete', account, {password: account.password});
			report.cleanup.push({account_id: account.id, deletion_requested: true});
		} catch (error) {
			report.cleanup.push({account_id: account.id, error: error.message});
			process.exitCode = 1;
		}
	}
	report.finished_at = new Date().toISOString();
	await mkdir('.fluxer/local-bootstrap', {recursive: true});
	await writeFile('.fluxer/local-bootstrap/automatic-roles-live-results.json', `${JSON.stringify(report, null, 2)}\n`);
	console.log(
		`Live verification: ${results.filter((r) => r.status === 'passed').length} passed, ${results.filter((r) => r.status === 'failed').length} failed. Cleanup completed=${report.cleanup.every((r) => !r.error)}`,
	);
}
