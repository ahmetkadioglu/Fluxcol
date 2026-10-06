// SPDX-License-Identifier: AGPL-3.0-or-later

import {createGuildID, createUserID} from '@app/api/BrandedTypes';
import {Config} from '@app/api/Config';
import {BatchBuilder, setCassandraQueryExecutorForTesting} from '@app/api/database/CassandraQueryExecution';
import {ensurePostgresKvSchema, PostgresKvQueryExecutor} from '@app/api/database/PostgresKvQueryExecutor';
import {setInjectedWorkerService} from '@app/api/middleware/ServiceRegistry';
import {
	type AutoModInput,
	autoModEffectiveAction,
	autoModFingerprint,
	autoModRuleApplies,
	autoModScopeApplies,
	evaluateAutoMod,
} from '@app/api/netrcol/AutoModEngine';
import {AutoModRepository, autoModKey} from '@app/api/netrcol/AutoModRepository';
import {InMemoryCassandraQueryExecutor} from '@app/api/test/InMemoryCassandraQueryExecutor';
import {NoopWorkerService} from '@app/api/test/NoopWorkerService';
import {AUTO_MOD_RULE_IDS, type AutoModRuleId} from '@fluxer/constants/src/AutoModConstants';
import {AUTO_MOD_TRANSLATIONS} from '@fluxer/constants/src/AutoModTranslations';
import {
	AutoModSettings,
	defaultAutoModPermissions,
	defaultAutoModSettings,
	sharedAutoModPermissions,
} from '@fluxer/schema/src/domains/guild/GuildAutoModSchemas';
import {createSnowflakeFromTimestamp} from '@fluxer/snowflake/src/Snowflake';
import {getDefaultPostgresClient, initPostgres, shutdownPostgres} from '@pkgs/postgres/src/Client';
import {afterAll, afterEach, beforeEach, describe, expect, it} from 'vitest';

