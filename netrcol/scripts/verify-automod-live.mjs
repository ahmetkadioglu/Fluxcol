// SPDX-License-Identifier: AGPL-3.0-or-later
// Native HTTP + WebSocket verification of the running local API, JetStream worker and gateway.
// Creates only its own accounts/community; never changes an existing community's configuration.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash, randomBytes} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {setTimeout as sleep} from 'node:timers/promises';

if (!process.argv.includes('--run'))
	throw new Error('Use --run to create and clean up an isolated local test community.');
const origin = 'http://localhost:8088';
const runId = randomBytes(6).toString('hex');
const accounts = [],
	connections = [],
	guilds = [],
	results = [];
const report = {
	started_at: new Date().toISOString(),
	run_id: runId,
	transport: 'native HTTP + JSON WebSocket + deployed worker',
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
		throw new Error(`Local fixture operation failed in ${container}; credentials omitted`);
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
		username: `am_${label}_${runId}`,
		discriminator: 1,
		global_name: `AutoMod test ${label}`,
		password_hash: hash,
		password_last_changed_at: now,
		email_verified: true,
		bot: false,
		system: false,
		flags: tag('bigint', String(1n << 39n)),
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
	report.account_provisioning = 'two fresh local PostgreSQL fixtures; signup/CAPTCHA not under test';
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
		username: `am_${label}_${runId}`,
		global_name: `AutoMod test ${label}`,
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
	const started = performance.now();
	console.log(`RUN ${name}`);
	try {
		const details = await fn();
		results.push({name, status: 'passed', duration_ms: Math.round(performance.now() - started), ...details});
		console.log(`PASS ${name}${details?.delivery_ms !== undefined ? ` delivery=${details.delivery_ms}ms` : ''}`);
	} catch (error) {
		results.push({name, status: 'failed', error: error.message});
		throw error;
	}
}
const sourceKey = (id) => createHash('sha256').update(`message:${id}:0`).digest('hex');
let owner, member, guild, source, logs, observer, invite;
const configPath = () => `/guilds/${guild.id}/application-settings/automod`;
async function configure(ruleId, overrides = {}, action = 'delete_warn', mutate = () => {}) {
	const {data: current} = await request('GET', configPath(), owner);
	const settings = current.settings;
	for (const rule of Object.values(settings.rules)) rule.action = 'disabled';
	settings.enabled = true;
	settings.channel_id = logs.id;
	settings.duration_seconds = 10;
	if (ruleId) Object.assign(settings.rules[ruleId], {action}, overrides);
	mutate(settings);
	const {data} = await request('PUT', configPath(), owner, {...settings, revision: current.revision});
	return data;
}
async function send(content, channel = source.id, account = member, extra = {}) {
	const sent = await request('POST', `/channels/${channel}/messages`, account, {
		content,
		allowed_mentions: {parse: []},
		...extra,
	});
	const event = await observer.wait(
		(entry) => entry.type === 'MESSAGE_CREATE' && entry.data.id === sent.data.id,
		sent.started,
	);
	return {...sent, event};
}
async function history(id) {
	const {data} = await request('GET', `${configPath()}/history`, owner);
	return data.entries.find((entry) => entry.id === id);
}
async function passedMessage(sent) {
	// Nonviolations intentionally do not clutter the user-facing action history.
	// Read only this fixture community's durable completion marker as the worker oracle.
	assert.ok(fixtureMode, 'Boundary checks require --seed-local-fixtures for the local completion oracle');
	const key = sourceKey(sent.data.id);
	const entry = await until(async () => {
		const sql = `SELECT row_data->>'value' FROM fluxer_kv WHERE table_name='netrcol_auto_mod_records' AND row_data->'guild_id'->>'value'='${guild.id}' AND row_data->>'key'='completed:${key}';`;
		return (
			containerInput('netrcol-local-postgres-1', ['psql', '-U', 'fluxer', '-d', 'fluxer', '-At', '-c', sql]) ===
			'passed'
		);
	}, 'nonmatching message processed');
	await request('GET', `/channels/${sent.data.channel_id}/messages/${sent.data.id}`, owner);
	return entry;
}
async function moderated(sent, ruleId, {deleted = true, notification = true} = {}) {
	let removed;
	if (deleted)
		removed = await observer.wait(
			(entry) => entry.type === 'MESSAGE_DELETE' && entry.data.id === sent.data.id,
			sent.started,
		);
	let warning;
	if (notification)
		warning = await observer.wait(
			(entry) => entry.type === 'MESSAGE_CREATE' && entry.data.channel_id === logs.id && entry.data.author?.id === '0',
			sent.started,
		);
	const entry = await until(async () => {
		const row = await history(sourceKey(sent.data.id));
		return row && ['applied', 'observed'].includes(row.status) && row;
	}, 'moderation history committed');
	assert.ok(entry.rules.includes(ruleId), `${ruleId} matched`);
	if (deleted)
		await request('GET', `/channels/${sent.data.channel_id}/messages/${sent.data.id}`, owner, undefined, [404]);
	else await request('GET', `/channels/${sent.data.channel_id}/messages/${sent.data.id}`, owner);
	if (warning) {
		assert.equal(warning.data.author.username, 'Netrcol');
		assert.equal(warning.data.author.system, true);
		assert.equal(warning.data.embeds[0].title, 'AutoMod');
		assert.deepEqual(warning.data.mentions ?? [], []);
		const {data: persisted} = await request('GET', `/channels/${logs.id}/messages/${warning.data.id}`, owner);
		assert.equal(persisted.id, warning.data.id);
	}
	return {
		delivery_ms: Math.round((warning ?? removed ?? sent.event).received - sent.started),
		delete_ms: removed && Math.round(removed.received - sent.started),
		warning_id: warning?.data.id,
	};
}

