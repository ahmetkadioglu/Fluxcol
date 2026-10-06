// SPDX-License-Identifier: AGPL-3.0-or-later

// Probe the entry-point assets too: a healthy HTML shell can still render blank
// when the app proxy cannot serve its JavaScript or stylesheets.
const origin = 'http://localhost:8088';
const paths = ['/_health', '/api/_health', '/gateway/_health', '/media/_health', '/.well-known/fluxer', '/'];

async function request(url, method = 'GET') {
	const response = await fetch(url, {method, signal: AbortSignal.timeout(15000)});
	if (response.status !== 200) throw new Error(`${url}: HTTP ${response.status}`);
	return response;
}

try {
	let html = '';
	for (const path of paths) {
		const response = await request(new URL(path, origin));
		if (path === '/') html = await response.text();
		else await response.body?.cancel();
		console.log(`PASS ${path}`);
	}
	const assets = new Set([...html.matchAll(/(?:src|href)=["']([^"']+\.(?:m?js|css)(?:\?[^"']*)?)["']/g)].map((match) => match[1]));
	if (![...assets].some((asset) => /\.m?js(?:\?|$)/.test(asset))) {
		throw new Error('The app shell contains no JavaScript entry point.');
	}
	for (const asset of assets) {
		const url = new URL(asset, origin);
		if (url.origin !== origin) throw new Error(`Expected local app asset: ${url}`);
		const response = await request(url, 'HEAD');
		const type = response.headers.get('content-type') ?? '';
		const expected = url.pathname.endsWith('.css') ? /^text\/css\b/i : /^(?:application|text)\/(?:java|ecma)script\b/i;
		if (!expected.test(type)) throw new Error(`${url.pathname}: unexpected Content-Type ${type}`);
		console.log(`PASS asset ${url.pathname}`);
	}
	console.log('Local HTTP and entry-point asset checks passed. Account setup and voice require separate verification.');
} catch (error) {
	console.error(`Local verification failed: ${error.message}`);
	process.exitCode = 1;
}
