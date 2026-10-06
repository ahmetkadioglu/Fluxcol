// SPDX-License-Identifier: AGPL-3.0-or-later

import {createHash} from 'node:crypto';
import {AUTO_MOD_RULE_IDS, type AutoModRuleId} from '@fluxer/constants/src/AutoModConstants';
import {
	type AutoModPermissions,
	type AutoModSettings,
	sharedAutoModPermissions,
} from '@fluxer/schema/src/domains/guild/GuildAutoModSchemas';
import {extractTimestamp} from '@fluxer/snowflake/src/SnowflakeUtils';

export interface AutoModInput {
	id: string;
	guild_id: string;
	user_id: string;
	channel_id: string | null;
	message_id: string | null;
	kind: 'message' | 'join' | 'audit';
	occurred_at: number;
	content: string;
	media: number;
	edited: boolean;
}
export interface AutoModSample {
	id: string;
	at: number;
	text: string;
	media: number;
	edited: boolean;
	rules?: Array<AutoModRuleId>;
	user_id?: string;
}

export function autoModEffectiveAction(settings: AutoModSettings, id: AutoModRuleId) {
	const rule = settings.rules[id];
	return id === 'anti_nuke' && rule.log_only && rule.action !== 'disabled' ? 'observe' : rule.action;
}

function raidAccountMatches(userId: string | undefined, at: number, days: number) {
	if (days === 0) return true;
	if (!userId) return false;
	const age = at - extractTimestamp(userId);
	return age >= 0 && age < days * 86400000;
}
export interface AutoModMemberScope {
	user_id: string;
	role_ids: Array<string>;
	channel_id: string | null;
	category_id: string | null;
}
export function autoModScopeApplies(permissions: AutoModPermissions, context: AutoModMemberScope): boolean {
	const selectedUser = permissions.users.ids.includes(context.user_id);
	// Explicit member selections decide before roles; channel/category boundaries still apply.
	const memberApplies = selectedUser
		? permissions.users.mode === 'include'
		: permissions.users.mode === 'exclude' &&
			(permissions.roles.mode === 'include'
				? context.role_ids.some((id) => permissions.roles.ids.includes(id))
				: !context.role_ids.some((id) => permissions.roles.ids.includes(id)));
	const inScope = (scope: AutoModPermissions['channels'], id: string | null) =>
		scope.mode === 'include' ? id !== null && scope.ids.includes(id) : id === null || !scope.ids.includes(id);
	return (
		memberApplies &&
		inScope(permissions.channels, context.channel_id) &&
		inScope(permissions.categories, context.category_id)
	);
}
export function autoModRuleApplies(settings: AutoModSettings, id: AutoModRuleId, context: AutoModMemberScope) {
	return autoModScopeApplies(settings.rules[id].permissions ?? sharedAutoModPermissions(settings), context);
}
export const normalizeAutoModText = (text: string) =>
	text
		.normalize('NFKC')
		.replace(/[\u200B-\u200D\uFEFF]/gu, '')
		.toLocaleLowerCase('und')
		.replace(/i\u0307/gu, 'i')
		.replace(/\s+/gu, ' ')
		.trim();
export const autoModFingerprint = (text: string) =>
	createHash('sha256').update(normalizeAutoModText(text)).digest('hex');