const input = (content = ''): AutoModInput => ({
	id: autoModKey('input'),
	guild_id: '100',
	user_id: '300',
	channel_id: '400',
	message_id: '500',
	kind: 'message',
	occurred_at: Date.now(),
	content,
	media: 0,
	edited: false,
});
describe('AutoMod detection and configuration', () => {
	it('preserves legacy all-account joins and enforcement while new configurations use seven days and log-only', () => {
		const fresh = defaultAutoModSettings();
		expect(fresh.rules.anti_raid.new_account_days).toBe(7);
		expect(fresh.rules.anti_nuke.log_only).toBe(true);
		const legacy = JSON.parse(JSON.stringify(fresh));
		for (const rule of Object.values(legacy.rules) as Array<Record<string, unknown>>) {
			delete rule.new_account_days;
			delete rule.log_only;
		}
		legacy.rules.anti_nuke.action = 'lockdown';
		const parsed = AutoModSettings.parse(legacy);
		expect(parsed.rules.anti_raid.new_account_days).toBe(0);
		expect(parsed.rules.anti_nuke.log_only).toBe(false);
		expect(autoModEffectiveAction(parsed, 'anti_nuke')).toBe('lockdown');
		expect(parsed.rules.anti_nuke.threshold).toBe(5);
		expect(parsed.rules.anti_nuke.window_seconds).toBe(60);
	});
	it.each([
		[0, true],
		[7, true],
		[365, true],
		[-1, false],
		[1.5, false],
		[366, false],
		[Number.NaN, false],
	] as const)('validates new account days %s', (days, valid) => {
		const settings = defaultAutoModSettings();
		settings.rules.anti_raid.new_account_days = days;
		expect(AutoModSettings.safeParse(settings).success).toBe(valid);
	});
	it.each([
		['disabled', true, 'disabled'],
		['lockdown', true, 'observe'],
		['lockdown', false, 'lockdown'],
		['observe', true, 'observe'],
		['observe', false, 'observe'],
	] as const)('uses %s with log-only %s as %s without enabling disabled rules', (action, logOnly, expected) => {
		const settings = defaultAutoModSettings();
		settings.rules.anti_nuke.action = action;
		settings.rules.anti_nuke.log_only = logOnly;
		expect(autoModEffectiveAction(settings, 'anti_nuke')).toBe(expected);
		settings.rules.anti_raid.action = 'lockdown';
		settings.rules.anti_raid.log_only = true;
		expect(autoModEffectiveAction(settings, 'anti_raid')).toBe('lockdown');
	});
	it('counts account age at join time, excludes old, future, unknown and out-of-window samples, and accepts late joins', () => {
		const settings = defaultAutoModSettings();
		settings.rules.anti_raid.action = 'observe';
		settings.rules.anti_raid.threshold = 2;
		const at = Date.now();
		const day = 86400000;
		const young = createSnowflakeFromTimestamp(at - day).toString();
		const event = {...input(), kind: 'join' as const, user_id: young, occurred_at: at};
		const sample = (user_id?: string, offset = 0) => ({
			id: `${user_id}:${offset}`,
			at: at + offset,
			user_id,
			text: '',
			media: 0,
			edited: false,
			rules: ['anti_raid' as const],
		});
		const current = sample(young);
		const old = sample(createSnowflakeFromTimestamp(at - 7 * day).toString());
		const future = sample(createSnowflakeFromTimestamp(at + 1).toString());
		const unknown = sample();
		expect(evaluateAutoMod(settings, event, [current, old, future, unknown, sample(young, -60000)])).toEqual([]);
		const justYoung = sample(createSnowflakeFromTimestamp(at - 7 * day + 1).toString());
		expect(evaluateAutoMod(settings, event, [current, justYoung])).toEqual(['anti_raid']);
		expect(evaluateAutoMod(settings, {...event, user_id: old.user_id!}, [current, justYoung])).toEqual([]);
		expect(evaluateAutoMod(settings, event, [current, {...justYoung, rules: ['anti_nuke']}])).toEqual([]);
		expect(evaluateAutoMod(settings, event, [current, sample(young, 1000)])).toEqual(['anti_raid']);
		// Account age is measured at the sample's own join time, not the newest event time.
		const crossedAge = sample(createSnowflakeFromTimestamp(at - 7 * day - 1000).toString(), -2000);
		expect(evaluateAutoMod(settings, event, [current, crossedAge])).toEqual(['anti_raid']);
		settings.rules.anti_raid.new_account_days = 0;
		expect(evaluateAutoMod(settings, {...event, user_id: old.user_id!}, [old, unknown])).toEqual(['anti_raid']);
	});
	it('starts with all fourteen rules and the module disabled', () => {
		const s = defaultAutoModSettings();
		expect(Object.keys(s.rules)).toHaveLength(14);
		expect(s.enabled).toBe(false);
		expect(evaluateAutoMod(s, input('spam'))).toEqual([]);
		expect(s.ignore_bots).toBe(true);
	});
	it.each<[AutoModRuleId, string]>([
		['bad_words', 'This is FORBIDDEN!'],
		['server_invites', 'https://discord.gg/abc'],
		['external_links', 'https://example.net/path'],
		['excessive_caps', 'ALL UPPERCASE TEXT'],
		['excessive_emojis', '😀😃😄😁😆😅😂🤣😊🙂🙃'],
		['excessive_spoilers', '||a|| ||b|| ||c|| ||d|| ||e|| ||f||'],
		['excessive_mentions', '<@1> <@2> <@3> <@4> <@5> <@6>'],
		['zalgo', 'a\u0300\u0301\u0302\u0303'],
		['character_limit', 'x'.repeat(2001)],
	])('detects %s', (id, content) => {
		const s = defaultAutoModSettings();
		s.rules[id].action = 'observe';
		s.rules.bad_words.words = ['forbidden'];
		expect(evaluateAutoMod(s, input(content))).toEqual([id]);
	});
	it.each(['repeated_text', 'anti_spam', 'media_spam', 'anti_raid', 'anti_nuke'] as const)(
		'counts %s within the shared sliding window',
		(id) => {
			const s = defaultAutoModSettings();
			s.rules[id].action = 'observe';
			s.rules[id].threshold = 3;
			s.rules.anti_raid.new_account_days = 0;
			const event = input('same');
			event.kind = id === 'anti_raid' ? 'join' : id === 'anti_nuke' ? 'audit' : 'message';
			event.media = id === 'media_spam' ? 1 : 0;
			const samples = [0, 1, 2].map((n) => ({
				id: String(n),
				at: event.occurred_at - n,
				text: autoModFingerprint('same'),
				media: event.media,
				edited: false,
			}));
			expect(evaluateAutoMod(s, event, samples)).toEqual([id]);
			expect(evaluateAutoMod(s, event, samples.slice(1))).toEqual([]);
		},
	);
	it.each([
		[1, true],
		[500, true],
		[10000, true],
		[0, false],
		[-1, false],
		[1.5, false],
		[10001, false],
	] as const)('validates a maximum character count of %s', (threshold, valid) => {
		const settings = defaultAutoModSettings();
		expect(settings.rules.character_limit.threshold).toBe(2000);
		settings.rules.character_limit.threshold = threshold;
		expect(AutoModSettings.safeParse(settings).success).toBe(valid);
	});
	it.each([
		['ASCII at the configured limit', 'x'.repeat(500), 500, false],
		['ASCII above the configured limit', 'x'.repeat(501), 500, true],
		['astral emoji at the limit', '😀'.repeat(500), 500, false],
		['astral emoji above the limit', '😀'.repeat(501), 500, true],
		['spaces and a line break at the limit', 'a b\nc', 5, false],
		['spaces and a line break above the limit', 'a b\nc', 4, true],
		['precomposed accented letter', 'é', 1, false],
		['separate combining accent', 'e\u0301', 1, true],
		['joined emoji at the limit', '👩‍💻', 3, false],
		['joined emoji above the limit', '👩‍💻', 2, true],
		['Markdown source at the limit', '**x**', 5, false],
		['Markdown source above the limit', '**x**', 4, true],
	] as const)(
		'counts message Unicode code points on creation and editing: %s',
		(_name, content, threshold, triggered) => {
			const settings = defaultAutoModSettings();
			settings.rules.character_limit.action = 'observe';
			settings.rules.character_limit.threshold = threshold;
			for (const edited of [false, true]) {
				expect(evaluateAutoMod(settings, {...input(content), edited})).toEqual(triggered ? ['character_limit'] : []);
			}
		},
	);
	it.each([1, 300, 301, 600])(
		'accepts an anti-spam window of %s seconds without changing other defaults',
		(seconds) => {
			const settings = defaultAutoModSettings();
			settings.rules.anti_spam.window_seconds = seconds;
			expect(AutoModSettings.parse(settings).rules.anti_spam.window_seconds).toBe(seconds);
			expect(settings.rules.repeated_text.window_seconds).toBe(10);
		},
	);
	it.each([0, 1.5, 601])('rejects an invalid anti-spam window of %s seconds', (seconds) => {
		const settings = defaultAutoModSettings();
		settings.rules.anti_spam.window_seconds = seconds;
		expect(AutoModSettings.safeParse(settings).success).toBe(false);
	});
	it('keeps the existing 300-second ceiling for other rules and legacy anti-spam message limits', () => {
		const settings = defaultAutoModSettings();
		settings.rules.anti_spam.threshold = 1000;
		expect(AutoModSettings.safeParse(settings).success).toBe(true);
		settings.rules.repeated_text.window_seconds = 301;
		expect(AutoModSettings.safeParse(settings).success).toBe(false);
	});
	it('counts the entire 600-second anti-spam window, excludes its boundary and ignores edits and unrelated rule samples', () => {
		const settings = defaultAutoModSettings();
		settings.rules.anti_spam.action = 'observe';
		settings.rules.anti_spam.threshold = 3;
		settings.rules.anti_spam.window_seconds = 600;
		const event = input('new');
		const sample = (id: string, age: number) => ({
			id,
			at: event.occurred_at - age,
			text: id,
			media: 0,
			edited: false,
			rules: ['anti_spam'] as Array<AutoModRuleId>,
		});
		const samples = [sample('current', 0), sample('middle', 400000), sample('inside', 599999)];
		expect(evaluateAutoMod(settings, event, samples)).toEqual(['anti_spam']);
		const excluded = [
			sample('current', 0),
			sample('middle', 400000),
			sample('boundary', 600000),
			{...sample('edited', 1), edited: true},
			{...sample('other-rule', 1), rules: ['media_spam'] as Array<AutoModRuleId>},
		];
		expect(evaluateAutoMod(settings, event, excluded)).toEqual([]);
		expect(evaluateAutoMod(settings, {...event, edited: true}, samples)).toEqual([]);
	});
	it.each([1, 5, 300, 301, 600])('accepts a media-spam window of %s seconds, including legacy values', (seconds) => {
		const settings = defaultAutoModSettings();
		settings.rules.media_spam.window_seconds = seconds;
		settings.rules.media_spam.threshold = 10000;
		expect(AutoModSettings.parse(settings).rules.media_spam).toEqual(settings.rules.media_spam);
		expect(settings.rules.repeated_text.window_seconds).toBe(10);
	});
	it.each([0, 1.5, 601])('rejects an invalid media-spam window of %s seconds', (seconds) => {
		const settings = defaultAutoModSettings();
		settings.rules.media_spam.window_seconds = seconds;
		expect(AutoModSettings.safeParse(settings).success).toBe(false);
	});
	it('sums media items across the entire window and excludes the boundary, edits and other rule samples', () => {
		const settings = defaultAutoModSettings();
		settings.rules.media_spam.action = 'observe';
		settings.rules.media_spam.threshold = 5;
		settings.rules.media_spam.window_seconds = 600;
		const event = {...input('new media'), media: 1};
		const sample = (id: string, age: number, media: number) => ({
			id,
			at: event.occurred_at - age,
			text: id,
			media,
			edited: false,
			rules: ['media_spam'] as Array<AutoModRuleId>,
		});
		const samples = [sample('current', 0, 1), sample('middle', 400000, 2), sample('inside', 599999, 2)];
		expect(evaluateAutoMod(settings, event, samples)).toEqual(['media_spam']);
		expect(evaluateAutoMod(settings, event, [sample('batch', 0, 5)])).toEqual(['media_spam']);
		const excluded = [
			sample('current', 0, 1),
			sample('middle', 400000, 2),
			sample('boundary', 600000, 2),
			{...sample('edited', 1, 2), edited: true},
			{...sample('other-rule', 1, 2), rules: ['anti_spam'] as Array<AutoModRuleId>},
		];
		expect(evaluateAutoMod(settings, event, excluded)).toEqual([]);
		expect(evaluateAutoMod(settings, {...event, edited: true}, samples)).toEqual([]);
		expect(evaluateAutoMod(settings, {...event, media: 0}, samples)).toEqual([]);
	});
	it('preserves Unicode words and word boundaries without regex injection', () => {
		const s = defaultAutoModSettings();
		s.rules.bad_words.action = 'observe';
		s.rules.bad_words.words = ['kötü', '[word]'];
		expect(evaluateAutoMod(s, input('KÖTÜ!'))).toEqual(['bad_words']);
		expect(evaluateAutoMod(s, input('kötülük'))).toEqual([]);
		expect(evaluateAutoMod(s, input('[word]'))).toEqual(['bad_words']);
	});
	it('keeps exact and partial matches independent and accepts partial-only rules', () => {
		const settings = defaultAutoModSettings();
		settings.rules.bad_words.action = 'delete';
		settings.rules.bad_words.words = ['how'];
		expect(evaluateAutoMod(settings, input('SHOWCASE'))).toEqual([]);
		expect(evaluateAutoMod(settings, input('How?'))).toEqual(['bad_words']);
		settings.rules.bad_words.words = [];
		settings.rules.bad_words.partial_words = ['how', 'kötü', '[x]'];
		expect(AutoModSettings.safeParse(settings).success).toBe(true);
		for (const text of ['SHOWCASE', 'kötülük', 'prefix[x]suffix'])
			expect(evaluateAutoMod(settings, input(text))).toEqual(['bad_words']);
		expect(evaluateAutoMod(settings, input('clean'))).toEqual([]);
	});
	it('reads existing lists and channel/role exemptions without changing their meaning', () => {
		const old = JSON.parse(JSON.stringify(defaultAutoModSettings()));
		old.exempt_channel_ids = ['400'];
		old.exempt_role_ids = ['600'];
		old.rules.bad_words.words = ['how'];
		for (const rule of Object.values(old.rules) as Array<Record<string, unknown>>) {
			delete rule.partial_words;
			delete rule.permissions;
		}
		const settings = AutoModSettings.parse(old);
		expect(settings.rules.bad_words.partial_words).toEqual([]);
		expect(settings.rules.bad_words.permissions).toBeNull();
		expect(sharedAutoModPermissions(settings).channels.ids).toEqual(['400']);
		expect(sharedAutoModPermissions(settings).roles.ids).toEqual(['600']);
		expect(
			autoModRuleApplies(settings, 'bad_words', {
				user_id: '300',
				role_ids: ['600'],
				channel_id: '401',
				category_id: null,
			}),
		).toBe(false);
	});
	it('gives explicit user choices priority over roles while enforcing channel and category boundaries', () => {
		const scope = defaultAutoModPermissions();
		const context = {
			user_id: '300',
			role_ids: ['600'],
			channel_id: '400',
			category_id: '700',
		};
		scope.roles.ids = ['600'];
		expect(autoModScopeApplies(scope, context)).toBe(false);
		scope.users = {mode: 'include', ids: ['300']};
		expect(autoModScopeApplies(scope, context)).toBe(true);
		expect(autoModScopeApplies(scope, {...context, user_id: '301'})).toBe(false);
		scope.channels.ids = ['400'];
		expect(autoModScopeApplies(scope, context)).toBe(false);
		scope.channels = {mode: 'include', ids: ['400']};
		scope.categories = {mode: 'include', ids: ['700']};
		expect(autoModScopeApplies(scope, context)).toBe(true);
		expect(autoModScopeApplies(scope, {...context, category_id: null})).toBe(false);
		scope.categories.ids = [];
		expect(autoModScopeApplies(scope, context)).toBe(false);
		scope.categories = {mode: 'exclude', ids: []};
		scope.users = {mode: 'exclude', ids: ['300']};
		scope.roles = {mode: 'include', ids: ['600']};
		expect(autoModScopeApplies(scope, context)).toBe(false);
	});
	it('uses separate rule permissions in place of shared permissions and keeps counters scoped', () => {
		const settings = defaultAutoModSettings();
		settings.exempt_channel_ids = ['400'];
		const context = {
			user_id: '300',
			role_ids: [],
			channel_id: '400',
			category_id: null,
		};
		expect(autoModRuleApplies(settings, 'bad_words', context)).toBe(false);
		settings.rules.bad_words.permissions = defaultAutoModPermissions();
		expect(autoModRuleApplies(settings, 'bad_words', context)).toBe(true);
		expect(autoModRuleApplies(settings, 'anti_spam', context)).toBe(false);
		settings.rules.anti_spam.action = 'observe';
		settings.rules.anti_spam.threshold = 2;
		const event = input('same');
		const samples = [0, 1].map((n) => ({
			id: String(n),
			at: event.occurred_at - n,
			text: autoModFingerprint('same'),
			media: 0,
			edited: false,
			rules: ['bad_words' as const],
		}));
		expect(evaluateAutoMod(settings, event, samples)).toEqual([]);
	});
	it.each(['anti_spam', 'anti_raid', 'anti_nuke'] as const)(
		'handles out-of-order %s inputs without missing the burst',
		(id) => {
			const settings = defaultAutoModSettings();
			settings.rules[id].action = 'observe';
			settings.rules[id].threshold = 2;
			settings.rules.anti_raid.new_account_days = 0;
			const event = {
				...input('same'),
				kind: id === 'anti_spam' ? ('message' as const) : id === 'anti_raid' ? ('join' as const) : ('audit' as const),
			};
			const samples = [0, 1000].map((offset) => ({
				id: String(offset),
				at: event.occurred_at + offset,
				text: autoModFingerprint('same'),
				media: 0,
				edited: false,
			}));
			expect(evaluateAutoMod(settings, event, samples)).toEqual([id]);
			expect(evaluateAutoMod(settings, {...event, occurred_at: event.occurred_at - 300001}, samples)).toEqual([]);
		},
	);
	it.each([
		[`${'A'.repeat(14)} 1234567890 😀 中文 العربية`, false],
		['A'.repeat(14) + 'a'.repeat(6), false],
		['A'.repeat(15) + 'a'.repeat(5), true],
		[`${'A'.repeat(15)} 1234567890 😀 中文 العربية`, true],
		[`${'İĞÜŞÖÇ'.repeat(3)}ığüşöç`, true],
		['中文 العربية 1234567890 😀', false],
	])('uses the saved caps minimum and strict percentage boundary for %s', (content, triggered) => {
		const settings = defaultAutoModSettings();
		settings.rules.excessive_caps.action = 'observe';
		settings.rules.excessive_caps.minimum_length = 15;
		settings.rules.excessive_caps.threshold = 70;
		expect(evaluateAutoMod(settings, input(content))).toEqual(triggered ? ['excessive_caps'] : []);
	});
	it('ignores short caps, permitted domains and an allowed domain lookalike', () => {
		const s = defaultAutoModSettings();
		s.rules.excessive_caps.action = 'observe';
		s.rules.external_links.action = 'observe';
		s.rules.external_links.allowed_domains = ['example.org'];
		expect(evaluateAutoMod(s, input('OK https://sub.example.org'))).toEqual([]);
		expect(evaluateAutoMod(s, input('https://example.org.evil.com'))).toEqual(['external_links']);
	});
	it('does not double count joined emoji sequences and duplicate mentions', () => {
		const s = defaultAutoModSettings();
		s.rules.excessive_emojis.action = 'observe';
		s.rules.excessive_emojis.threshold = 1;
		s.rules.excessive_mentions.action = 'observe';
		s.rules.excessive_mentions.threshold = 1;
		expect(evaluateAutoMod(s, input('👩‍👩‍👧‍👦 <@1> <@1>'))).toEqual([]);
	});
	it.each(['👩‍👩‍👧‍👦', '👍🏽', '🇹🇷', '1️⃣', '<:wave:123>', '<a:wave:123>'])(
		'counts %s as one emoji, with the second emoji crossing the saved limit',
		(emoji) => {
			const settings = defaultAutoModSettings();
			settings.rules.excessive_emojis.action = 'observe';
			settings.rules.excessive_emojis.threshold = 1;
			expect(evaluateAutoMod(settings, input(`text 123 ${emoji}`))).toEqual([]);
			expect(evaluateAutoMod(settings, input(`${emoji}😀`))).toEqual(['excessive_emojis']);
		},
	);
	it('allows twelve emojis at a configured limit of twelve and triggers on thirteen', () => {
		const settings = defaultAutoModSettings();
		settings.rules.excessive_emojis.action = 'observe';
		settings.rules.excessive_emojis.threshold = 12;
		expect(evaluateAutoMod(settings, input('😀'.repeat(12)))).toEqual([]);
		expect(evaluateAutoMod(settings, input('😀'.repeat(13)))).toEqual(['excessive_emojis']);
	});
	it.each<[string, boolean]>([
		['plain text | single pipe | and an unfinished || section', false],
		['||a|| ||b|| ||c|| ||d|| ||e||', false],
		['||a|| ||b|| ||c|| ||d|| ||e|| ||f||', true],
		['||first line\nsecond line||'.repeat(5), false],
		['||first line\nsecond line||'.repeat(6), true],
		['||||'.repeat(6), true],
	])('counts complete spoiler sections with a strict limit of five: %s', (content, triggered) => {
		const settings = defaultAutoModSettings();
		settings.rules.excessive_spoilers.action = 'observe';
		for (const edited of [false, true]) {
			expect(evaluateAutoMod(settings, {...input(content), edited})).toEqual(triggered ? ['excessive_spoilers'] : []);
		}
	});
	it.each<[string, boolean]>([
		['@name <@broken> <@&> <#123> @everyones @hereafter', false],
		['<@1> <@2> <@&3> @everyone @here', false],
		['<@1> <@2> <@&3> @everyone @here <@!4>', true],
		['<@1> '.repeat(6), false],
		['<@1> <@!1> <@2> <@!2> <@3> <@!3>', false],
		['<@&1> '.repeat(6), false],
		['@everyone @here '.repeat(6), false],
		['<@!1> <@!2> <@!3> <@!4> <@!5>', false],
		['<@!1> <@!2> <@!3> <@!4> <@!5> <@!6>', true],
	])('counts distinct mention tags with a strict limit of five: %s', (content, triggered) => {
		const settings = defaultAutoModSettings();
		settings.rules.excessive_mentions.action = 'observe';
		for (const edited of [false, true]) {
			expect(evaluateAutoMod(settings, {...input(content), edited})).toEqual(triggered ? ['excessive_mentions'] : []);
		}
	});
	it.each<[string, boolean]>([
		['Ordinary accents: café, e\u0301', false],
		['a\u0300\u0301\u0302', false],
		['a\u0300\u0301\u0302\u0303', true],
		['e\u0301'.repeat(12), false],
		['a\u0300\u0301\u0302 '.repeat(4), false],
		['👩‍👩‍👧‍👦 👍🏽 🇹🇷 1️⃣'.repeat(4), false],
		['नमस्ते दुनिया مُرَحَّبًا', false],
		[`a${'\u{1D165}'.repeat(3)}`, false],
		[`a${'\u{1D165}'.repeat(4)}`, true],
	])('checks consecutive Unicode marks against the saved Zalgo default: %s', (content, triggered) => {
		const settings = defaultAutoModSettings();
		settings.rules.zalgo.action = 'observe';
		for (const edited of [false, true]) {
			expect(evaluateAutoMod(settings, {...input(content), edited})).toEqual(triggered ? ['zalgo'] : []);
		}
	});
	it('recognizes native and self-hosted invite paths without blocking ordinary Fluxer pages', () => {
		const settings = defaultAutoModSettings();
		settings.rules.server_invites.action = 'observe';
		expect(evaluateAutoMod(settings, input('https://fluxer.app/channels/@me'))).toEqual([]);
		expect(evaluateAutoMod(settings, input('https://localhost:8088/invite/code'))).toEqual(['server_invites']);
		expect(evaluateAutoMod(settings, input('fluxer.gg/code'))).toEqual(['server_invites']);
		settings.rules.server_invites.allowed_domains = ['fluxer.app'];
		expect(evaluateAutoMod(settings, input('https://fluxer.app/invite/code'))).toEqual([]);
		expect(evaluateAutoMod(settings, input('https://fluxer.app.evil.org/invite/code'))).toEqual(['server_invites']);
	});
	it('shares literal URL-prefix exemptions across invite and external-link filters without exempting other rules', () => {
		const settings = defaultAutoModSettings();
		settings.rules.server_invites.action = 'observe';
		settings.rules.external_links.action = 'observe';
		settings.rules.bad_words.action = 'observe';
		settings.rules.bad_words.words = ['blocked'];
		settings.link_whitelist = [
			'https://fluxer.app/invite/Allowed',
			'https://example.org/allowed/',
			'https://example.org/search?',
		];
		for (const link of [
			'https://fluxer.app/invite/Allowed123?query=1',
			'https://example.org/allowed/page',
			'https://example.org/allowed/?redirect=https://discord.gg/code',
			'https://example.org/search?',
		])
			expect(evaluateAutoMod(settings, input(link))).toEqual([]);
		expect(evaluateAutoMod(settings, input('blocked https://fluxer.app/invite/Allowed'))).toEqual(['bad_words']);
		for (const link of [
			'http://fluxer.app/invite/Allowed',
			'https://fluxer.app/invite/allowed',
			'https://FLUXER.app/invite/Allowed',
			'https://fluxer.app/invite/Other',
		])
			expect(evaluateAutoMod(settings, input(link))).toEqual(['server_invites', 'external_links']);
		expect(evaluateAutoMod(settings, input('https://example.org/Allowed/page'))).toEqual(['external_links']);
		expect(evaluateAutoMod(settings, input('https://example.org/allowed/page https://discord.gg/other'))).toEqual([
			'server_invites',
			'external_links',
		]);
		expect(evaluateAutoMod(settings, input('fluxer.gg/Allowed'))).toEqual(['server_invites']);
	});
	it('reads older settings with an empty shared link list and validates its size and URL syntax', () => {
		const {link_whitelist: _oldList, ...legacy} = defaultAutoModSettings();
		expect(AutoModSettings.parse(legacy).link_whitelist).toEqual([]);
		for (const prefix of [
			'example.org',
			'javascript:alert(1)',
			'https://',
			'https://example.org/a b',
			'https://user:pass@example.org/',
			`https://example.org/${'x'.repeat(2048)}`,
		])
			expect(AutoModSettings.safeParse({...legacy, link_whitelist: [prefix]}).success).toBe(false);
		expect(
			AutoModSettings.safeParse({
				...legacy,
				link_whitelist: Array.from({length: 101}, (_, n) => `https://example.org/${n}`),
			}).success,
		).toBe(false);
		expect(
			AutoModSettings.parse({
				...legacy,
				link_whitelist: [' https://example.org/Allowed/ '],
			}).link_whitelist,
		).toEqual(['https://example.org/Allowed/']);
	});
	it('does not treat edits as new spam, media spam or repeated messages', () => {
		const s = defaultAutoModSettings();
		for (const id of ['anti_spam', 'media_spam', 'repeated_text'] as const) {
			s.rules[id].action = 'observe';
			s.rules[id].threshold = 1;
		}
		const event = {...input('same'), edited: true, media: 5};
		expect(
			evaluateAutoMod(s, event, [
				{
					id: event.id,
					at: event.occurred_at,
					text: autoModFingerprint('same'),
					media: 5,
					edited: true,
				},
			]),
		).toEqual([]);
	});
	it('rejects missing checks, incompatible actions, missing words and invalid domain patterns', () => {
		const s = defaultAutoModSettings();
		s.rules.anti_raid.action = 'delete';
		expect(AutoModSettings.safeParse(s).success).toBe(false);
		s.rules.anti_raid.action = 'disabled';
		s.rules.bad_words.action = 'delete';
		expect(AutoModSettings.safeParse(s).success).toBe(false);
		s.rules.bad_words.words = ['spam'];
		s.rules.external_links.allowed_domains = ['.*'];
		expect(AutoModSettings.safeParse(s).success).toBe(false);
	});
	it('has complete meaningful rule and action translations in all 34 locales', () => {
		expect(Object.keys(AUTO_MOD_TRANSLATIONS)).toHaveLength(34);
		for (const copy of Object.values(AUTO_MOD_TRANSLATIONS)) {
			for (const id of AUTO_MOD_RULE_IDS) expect(copy[id]?.trim()).toBeTruthy();
			for (const id of ['delete_warn', 'delete_timeout', 'warn', 'lockdown', 'observe'])
				expect(copy[id]?.trim()).toBeTruthy();
			for (const id of [
				'exactWords',
				'partialWords',
				'inherited',
				'separate',
				'allExcept',
				'onlySelected',
				'userPriority',
				'saveClose',
				'discard',
				'wordHint',
				'matchingHint',
				'linkWhitelist',
				'linkHint',
				'linkInvalid',
			])
				expect(copy[id]?.trim()).toBeTruthy();
		}
		expect(AUTO_MOD_TRANSLATIONS.tr!.anti_nuke).toBe('Sunucu tahribatı koruması');
	});
});
describe('AutoMod durable policy and counters', () => {
	const original = {
		selfHosted: Config.instance.selfHosted,
		backend: Config.database.backend,
	};
	const guildId = createGuildID(100n),
		userId = createUserID(200n);
	let repository: AutoModRepository;
	const url = process.env.NETRCOL_TEST_POSTGRES_URL;
	beforeEach(async () => {
		Config.instance.selfHosted = true;
		Config.database.backend = 'postgres';
		delete process.env.NETRCOL_AUTOMATIONS_ENABLED;
		if (url) {
			await initPostgres({url, kvTable: 'kv_automod_unit'});
			await ensurePostgresKvSchema(getDefaultPostgresClient());
			await getDefaultPostgresClient().query('TRUNCATE kv_automod_unit');
			setCassandraQueryExecutorForTesting(new PostgresKvQueryExecutor(getDefaultPostgresClient()));
		} else setCassandraQueryExecutorForTesting(new InMemoryCassandraQueryExecutor());
		setInjectedWorkerService(new NoopWorkerService());
		repository = new AutoModRepository();
	});
	afterEach(() => {
		Config.instance.selfHosted = original.selfHosted;
		Config.database.backend = original.backend;
		delete process.env.NETRCOL_AUTOMATIONS_ENABLED;
	});
	afterAll(async () => {
		if (url) await shutdownPostgres();
	});
	it('uses optimistic revisions and preserves configuration after a reload', async () => {
		const s = defaultAutoModSettings();
		await repository.save(guildId, userId, s, 0);
		await expect(repository.save(guildId, userId, s, 0)).rejects.toThrow();
		expect((await new AutoModRepository().config(guildId)).revision).toBe(1);
	});
	it('deduplicates committed inputs and prevents competing worker leases', async () => {
		const s = defaultAutoModSettings();
		s.enabled = true;
		s.rules.anti_spam.action = 'observe';
		await repository.save(guildId, userId, s, 0);
		const queries = await repository.prepare(guildId, input('test'));
		for (let n = 0; n < 2; n++) {
			const batch = new BatchBuilder();
			for (const q of queries) batch.addPrepared(q);
			await batch.execute();
		}
		const rows = await repository.pending();
		expect(rows).toHaveLength(1);
		expect(await repository.claim(rows[0]!)).not.toBeNull();
		expect(await repository.claim({...rows[0]!, version: 1})).toBeNull();
	});
	it('counts concurrent inputs once and excludes expired samples', async () => {
		const sample = {
			id: 'a',
			at: Date.now(),
			text: autoModFingerprint('same'),
			media: 0,
			edited: false,
		};
		await repository.sample(guildId, 'window', {
			...sample,
			id: 'old',
			at: Date.now() - 700000,
		});
		await Promise.all(['a', 'b', 'c'].map((id) => repository.sample(guildId, 'window', {...sample, id})));
		const result = await repository.sample(guildId, 'window', sample);
		expect(result.map((s) => s.id).sort()).toEqual(['a', 'b', 'c']);
		expect(result[0]!.text).not.toBe('same');
	});
	it('retains older in-window anti-spam samples beyond five minutes and deduplicates them', async () => {
		const now = Date.now();
		const sample = {id: 'older', at: now - 400000, text: 'fingerprint', media: 0, edited: false};
		await repository.sample(guildId, 'long-window', sample);
		await repository.sample(guildId, 'long-window', {...sample, id: 'expired', at: now - 700000});
		const result = await repository.sample(guildId, 'long-window', {...sample, id: 'current', at: now});
		expect(result.map((entry) => entry.id)).toEqual(['older', 'current']);
		expect(await repository.sample(guildId, 'long-window', sample)).toEqual(result);
	});
	it('invalidates temporary holds after policy changes', async () => {
		await repository.save(guildId, userId, defaultAutoModSettings(), 0);
		const config = await repository.config(guildId);
		await repository.hold(guildId, 'raid_hold', Date.now() + 10000, config);
		expect(await repository.holdUntil(guildId, 'raid_hold', config)).toBeGreaterThan(Date.now());
		await repository.save(guildId, userId, config.settings, 1);
		expect(await repository.holdUntil(guildId, 'raid_hold', await repository.config(guildId))).toBe(0);
	});
	it('honors the operator stop switch before ingestion', async () => {
		process.env.NETRCOL_AUTOMATIONS_ENABLED = 'false';
		expect(await repository.prepare(guildId, input())).toEqual([]);
	});
	it('never shortens a hold when concurrent or older detections arrive', async () => {
		await repository.save(guildId, userId, defaultAutoModSettings(), 0);
		const config = await repository.config(guildId);
		const later = Date.now() + 60000;
		await Promise.all(
			[later, later - 20000, later - 10000].map((until) => repository.hold(guildId, 'raid_hold', until, config)),
		);
		expect(await repository.holdUntil(guildId, 'raid_hold', config)).toBe(later);
	});
	it('reconciles a terminal job once and rejects reingestion after queue removal', async () => {
		const settings = defaultAutoModSettings();
		settings.enabled = true;
		settings.rules.anti_spam.action = 'observe';
		await repository.save(guildId, userId, settings, 0);
		const event = input('test');
		const batch = new BatchBuilder();
		for (const q of await repository.prepare(guildId, event)) batch.addPrepared(q);
		await batch.execute();
		const row = (await repository.pending())[0]!;
		const job = (await repository.claim(row))!;
		job.rules = ['anti_spam'];
		job.actions = ['observe'];
		job.status = 'done';
		job.outcome = 'observed';
		job.content = '';
		await repository.update(row, job);
		const recovered = (await repository.claim(row))!;
		await repository.finish(guildId, row, recovered, recovered.outcome!);
		await repository.finish(guildId, row, recovered, recovered.outcome!);
		expect(await repository.pending()).toHaveLength(0);
		expect((await repository.history(guildId)).filter((entry) => entry.id === event.id)).toHaveLength(1);
		expect(await repository.prepare(guildId, event)).toEqual([]);
	});
});