try {
	await check('real gateway identification and isolated community', async () => {
		owner = await register('owner');
		member = await register('member');
		const ownerSession = new Gateway(owner);
		await ownerSession.wait((entry) => entry.type === 'READY');
		const memberSession = new Gateway(member);
		await memberSession.wait((entry) => entry.type === 'READY');
		guild = (await request('POST', '/guilds', owner, {name: `AutoMod native test ${runId}`})).data;
		guilds.push(guild);
		source = (await request('POST', `/guilds/${guild.id}/channels`, owner, {name: 'source', type: 0})).data;
		logs = (await request('POST', `/guilds/${guild.id}/channels`, owner, {name: 'automod-results', type: 0})).data;
		invite = (await request('POST', `/channels/${source.id}/invites`, owner, {})).data;
		await request('POST', `/invites/${invite.code}`, member, {});
		observer = new Gateway(owner, guild.id);
		const ready = await observer.wait((entry) => entry.type === 'READY');
		assert.ok(
			ready.data.guilds.some((entry) => entry.id === guild.id && !entry.unavailable),
			'Community is available in READY',
		);
		observer.send({op: 14, d: {subscriptions: {[guild.id]: {active: true, sync: true}}}});
		return {guild_id: guild.id};
	});
	const cases = [
		['bad_words', {words: ['forbidden']}, 'ordinary text', 'forbidden'],
		['server_invites', {}, 'ordinary text', `http://localhost:8088/invite/${invite?.code}`],
		['external_links', {}, 'ordinary text', 'https://example.com/automod-native-test'],
		[
			'excessive_caps',
			{minimum_length: 15, threshold: 70},
			'A'.repeat(14) + 'a'.repeat(6),
			'A'.repeat(15) + 'a'.repeat(5),
		],
		['excessive_emojis', {threshold: 12}, '👩‍👩‍👧‍👦👍🏽🇹🇷1️⃣'.repeat(3), `${'👩‍👩‍👧‍👦👍🏽🇹🇷1️⃣'.repeat(3)}😀`],
		['excessive_spoilers', {threshold: 5}, '||safe|| '.repeat(5), '||blocked|| '.repeat(6)],
		[
			'excessive_mentions',
			{threshold: 2},
			`<@${owner.id}> <@!${owner.id}> <@${member.id}> <@!${member.id}>`,
			`<@${owner.id}> <@${member.id}> <@&${guild.id}>`,
		],
		['zalgo', {threshold: 3}, 'normal café', 'x\u0301\u0302\u0303\u0304'],
		['character_limit', {threshold: 50}, 'a'.repeat(50), 'a'.repeat(51)],
	];
	for (const [id, settings, safe, blocked] of cases)
		await check(`${id}: boundary + native deletion + system embed`, async () => {
			await configure(id, settings);
			await passedMessage(await send(safe));
			return moderated(await send(blocked), id);
		});
	for (const id of ['repeated_text', 'anti_spam'])
		await check(`${id}: actual rolling counter`, async () => {
			await configure(id, {threshold: 3, window_seconds: 60});
			await passedMessage(await send(`${id} same text`));
			await passedMessage(await send(`${id} same text`));
			return moderated(await send(`${id} same text`), id);
		});
	await check('media_spam: native multipart upload and gateway delivery', async () => {
		await configure('media_spam', {threshold: 2, window_seconds: 60});
		async function attachment() {
			const form = new FormData();
			form.set(
				'payload_json',
				JSON.stringify({content: 'test attachment', attachments: [{id: 0, filename: 'native-test.txt'}]}),
			);
			form.set('files[0]', new Blob(['AutoMod isolated native upload'], {type: 'text/plain'}), 'native-test.txt');
			const sent = await request('POST', `/channels/${source.id}/messages`, member, form);
			const event = await observer.wait(
				(entry) => entry.type === 'MESSAGE_CREATE' && entry.data.id === sent.data.id,
				sent.started,
			);
			assert.equal(sent.data.attachments.length, 1);
			return {...sent, event};
		}
		await passedMessage(await attachment());
		return moderated(await attachment(), 'media_spam');
	});
	await check('anti_nuke: real staff operation, hold and native gateway notice', async () => {
		const role = (
			await request('POST', `/guilds/${guild.id}/roles`, owner, {name: 'test administrator', permissions: '8'})
		).data;
		await request('PUT', `/guilds/${guild.id}/members/${member.id}/roles/${role.id}`, owner);
		await configure('anti_nuke', {threshold: 1, log_only: false}, 'lockdown');
		const operation = await request('PATCH', `/channels/${source.id}`, member, {topic: 'Anti Nuke real operation'});
		const warning = await observer.wait(
			(entry) => entry.type === 'MESSAGE_CREATE' && entry.data.channel_id === logs.id && entry.data.author?.id === '0',
			operation.started,
		);
		await until(async () => {
			const {data} = await request('GET', `${configPath()}/history`, owner);
			return data.entries.find((entry) => entry.status === 'applied' && entry.rules?.includes('anti_nuke'));
		}, 'nuke history');
		await request('PATCH', `/channels/${source.id}`, member, {topic: 'must be blocked'}, [403]);
		await request('PATCH', `/channels/${source.id}`, owner, {topic: 'owner recovery works'});
		assert.equal(warning.data.author.username, 'Netrcol');
		return {delivery_ms: Math.round(warning.received - operation.started)};
	});
	await check('anti_raid: real join, lockdown, owner recovery and expiry', async () => {
		await request('PATCH', `/guilds/${guild.id}`, owner, {system_channel_id: source.id, system_channel_flags: 0});
		await configure('anti_raid', {threshold: 1, new_account_days: 7}, 'lockdown');
		await request('DELETE', `/users/@me/guilds/${guild.id}`, member);
		const joined = await request('POST', `/invites/${invite.code}`, member, {});
		await observer.wait(
			(entry) =>
				entry.type === 'MESSAGE_CREATE' &&
				entry.data.channel_id === source.id &&
				entry.data.type === 7 &&
				entry.data.author?.id === member.id,
			joined.started,
		);
		const warning = await observer.wait(
			(entry) => entry.type === 'MESSAGE_CREATE' && entry.data.channel_id === logs.id && entry.data.author?.id === '0',
			joined.started,
		);
		await until(async () => (await request('GET', configPath(), owner)).data.lockdown_until > Date.now(), 'raid hold');
		await request('POST', `/channels/${source.id}/messages`, member, {content: 'blocked by raid'}, [403]);
		await request('POST', `/channels/${source.id}/messages`, owner, {content: 'owner recovery'});
		const hold = (await request('GET', configPath(), owner)).data.lockdown_until;
		await sleep(Math.max(0, hold - Date.now() + 100));
		await send('allowed after raid expiry');
		return {delivery_ms: Math.round(warning.received - joined.started)};
	});
	await check('bounded concurrent load: 20 actual messages delivered exactly once', async () => {
		await configure('bad_words', {words: ['forbidden']});
		const baseline = observer.events.length;
		const sent = [];
		for (let group = 0; group < 5; group++)
			sent.push(
				...(await Promise.all(Array.from({length: 4}, (_, index) => send(`forbidden batch ${group} ${index}`)))),
			);
		await until(
			async () => {
				const {data} = await request('GET', `${configPath()}/history`, owner);
				return sent.every((message) =>
					data.entries.some((entry) => entry.id === sourceKey(message.data.id) && entry.status === 'applied'),
				);
			},
			'all load events processed',
			45000,
		);
		await sleep(1000);
		const events = observer.events.slice(baseline);
		const warnings = events.filter(
			(entry) => entry.type === 'MESSAGE_CREATE' && entry.data.channel_id === logs.id && entry.data.author?.id === '0',
		);
		const deletions = events.filter(
			(entry) => entry.type === 'MESSAGE_DELETE' && sent.some((message) => message.data.id === entry.data.id),
		);
		assert.equal(warnings.length, 20);
		assert.equal(new Set(warnings.map((entry) => entry.data.id)).size, 20);
		assert.equal(deletions.length, 20);
		assert.equal(new Set(deletions.map((entry) => entry.data.id)).size, 20);
		const timings = sent
			.map((message) =>
				Math.round(deletions.find((entry) => entry.data.id === message.data.id).received - message.started),
			)
			.sort((a, b) => a - b);
		for (const connection of connections) assert.deepEqual(connection.unexpected, []);
		return {
			messages: 20,
			delete_latency_ms: {min: timings[0], median: timings[10], p95: timings[18], max: timings[19]},
			no_gateway_disconnect: true,
			no_community_unavailable: true,
		};
	});
} catch (error) {
	report.error = error.message;
	console.error(`FAIL ${error.message}`);
	process.exitCode = 1;
} finally {
	for (const connection of connections) connection.close();
	for (const testGuild of guilds) {
		try {
			await request('POST', `/guilds/${testGuild.id}/delete`, owner, {password: owner.password});
			report.cleanup.push({guild_id: testGuild.id, deleted: true});
		} catch (error) {
			report.cleanup.push({guild_id: testGuild.id, error: error.message});
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
	await writeFile('.fluxer/local-bootstrap/automod-live-results.json', `${JSON.stringify(report, null, 2)}\n`);
	console.log(
		`Live verification: ${results.filter((entry) => entry.status === 'passed').length} passed, ${results.filter((entry) => entry.status === 'failed').length} failed. Cleanup completed=${report.cleanup.every((entry) => !entry.error)}`,
	);
}
