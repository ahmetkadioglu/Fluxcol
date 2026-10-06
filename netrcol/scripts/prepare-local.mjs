// SPDX-License-Identifier: AGPL-3.0-or-later

import {createECDH, randomBytes} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function createLocalEnvironment(template) {
	const values = new Map();
	const vapid = createECDH('prime256v1');
	vapid.generateKeys();
	for (const line of template.split(/\r?\n/)) {
		const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
		if (!match) continue;
		const [, key, value] = match;
		values.set(key, value === 'CHANGE_ME' ? randomBytes(32).toString(key.endsWith('_BASE64') ? 'base64' : 'hex') : value);
	}
	const origin = 'http://localhost:8088';
	const overrides = {
		FLUXER_DOMAIN: 'localhost',
		FLUXER_PUBLIC_SCHEME: 'http',
		FLUXER_PUBLIC_PORT: '8088',
		FLUXER_PUBLIC_ORIGIN: origin,
		FLUXER_API_ENDPOINT: `${origin}/api`,
		FLUXER_API_CLIENT_ENDPOINT: `${origin}/api`,
		FLUXER_APP_ENDPOINT: origin,
		FLUXER_GATEWAY_ENDPOINT: 'ws://localhost:8088/gateway',
		FLUXER_MEDIA_ENDPOINT: `${origin}/media`,
		FLUXER_STATIC_CDN_ENDPOINT: origin,
		FLUXER_ADMIN_ENDPOINT: `${origin}/admin`,
		FLUXER_MARKETING_ENDPOINT: origin,
		FLUXER_INVITE_ENDPOINT: `${origin}/invite`,
		FLUXER_GIFT_ENDPOINT: `${origin}/gift`,
		FLUXER_STATIC_CDN_DOMAIN: 'localhost',
		FLUXER_INVITE_DOMAIN: 'localhost',
		FLUXER_GIFT_DOMAIN: 'localhost',
		PUBLIC_BOOTSTRAP_API_PUBLIC_ENDPOINT: `${origin}/api`,
		FLUXER_PASSKEY_RP_ID: 'localhost',
		FLUXER_PASSKEY_ADDITIONAL_ALLOWED_ORIGINS: origin,
		FLUXER_VAPID_PUBLIC_KEY: vapid.getPublicKey().toString('base64url'),
		FLUXER_VAPID_PRIVATE_KEY: vapid.getPrivateKey().toString('base64url'),
		FLUXER_VAPID_EMAIL: 'admin@localhost',
		FLUXER_LIVEKIT_URL: 'ws://localhost:8088/livekit',
		FLUXER_LIVEKIT_USE_EXTERNAL_IP: 'false',
		FLUXER_LIVEKIT_NODE_IP: '127.0.0.1',
		FLUXER_EMAIL_ENABLED: 'false',
		FLUXER_APP_PRODUCT_NAME: 'NetrcolFLXR Local',
		FLUXER_API_PRESIGNED_ATTACHMENT_UPLOADS_ENABLED: 'false',
		FLUXER_API_PRESIGNED_HARVEST_DOWNLOADS_ENABLED: 'false',
	};
	for (const [key, value] of Object.entries(overrides)) values.set(key, value);
	return '# Generated local instance secrets. Do not commit or share.\n'
		+ [...values].map(([key, value]) => `${key}=${value}`).join('\n') + '\n';
}

export function prepareLocalEnvironment(root) {
	const template = readFileSync(resolve(root, 'deploy/self-hosting/.env.example'), 'utf8');
	const directory = resolve(root, '.fluxer/local');
	mkdirSync(directory, {recursive: true});
	const envPath = resolve(directory, '.env');
	try {
		writeFileSync(envPath, createLocalEnvironment(template), {flag: 'wx', mode: 0o600});
		return {created: true, envPath};
	} catch (error) {
		if (error.code !== 'EEXIST') throw error;
		return {created: false, envPath};
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const root = fileURLToPath(new URL('../../', import.meta.url));
	const result = prepareLocalEnvironment(root);
	console.log(result.created ? 'Local configuration created; secrets are not printed.' : 'Existing local configuration preserved.');
	console.log('Target URL: http://localhost:8088 (available after containers are healthy).');
}
