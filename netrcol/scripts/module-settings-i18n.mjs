// SPDX-License-Identifier: AGPL-3.0-or-later
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolve} from 'node:path';

process.chdir(resolve(import.meta.dirname, '../..'));
const check = process.argv.includes('--check');
const data = JSON.parse(fs.readFileSync('netrcol/i18n/module-settings.json', 'utf8'));
const languages = [...fs.readFileSync('packages/constants/src/ModuleSettingsConstants.ts', 'utf8').matchAll(/'([a-z]{2}(?:-[A-Z0-9]+)?)'/g)].map(match => match[1]);
assert.equal(languages.length, 34);
assert.deepEqual(Object.keys(data).filter(key => key !== 'keys').sort(), [...languages].sort());
for (const language of languages) {
  assert.equal(data[language].length, data.keys.length);
  assert.ok(data[language].every(value => typeof value === 'string' && value.trim().length));
  const path = `fluxer_app/src/features/i18n/locales/${language}/messages.po`;
  const po = fs.readFileSync(path, 'utf8');
  const entries = data.keys.map((key, index) => `#. js-lingui-explicit-id\nmsgid ${JSON.stringify('netrcol.module_settings.' + key)}\nmsgstr ${JSON.stringify(data[language][index])}`);
  if (check) { for (const entry of entries) assert.ok(po.includes(entry), `Missing translation: ${language}: ${entry}`); }
  else {
    const blocks = po.split(/\r?\n\r?\n/).filter(block => !/^msgid "netrcol\.module_settings\./m.test(block));
    fs.writeFileSync(path, [...blocks, ...entries].join('\n\n').trimEnd() + '\n');
  }
}
console.log(`Module settings: ${data.keys.length} labels verified in ${languages.length} languages.`);
