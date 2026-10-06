// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	createChannelID,
	createEmojiID,
	createRoleID,
	createStickerID,
	createUserID,
	createWebhookID,
} from '@app/api/BrandedTypes';
import {Config} from '@app/api/Config';
import {type EventLogPresentation, eventLogPayload} from '@app/api/netrcol/EventLogRender';
import type {EventLogDelivery} from '@app/api/netrcol/EventLogRepository';
import type {WorkerDependencies} from '@app/api/worker/WorkerDependencies';

type Dependencies = Pick<WorkerDependencies, 'guildRepository' | 'channelRepository' | 'userRepository'> &
	Partial<Pick<WorkerDependencies, 'webhookRepository'>>;
const validId = (id: string | null | undefined): id is string =>
	!!id && /^\d{1,19}$/.test(id) && BigInt(id) > 0n && BigInt(id) <= 0x7fffffffffffffffn;

// Public display names only. Deleted targets also have their audit snapshot available to the renderer.
export async function resolveEventLogPresentation(
	delivery: EventLogDelivery,
	deps: Dependencies,
	guildName: string,
): Promise<EventLogPresentation> {
	const payload = eventLogPayload(delivery);
	const users = new Set<string>();
	const channels = new Set<string>();
	const roles = new Set<string>();
	const add = (set: Set<string>, id: string | null | undefined) => {
		if (validId(id) && set.size < 32) set.add(id);
	};
	add(users, payload.actor_id);
	if (payload.subject_type === 'user') add(users, payload.subject_id);
	if (payload.subject_type === 'channels') add(channels, payload.subject_id);
	if (payload.subject_type === 'roles') add(roles, payload.subject_id);
	if (payload.subject_type === 'permissions') add(payload.details?.type === '1' ? users : roles, payload.subject_id);
	add(channels, payload.source_channel_id);
	for (const [key, value] of Object.entries(payload.details ?? {})) {
		if (['author_id', 'user_id', 'inviter_id', 'creator_id'].includes(key)) add(users, value);
		if (key === 'channel_id') add(channels, value);
	}
	for (const change of payload.changes ?? []) {
		for (const value of [change.before, change.after]) {
			if (['owner_id', 'inviter_id', 'creator_id'].includes(change.key)) add(users, value);
			if (['channel_id', 'parent_id', 'afk_channel_id', 'system_channel_id', 'rules_channel_id'].includes(change.key))
				add(channels, value);
			if (['roles', '$add', '$remove'].includes(change.key) && value) {
				try {
					const parsed: unknown = JSON.parse(value);
					if (Array.isArray(parsed)) for (const role of parsed) add(roles, typeof role === 'string' ? role : role?.id);
					else add(roles, value);
				} catch {
					add(roles, value);
				}
			}
			if (change.key === 'permission_overwrites' && value) {
				try {
					const parsed: unknown = JSON.parse(value);
					if (Array.isArray(parsed))
						for (const item of parsed) add(item.type === 1 || item.type === '1' ? users : roles, item.id);
				} catch {
					/* Old snapshots may already contain display values. */
				}
			}
		}
	}
	const result: EventLogPresentation = {users: {}, channels: {}, roles: {}, guildName, appUrl: Config.endpoints.webApp};
	// Bounded batches prevent large role changes from flooding the database. Failed lookups use explicit fallbacks.
	const lookups = [
		async () => {
			if (!validId(payload.subject_id) || payload.subject_type !== 'integrations') return;
			const id = BigInt(payload.subject_id);
			const kind = delivery.kind === 'test' ? payload.test_event : delivery.kind;
			const target = kind?.startsWith('emoji_')
				? await deps.guildRepository.getEmoji(createEmojiID(id), delivery.guild_id)
				: kind?.startsWith('sticker_')
					? await deps.guildRepository.getSticker(createStickerID(id), delivery.guild_id)
					: kind?.startsWith('webhook_')
						? await deps.webhookRepository?.findUnique(createWebhookID(id))
						: null;
			if (target?.guildId === delivery.guild_id && target.name) result.subjectName = target.name;
		},
		...[...users].map((id) => async () => {
			const [userResult, memberResult] = await Promise.allSettled([
				deps.userRepository.findUnique(createUserID(BigInt(id))),
				deps.guildRepository.getMember(delivery.guild_id, createUserID(BigInt(id))),
			]);
			const user = userResult.status === 'fulfilled' ? userResult.value : null;
			const member = memberResult.status === 'fulfilled' ? memberResult.value : null;
			const name = member?.nickname || user?.globalName || user?.username;
			if (name) result.users![id] = name;
		}),
		...[...channels].map((id) => async () => {
			const channel = await deps.channelRepository.findUnique(createChannelID(BigInt(id)));
			if (channel?.guildId === delivery.guild_id && channel.name && !channel.isSoftDeleted)
				result.channels![id] = {name: channel.name, type: channel.type};
		}),
		...(roles.size
			? [
					async () => {
						for (const role of await deps.guildRepository.listRolesByIds(
							[...roles].map((id) => createRoleID(BigInt(id))),
							delivery.guild_id,
						))
							result.roles![role.id.toString()] = role.name;
					},
				]
			: []),
	];
	for (let index = 0; index < lookups.length; index += 8)
		await Promise.allSettled(lookups.slice(index, index + 8).map((lookup) => lookup()));
	return result;
}