export function autoModLinks(content: string): Array<string> {
	return Array.from(content.matchAll(/(?:https?:\/\/|www\.)[^\s<>]+/giu), (match) =>
		match[0].replace(/[.,!?;:)]+$/u, ''),
	);
}
function allowedDomain(link: string, domains: ReadonlyArray<string>) {
	try {
		const host = new URL(/^https?:\/\//i.test(link) ? link : `https://${link}`).hostname.toLowerCase();
		return domains.some((domain) => host === domain.toLowerCase() || host.endsWith(`.${domain.toLowerCase()}`));
	} catch {
		return false;
	}
}
function allowedLinkPrefix(link: string, prefixes: ReadonlyArray<string>) {
	return prefixes.some((prefix) => link.startsWith(prefix));
}
export function evaluateAutoMod(
	settings: AutoModSettings,
	input: AutoModInput,
	samples: ReadonlyArray<AutoModSample> = [],
): Array<AutoModRuleId> {
	const text = normalizeAutoModText(input.content);
	// Exempt a complete URL, including invite-looking text inside its query/path.
	const linkContent = input.content.replace(/(?:https?:\/\/|www\.)[^\s<>]+/giu, (link) =>
		allowedLinkPrefix(link, settings.link_whitelist) ? ' ' : link,
	);
	const links = autoModLinks(linkContent);
	const letters = [...input.content].filter(
		(char) => /\p{L}/u.test(char) && char.toLocaleUpperCase('und') !== char.toLocaleLowerCase('und'),
	);
	const caps = letters.filter((char) => char === char.toLocaleUpperCase('und')).length;
	const emoji = (
		input.content.match(
			/<a?:[^:>\s]+:\d+>|(?:\p{Regional_Indicator}{2})|(?:\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*)|[0-9#*]\uFE0F?\u20E3/gu,
		) ?? []
	).length;
	// Both member mention spellings address the same user; roles and broadcast tags stay distinct.
	const mentions = new Set(
		(input.content.match(/<@!?\d+>|<@&\d+>|@everyone\b|@here\b/gu) ?? []).map((tag) => tag.replace(/^<@!/, '<@')),
	).size;
	// Wake-ups can arrive out of order. Count the latest complete event-time window,
	// including a late input only when it still belongs to that window.
	const windowEnd = samples.reduce((at, sample) => Math.max(at, sample.at), input.occurred_at);
	return AUTO_MOD_RULE_IDS.filter((id) => {
		const rule = settings.rules[id];
		if (rule.action === 'disabled') return false;
		if (input.kind !== 'message') {
			if ((input.kind === 'join' && id !== 'anti_raid') || (input.kind === 'audit' && id !== 'anti_nuke')) return false;
			if (id === 'anti_raid' && !raidAccountMatches(input.user_id, input.occurred_at, rule.new_account_days))
				return false;
			return (
				input.occurred_at > windowEnd - rule.window_seconds * 1000 &&
				samples.filter(
					(s) =>
						(!s.rules || s.rules.includes(id)) &&
						s.at > windowEnd - rule.window_seconds * 1000 &&
						(id !== 'anti_raid' || raidAccountMatches(s.user_id, s.at, rule.new_account_days)),
				).length >= rule.threshold
			);
		}
		const window = samples.filter(
			(s) => (!s.rules || s.rules.includes(id)) && !s.edited && s.at > windowEnd - rule.window_seconds * 1000,
		);
		switch (id) {
			case 'bad_words':
				return (
					rule.partial_words.some((word) => {
						const value = normalizeAutoModText(word);
						return !!value && text.includes(value);
					}) ||
					rule.words.some((word) => {
						const value = normalizeAutoModText(word);
						if (!value) return false;
						const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
						return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u').test(text);
					})
				);
			case 'repeated_text':
				return (
					!input.edited &&
					input.occurred_at > windowEnd - rule.window_seconds * 1000 &&
					!!text &&
					window.filter((s) => s.text === autoModFingerprint(text)).length >= rule.threshold
				);
			case 'server_invites':
				return [
					...linkContent.matchAll(
						/(?<![a-z0-9@.-])(?:https?:\/\/)?(?:www\.)?(?:discord\.gg\/|discord(?:app)?\.com\/invite\/|fluxer\.gg\/|fluxer\.app\/invite\/)[a-z0-9-]+|https?:\/\/[^\s/]+\/invite\/[a-z0-9-]+/giu,
					),
				].some((match) => !allowedDomain(match[0], rule.allowed_domains));
			case 'external_links':
				return links.some((link) => {
					try {
						new URL(/^https?:\/\//i.test(link) ? link : `https://${link}`);
						return !allowedDomain(link, rule.allowed_domains);
					} catch {
						return false;
					}
				});
			case 'excessive_caps':
				return letters.length >= rule.minimum_length && (caps * 100) / letters.length > rule.threshold;
			case 'excessive_emojis':
				return emoji > rule.threshold;
			case 'excessive_spoilers':
				return (input.content.match(/\|\|[\s\S]*?\|\|/gu) ?? []).length > rule.threshold;
			case 'excessive_mentions':
				return mentions > rule.threshold;
			case 'zalgo':
				return [...input.content.matchAll(/\p{M}+/gu)].some((match) => [...match[0]].length > rule.threshold);
			case 'anti_spam':
				return (
					!input.edited && input.occurred_at > windowEnd - rule.window_seconds * 1000 && window.length >= rule.threshold
				);
			case 'character_limit':
				return [...input.content].length > rule.threshold;
			case 'media_spam':
				return (
					!input.edited &&
					input.occurred_at > windowEnd - rule.window_seconds * 1000 &&
					input.media > 0 &&
					window.reduce((total, sample) => total + sample.media, 0) >= rule.threshold
				);
			default:
				return false;
		}
	});
}
