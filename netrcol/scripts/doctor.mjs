// SPDX-License-Identifier: AGPL-3.0-or-later

import {spawnSync} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

// Read-only bootstrap check. Does not install packages, fetch code, or start containers.
const root = fileURLToPath(new URL('../../', import.meta.url));
const dockerDesktopCli = process.platform === 'win32' && process.env.ProgramFiles
	? join(process.env.ProgramFiles, 'Docker', 'Docker', 'resources', 'bin', 'docker.exe') : null;
const dockerCommand = dockerDesktopCli && existsSync(dockerDesktopCli) ? dockerDesktopCli : 'docker';
const sourceOnly = process.argv.includes('--source-only');
const asJson = process.argv.includes('--json');
const unknownArgs = process.argv.slice(2).filter((arg) => !['--source-only', '--json'].includes(arg));
if (unknownArgs.length > 0) {
	console.error('Usage: node netrcol/scripts/doctor.mjs [--source-only] [--json]');
	process.exit(2);
}

const checks = [];
function record(name, status, detail) {
	checks.push({name, status, detail});
}

function run(command, args) {
	const result = spawnSync(command, args, {
		cwd: root,
		encoding: 'utf8',
		timeout: 10000,
		maxBuffer: 128 * 1024,
		windowsHide: true,
		shell: false,
		env: {...process.env, GIT_OPTIONAL_LOCKS: '0'},
	});
	return {ok: !result.error && result.status === 0, output: result.stdout?.trim() ?? ''};
}

function readJson(path) {
	return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
}

let upstream;
try {
	upstream = readJson('../upstream.json');
	if (upstream.schema_version !== 1 || !/^[a-f0-9]{40}$/.test(upstream.commit)) {
		throw new Error('Invalid upstream metadata');
	}
	const baseline = run('git', ['rev-parse', '--verify', `${upstream.commit}^{commit}`]);
	const ancestor = baseline.ok && run('git', ['merge-base', '--is-ancestor', upstream.commit, 'HEAD']).ok;
	record('upstream-baseline', ancestor ? 'pass' : 'fail', ancestor
		? `Recorded base ${baseline.output} is present in the current history.`
		: 'Recorded upstream commit is missing or is not an ancestor of HEAD.');
	const remote = run('git', ['remote', 'get-url', 'upstream']);
	record('upstream-remote', remote.ok && remote.output === upstream.repository ? 'pass' : 'fail',
		remote.ok && remote.output === upstream.repository ? upstream.repository : 'Expected official upstream remote is missing or differs.');
} catch {
	record('upstream-metadata', 'fail', 'Cannot read valid netrcol/upstream.json.');
}

try {
	const pkg = readJson('../../package.json');
	const dockerfile = readFileSync(new URL('../../.devcontainer/Dockerfile', import.meta.url), 'utf8');
	const expectedNode = /^ARG NODE_MAJOR=(\d+)$/m.exec(dockerfile)?.[1];
	record('toolchain-target', expectedNode && pkg.packageManager ? 'pass' : 'fail',
		`Devcontainer: Node ${expectedNode ?? 'unknown'}, ${pkg.packageManager ?? 'unknown package manager'}. Host: Node ${process.versions.node}.`);
} catch {
	record('toolchain-target', 'fail', 'Cannot read upstream package.json or devcontainer Dockerfile.');
}

if (!sourceOnly) {
	const docker = run(dockerCommand, ['--version']);
	record('docker-cli', docker.ok ? 'pass' : 'fail', docker.ok ? docker.output : 'Docker CLI is not available on PATH.');
	if (docker.ok) {
		const compose = run(dockerCommand, ['compose', 'version', '--short']);
		record('docker-compose', compose.ok ? 'pass' : 'fail', compose.ok ? compose.output : 'Docker Compose v2 is not available.');
		const daemon = run(dockerCommand, ['info', '--format', '{{.OSType}}']);
		record('linux-container-engine', daemon.ok && daemon.output === 'linux' ? 'pass' : 'fail',
			daemon.ok ? `Docker engine OS: ${daemon.output}.` : 'Docker daemon is unavailable or access is denied.');
	} else {
		record('container-checks', 'skip', 'Install/start a Linux container environment, then rerun this check.');
	}
}

const passed = checks.every((check) => check.status !== 'fail');
const report = {
	mode: sourceOnly ? 'source-only' : 'devcontainer-host',
	passed,
	checks,
	note: 'Passing means bootstrap prerequisites passed; Fluxer build and runtime are not tested by this script.',
};

if (asJson) {
	console.log(JSON.stringify(report, null, 2));
} else {
	console.log(`NetrcolFLXR preflight (${report.mode})`);
	for (const check of checks) console.log(`[${check.status.toUpperCase()}] ${check.name}: ${check.detail}`);
	console.log(report.note);
}
process.exitCode = passed ? 0 : 1;
