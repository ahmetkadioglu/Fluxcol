// SPDX-License-Identifier: AGPL-3.0-or-later
import {z} from 'zod';

const roleIds = z
	.array(z.string().regex(/^[1-9][0-9]{0,19}$/))
	.max(20)
	.refine((ids) => new Set(ids).size === ids.length);
export const AutomaticRoleSettings = z
	.object({
		enabled: z.boolean(),
		member_role_ids: roleIds,
		bot_role_ids: roleIds,
		delay_seconds: z.number().int().min(0).max(3600),
	})
	.strict();
export type AutomaticRoleSettings = z.infer<typeof AutomaticRoleSettings>;
export const defaultAutomaticRoleSettings = (): AutomaticRoleSettings => ({
	enabled: false,
	member_role_ids: [],
	bot_role_ids: [],
	delay_seconds: 0,
});
export const AutomaticRoleUpdateRequest = AutomaticRoleSettings.extend({revision: z.number().int().min(0)});
export type AutomaticRoleUpdateRequest = z.infer<typeof AutomaticRoleUpdateRequest>;
export const AutomaticRoleSettingsResponse = z.object({
	settings: AutomaticRoleSettings,
	revision: z.number().int().min(0),
	status: z.enum(['enabled', 'disabled', 'owner_changed', 'stopped']),
	roles: z.array(z.object({id: z.string(), name: z.string(), eligible: z.boolean()})),
});
export type AutomaticRoleSettingsResponse = z.infer<typeof AutomaticRoleSettingsResponse>;
export const AutomaticRoleHistoryEntry = z.object({
	id: z.string(),
	at: z.number(),
	actor_id: z.string(),
	user_id: z.string().nullable(),
	status: z.enum(['saved', 'assigned', 'skipped', 'failed']),
	reason: z.enum([
		'none',
		'policy_changed',
		'member_left',
		'role_unavailable',
		'no_roles',
		'stopped',
		'delivery_failed',
	]),
	role_ids: z.array(z.string()),
});
export type AutomaticRoleHistoryEntry = z.infer<typeof AutomaticRoleHistoryEntry>;
export const AutomaticRoleHistoryResponse = z.object({entries: z.array(AutomaticRoleHistoryEntry)});
