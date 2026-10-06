// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	AUTO_MOD_ACTIONS,
	AUTO_MOD_DEFAULT_THRESHOLDS,
	AUTO_MOD_MAX_WINDOW_SECONDS,
	AUTO_MOD_RULE_IDS,
	autoModActions,
} from '@fluxer/constants/src/AutoModConstants';
import {z} from 'zod';

const Id = z.string().regex(/^[1-9][0-9]{0,19}$/);
const Scope = z.object({mode: z.enum(['exclude', 'include']), ids: z.array(Id).max(100)}).strict();
export const AutoModLinkPrefix = z
	.string()
	.trim()
	.min(1)
	.max(2048)
	.refine((value) => {
		if (/\s/u.test(value) || !/^https?:\/\//iu.test(value)) return false;
		try {
			const url = new URL(value);
			return !!url.hostname && !url.username && !url.password;
		} catch {
			return false;
		}
	}, 'Enter an HTTP or HTTPS URL prefix without spaces or credentials');
export const AutoModLinkWhitelist = z.array(AutoModLinkPrefix).max(100);
export const AutoModPermissions = z.object({users: Scope, roles: Scope, channels: Scope, categories: Scope}).strict();
export type AutoModPermissions = z.infer<typeof AutoModPermissions>;
export function defaultAutoModPermissions(): AutoModPermissions {
	return {
		users: {mode: 'exclude', ids: []},
		roles: {mode: 'exclude', ids: []},
		channels: {mode: 'exclude', ids: []},
		categories: {mode: 'exclude', ids: []},
	};
}
export const AutoModRule = z
	.object({
		action: z.enum(AUTO_MOD_ACTIONS),
		threshold: z.number().int().min(1).max(10000),
		window_seconds: z.number().int().min(1).max(AUTO_MOD_MAX_WINDOW_SECONDS),
		minimum_length: z.number().int().min(1).max(10000),
		// Absent in old records: preserve all-account join counting and selected actions.
		new_account_days: z.number().int().min(0).max(365).default(0),
		log_only: z.boolean().default(false),
		words: z.array(z.string().trim().min(1).max(100)).max(200),
		partial_words: z.array(z.string().trim().min(1).max(100)).max(200).default([]),
		permissions: AutoModPermissions.nullable().default(null),
		allowed_domains: z
			.array(
				z
					.string()
					.trim()
					.min(1)
					.max(253)
					.regex(/^(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,63}$/),
			)
			.max(100),
	})
	.strict();
export type AutoModRule = z.infer<typeof AutoModRule>;
export const AutoModSettings = z
	.object({
		schema_version: z.literal(1),
		enabled: z.boolean(),
		ignore_bots: z.boolean(),
		// Shared by invite and external-link filters; absent in existing records.
		link_whitelist: AutoModLinkWhitelist.default([]),
		channel_id: Id.nullable(),
		exempt_channel_ids: z.array(Id).max(100),
		exempt_role_ids: z.array(Id).max(100),
		// Absent in existing records: their channel/role exemptions remain authoritative.
		permissions: AutoModPermissions.optional(),
		duration_seconds: z.number().int().min(10).max(86400),
		rules: z.record(z.enum(AUTO_MOD_RULE_IDS), AutoModRule),
	})
	.strict()
	.superRefine((settings, ctx) => {
		for (const id of AUTO_MOD_RULE_IDS) {
			const rule = settings.rules[id];
			if (id !== 'anti_spam' && id !== 'media_spam' && rule.window_seconds > 300)
				ctx.addIssue({code: 'custom', path: ['rules', id, 'window_seconds'], message: 'Maximum is 300 seconds'});
			if (!autoModActions(id).includes(rule.action))
				ctx.addIssue({code: 'custom', path: ['rules', id, 'action'], message: 'Invalid action for this rule'});
			if (id === 'excessive_caps' && rule.threshold > 100)
				ctx.addIssue({code: 'custom', path: ['rules', id, 'threshold'], message: 'Maximum is 100%'});
			if (['repeated_text', 'anti_spam', 'anti_raid', 'anti_nuke'].includes(id) && rule.threshold > 1000)
				ctx.addIssue({code: 'custom', path: ['rules', id, 'threshold'], message: 'Maximum is 1000 events'});
			if (id === 'bad_words' && rule.action !== 'disabled' && !rule.words.length && !rule.partial_words.length)
				ctx.addIssue({code: 'custom', path: ['rules', id, 'words'], message: 'Add blocked words first'});
		}
	});
export type AutoModSettings = z.infer<typeof AutoModSettings>;
export function sharedAutoModPermissions(settings: AutoModSettings): AutoModPermissions {
	return (
		settings.permissions ?? {
			...defaultAutoModPermissions(),
			channels: {mode: 'exclude', ids: settings.exempt_channel_ids},
			roles: {mode: 'exclude', ids: settings.exempt_role_ids},
		}
	);
}
export function defaultAutoModSettings(): AutoModSettings {
	return AutoModSettings.parse({
		schema_version: 1,
		enabled: false,
		ignore_bots: true,
		channel_id: null,
		exempt_channel_ids: [],
		exempt_role_ids: [],
		duration_seconds: 600,
		rules: Object.fromEntries(
			AUTO_MOD_RULE_IDS.map((id) => [
				id,
				{
					action: 'disabled',
					threshold: AUTO_MOD_DEFAULT_THRESHOLDS[id],
					window_seconds: id === 'anti_raid' || id === 'anti_nuke' ? 60 : 10,
					minimum_length: 10,
					new_account_days: id === 'anti_raid' ? 7 : 0,
					log_only: id === 'anti_nuke',
					words: [],
					allowed_domains: [],
				},
			]),
		),
	});
}
export const AutoModUpdateRequest = AutoModSettings.safeExtend({revision: z.number().int().min(0)});
export type AutoModUpdateRequest = z.infer<typeof AutoModUpdateRequest>;
export const AutoModSettingsResponse = z.object({
	settings: AutoModSettings,
	revision: z.number().int(),
	status: z.enum(['enabled', 'disabled', 'owner_changed', 'stopped']),
	channels: z.array(z.object({id: Id, name: z.string()})),
	scope_channels: z.array(z.object({id: Id, name: z.string()})).default([]),
	roles: z.array(z.object({id: Id, name: z.string()})),
	categories: z.array(z.object({id: Id, name: z.string()})).default([]),
	lockdown_until: z.number(),
});
export type AutoModSettingsResponse = z.infer<typeof AutoModSettingsResponse>;
export const AutoModSimulationRequest = z.object({content: z.string().max(10000)}).strict();
export const AutoModSimulationResponse = z.object({rules: z.array(z.enum(AUTO_MOD_RULE_IDS))});
export const AutoModHistoryEntry = z.object({
	id: z.string(),
	rules: z.array(z.enum(AUTO_MOD_RULE_IDS)).optional(),
	actions: z.array(z.enum(AUTO_MOD_ACTIONS)).optional(),
	actor_id: Id,
	channel_id: Id.nullable().optional(),
	status: z.enum(['saved', 'observed', 'applied', 'failed', 'skipped', 'passed']),
	at: z.number(),
});
export type AutoModHistoryEntry = z.infer<typeof AutoModHistoryEntry>;
export const AutoModHistoryResponse = z.object({entries: z.array(AutoModHistoryEntry)});
