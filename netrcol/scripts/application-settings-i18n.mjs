// SPDX-License-Identifier: AGPL-3.0-or-later
import assert from 'node:assert/strict';
import {readdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const catalogPath = resolve(root, 'fluxer_app/src/features/application_settings/ApplicationSettingsCatalog.ts');
const localesPath = resolve(root, 'fluxer_app/src/features/i18n/locales');
const dataPath = resolve(root, 'netrcol/i18n/application-settings');
const prefix = 'netrcol.application_settings.';
const invariant = new Set([
	'AutoMod',
	'YouTube',
	'Twitch',
	'Bluesky',
	'Kick',
	'X',
	'10',
	'15',
	'5',
	'1',
	'3',
	'⭐',
	'09:00',
	'Europe/Istanbul',
	'/community',
	'https://example.com/feed.xml',
]);
const source = `${await readFile(catalogPath, 'utf8')}\n${await readFile(resolve(root, 'fluxer_app/src/features/application_settings/EventLogCopy.ts'), 'utf8')}`;
const entries = [...source.matchAll(/msg\(\{\s*id: '([^']+)',\s*message: '([^']*)',?\s*\}\)/g)].map((match) => ({
	id: match[1],
	message: match[2],
}));
assert.equal(entries.length, (source.match(/\bmsg\(/g) ?? []).length, 'Unrecognized message descriptor');
entries.push(
	...[
		'Application settings',
		'Not available yet',
		'Built-in community features for {communityName}.',
		'Application settings are only available to the community owner on a self-hosted instance.',
		'Back to community',
	].map((message) => ({id: message, message})),
);
assert.equal(new Set(entries.map((entry) => entry.id)).size, entries.length, 'Duplicate message ID');
const groups = {
	copy: entries.filter((entry) => entry.id.startsWith(`${prefix}copy.`)),
	groups: entries.filter((entry) => entry.id.startsWith(`${prefix}group.`)),
	fields: entries.filter((entry) => entry.id.startsWith(`${prefix}field.`)),
	examples: entries.filter((entry) => entry.id.startsWith(`${prefix}example.`)),
	titles: entries.filter((entry) => entry.id.startsWith(`${prefix}module.`) && entry.id.endsWith('.title')),
	descriptions: entries.filter((entry) => entry.id.startsWith(`${prefix}module.`) && entry.id.endsWith('.description')),
	ui: entries.filter((entry) => !entry.id.startsWith(prefix)),
	logs: entries.filter((entry) => entry.id.startsWith(`${prefix}logs.`)),
};
const schema = Object.fromEntries(
	Object.entries(groups).map(([key, values]) => [
		key,
		[...new Set(values.map((entry) => entry.message))].filter((message) => !invariant.has(message)),
	]),
);
if (process.argv.includes('--schema')) {
	console.log(JSON.stringify(schema, null, 2));
	process.exit(0);
}
const exportLocale = process.argv.find((arg) => arg.startsWith('--export-locale='))?.split('=')[1];
if (exportLocale) {
	assert.match(exportLocale, /^[a-z]{2}(?:-[A-Z0-9]+)?$/);
	const po = await readFile(resolve(localesPath, exportLocale, 'messages.po'), 'utf8');
	const translated = new Map(
		[...po.matchAll(/^msgid (".*")\nmsgstr (".*")$/gm)].map((match) => [JSON.parse(match[1]), JSON.parse(match[2])]),
	);
	const bySource = new Map(entries.map((entry) => [entry.message, translated.get(entry.id)]));
	const data = Object.fromEntries(
		Object.entries(schema).map(([key, messages]) => [
			key,
			messages
				.map((message) => {
					assert.ok(bySource.get(message), `Missing existing translation: ${message}`);
					return bySource.get(message);
				})
				.join('|'),
		]),
	);
	await writeFile(resolve(dataPath, `${exportLocale}.json`), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
	process.exit(0);
}
const placeholders = (message) => [...message.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort();
const dataOnly = process.argv.includes('--validate-data');
const dataFiles = new Set((await readdir(dataPath)).map((file) => file.replace(/\.json$/, '')));
const config = await readFile(resolve(root, 'fluxer_app/lingui.config.js'), 'utf8');
const configuredLocales = [...config.match(/locales:\s*\[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map(
	(match) => match[1],
);
const catalogLocales = (await readdir(localesPath, {withFileTypes: true}))
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name);
assert.deepEqual(
	[...catalogLocales].sort(),
	[...configuredLocales].sort(),
	'Locale directories must match Lingui configuration',
);
const locales = catalogLocales.filter(
	(locale) => !dataOnly || locale.startsWith('en-') || dataFiles.has(locale === 'es-419' ? 'es-ES' : locale),
);
const check = process.argv.includes('--check');
let checked = 0;
for (const locale of locales) {
	const strings = new Map(entries.map((entry) => [entry.message, entry.message]));
	if (locale === 'en-GB')
		for (const entry of entries)
			strings.set(entry.message, entry.message.replace(/Organize/g, 'Organise').replace(/customize/g, 'customise'));
	if (!locale.startsWith('en-')) {
		const dataLocale = locale === 'es-419' ? 'es-ES' : locale;
		const data = JSON.parse(await readFile(resolve(dataPath, `${dataLocale}.json`), 'utf8'));
		for (const [key, messages] of Object.entries(schema)) {
			const translations = data[key].split('|');
			assert.equal(translations.length, messages.length, `${locale}/${key}: translation count`);
			messages.forEach((message, index) => {
				const translated = translations[index].trim();
				assert.ok(translated, `${locale}: empty translation for ${message}`);
				assert.deepEqual(placeholders(translated), placeholders(message), `${locale}: placeholders for ${message}`);
				assert.ok(
					translated !== message || ['Emoji', ...(data.unchanged ?? [])].includes(message),
					`${locale}: untranslated ${message}`,
				);
				strings.set(message, translated);
			});
		}
	}
	if (dataOnly) {
		checked += entries.length;
		continue;
	}
	const path = resolve(localesPath, locale, 'messages.po');
	const po = await readFile(path, 'utf8');
	const blocks = po.split(/\r?\n\r?\n/);
	const active = new Map(entries.map((entry) => [entry.id, entry]));
	const seen = new Set();
	const output = blocks.flatMap((block) => {
		const match = block.match(/^msgid (".*")$/m);
		if (!match) return [block];
		const id = JSON.parse(match[1]);
		// Each live module owns and validates its separate catalog.
		if (id.startsWith(`${prefix}logCatalog.`) || id.startsWith(`${prefix}automod.`)) return [block];
		if (id.startsWith(prefix) && !active.has(id)) {
			assert.ok(!check, `${locale}: obsolete message ${id}`);
			return [];
		}
		const entry = active.get(id);
		if (!entry) return [block];
		seen.add(id);
		const translation = strings.get(entry.message);
		if (check) {
			const value = block.match(/^msgstr (".*")$/m);
			assert.ok(value, `${locale}: missing translation ${id}`);
			assert.equal(JSON.parse(value[1]), translation, `${locale}: catalog mismatch ${id}`);
			if (id.startsWith(prefix))
				assert.ok(block.includes('#. js-lingui-explicit-id'), `${locale}: missing explicit ID flag`);
			return [block];
		}
		return [block.replace(/^msgstr "[\s\S]*$/m, `msgstr ${JSON.stringify(translation)}`)];
	});
	for (const entry of entries) {
		if (seen.has(entry.id)) continue;
		assert.ok(!check, `${locale}: missing ${entry.id}`);
		output.push(
			`#. Built-in community modules\n${entry.id.startsWith(prefix) ? '#. js-lingui-explicit-id\n' : ''}msgid ${JSON.stringify(entry.id)}\nmsgstr ${JSON.stringify(strings.get(entry.message))}`,
		);
	}
	if (!check) await writeFile(path, `${output.filter(Boolean).join('\n\n').trimEnd()}\n`, 'utf8');
	checked += entries.length;
}
console.log(
	`${dataOnly ? 'Validated' : check ? 'Checked' : 'Updated'} ${checked} translations across ${locales.length} locales; ${dataOnly ? 'placeholders verified' : 'placeholders and explicit IDs verified'}.`,
);
