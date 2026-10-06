// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import {createECDH} from 'node:crypto';
import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, dirname, join, resolve} from 'node:path';
import test from 'node:test';
import {createLocalEnvironment, prepareLocalEnvironment} from './prepare-local.mjs';

const template = readFileSync(new URL('../../deploy/self-hosting/.env.example', import.meta.url), 'utf8');
const compose = readFileSync(new URL('../../deploy/self-hosting/docker-compose.yml', import.meta.url), 'utf8');
function parseEnv(content) {
	return Object.fromEntries(content.split('\n').filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line)).map((line) => {
		const offset = line.indexOf('=');
		return [line.slice(0, offset), line.slice(offset + 1)];
	}));
}

test('generates every required upstream Compose value with no placeholder secret', () => {
	const output = createLocalEnvironment(template);
	const env = parseEnv(output);
	for (const match of compose.matchAll(/\$\{([A-Z][A-Z0-9_]*):\?/g)) {
		assert.ok(env[match[1]], `Missing required setting: ${match[1]}`);
	}
	assert.ok(!output.includes('CHANGE_ME'));
	assert.equal(env.FLUXER_PUBLIC_ORIGIN, 'http://localhost:8088');
	assert.equal(env.FLUXER_GATEWAY_ENDPOINT, 'ws://localhost:8088/gateway');
	assert.equal(env.PUBLIC_BOOTSTRAP_API_PUBLIC_ENDPOINT, 'http://localhost:8088/api');
	assert.equal(env.FLUXER_EMAIL_ENABLED, 'false');
});

test('VAPID keys form a real matching P-256 pair and relay secret has correct length', () => {
	const env = parseEnv(createLocalEnvironment(template));
	const key = createECDH('prime256v1');
	key.setPrivateKey(Buffer.from(env.FLUXER_VAPID_PRIVATE_KEY, 'base64url'));
	assert.equal(key.getPublicKey().toString('base64url'), env.FLUXER_VAPID_PUBLIC_KEY);
	assert.equal(Buffer.from(env.FLUXER_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64, 'base64').length, 32);
});

test('different installations receive different secrets', () => {
	const first = parseEnv(createLocalEnvironment(template));
	const second = parseEnv(createLocalEnvironment(template));
	assert.notEqual(first.POSTGRES_PASSWORD, second.POSTGRES_PASSWORD);
	assert.notEqual(first.FLUXER_VAPID_PRIVATE_KEY, second.FLUXER_VAPID_PRIVATE_KEY);
});

test('preparing again never rotates credentials or overwrites operator edits', () => {
	const root = mkdtempSync(join(tmpdir(), 'netrcol-local-env-'));
	try {
		mkdirSync(join(root, 'deploy/self-hosting'), {recursive: true});
		writeFileSync(join(root, 'deploy/self-hosting/.env.example'), template);
		const first = prepareLocalEnvironment(root);
		assert.equal(first.created, true);
		const original = readFileSync(first.envPath, 'utf8') + '# operator edit\n';
		writeFileSync(first.envPath, original);
		assert.equal(prepareLocalEnvironment(root).created, false);
		assert.equal(readFileSync(first.envPath, 'utf8'), original);
	} finally {
		// root is the unique directory returned by mkdtempSync, never user-supplied.
		assert.equal(dirname(resolve(root)), resolve(tmpdir()));
		assert.ok(basename(root).startsWith('netrcol-local-env-'));
		rmSync(root, {recursive: true, force: true});
	}
});
