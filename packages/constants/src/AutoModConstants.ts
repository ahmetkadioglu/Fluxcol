// SPDX-License-Identifier: AGPL-3.0-or-later

export const AUTO_MOD_RULE_IDS = [
	'bad_words',
	'repeated_text',
	'server_invites',
	'external_links',
	'excessive_caps',
	'excessive_emojis',
	'excessive_spoilers',
	'excessive_mentions',
	'zalgo',
	'anti_spam',
	'character_limit',
	'media_spam',
	'anti_raid',
	'anti_nuke',
] as const;
export type AutoModRuleId = (typeof AUTO_MOD_RULE_IDS)[number];
export const AUTO_MOD_MAX_WINDOW_SECONDS = 600;
export const AUTO_MOD_ACTIONS = [
	'disabled',
	'observe',
	'warn',
	'delete',
	'delete_warn',
	'timeout',
	'delete_timeout',
	'lockdown',
] as const;
export type AutoModAction = (typeof AUTO_MOD_ACTIONS)[number];
export function autoModActions(rule: AutoModRuleId): ReadonlyArray<AutoModAction> {
	return rule === 'anti_raid' || rule === 'anti_nuke'
		? ['disabled', 'observe', 'lockdown']
		: ['disabled', 'observe', 'warn', 'delete', 'delete_warn', 'timeout', 'delete_timeout'];
}
export const AUTO_MOD_DEFAULT_THRESHOLDS: Record<AutoModRuleId, number> = {
	bad_words: 1,
	repeated_text: 3,
	server_invites: 1,
	external_links: 1,
	excessive_caps: 70,
	excessive_emojis: 10,
	excessive_spoilers: 5,
	excessive_mentions: 5,
	zalgo: 3,
	anti_spam: 5,
	character_limit: 2000,
	media_spam: 5,
	anti_raid: 10,
	anti_nuke: 5,
};
export const AUTO_MOD_WINDOW_RULES: ReadonlyArray<AutoModRuleId> = [
	'repeated_text',
	'anti_spam',
	'media_spam',
	'anti_raid',
	'anti_nuke',
];
