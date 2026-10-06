// SPDX-License-Identifier: AGPL-3.0-or-later

import type {GuildID, UserID} from '@app/api/BrandedTypes';
import type {GuildAuditLogRow} from '@app/api/database/types/GuildTypes';
import type {MessageRow} from '@app/api/database/types/MessageTypes';
import {getChannelRepository, getGuildRepository, getUserRepository} from '@app/api/middleware/ServiceSingletons';
import {AutoModRepository, autoModKey} from '@app/api/netrcol/AutoModRepository';
import {eventLogContext} from '@app/api/netrcol/EventLogContext';
import {eventLogStopped, eventLogSupported} from '@app/api/netrcol/EventLogRepository';
import {AuditLogActionType} from '@fluxer/constants/src/AuditLogActionType';
import {MessageTypes} from '@fluxer/constants/src/ChannelConstants';
import {MissingPermissionsError} from '@fluxer/errors/src/domains/core/MissingPermissionsError';

export async function checkAutoModHold(guildId: GuildID, userId: UserID, join = false) {
	if (!eventLogSupported() || eventLogStopped() || eventLogContext.getStore()?.suppress || userId === 0n) return;
	const repository = new AutoModRepository();
	const [config, guild] = await Promise.all([repository.config(guildId), getGuildRepository().findUnique(guildId)]);
	if (!guild || !config.settings.enabled || guild.ownerId.toString() !== config.approved_by || guild.ownerId === userId)
		return;
	const until = await repository.holdUntil(guildId, join ? 'raid_hold' : `nuke_hold:${userId}`, config);
	if (until > Date.now()) {
		if (config.settings.ignore_bots && (await getUserRepository().findUnique(userId))?.isBot) return;
		throw new MissingPermissionsError();
	}
}
export async function checkAutoModMessageHold(guildId: GuildID, userId: UserID) {
	await checkAutoModHold(guildId, userId);
	await checkAutoModHold(guildId, userId, true);
}
export async function prepareAutoModMessage(row: MessageRow, previous: MessageRow | null) {
	const type = row.type ?? MessageTypes.DEFAULT;
	if (
		!eventLogSupported() ||
		eventLogStopped() ||
		eventLogContext.getStore()?.suppress ||
		!row.author_id ||
		row.author_id === 0n ||
		row.webhook_id ||
		(type !== MessageTypes.DEFAULT && type !== MessageTypes.REPLY)
	)
		return [];
	// Native join/pin notifications carry a member author, but are not user messages.
	// In particular, a raid hold may start after membership commits and before its join notification.
	// Embed unfurling and metadata-only writes are not new messages or edits.
	if (
		previous &&
		previous.content === row.content &&
		JSON.stringify(previous.attachments, (_k, v) => (typeof v === 'bigint' ? String(v) : v)) ===
			JSON.stringify(row.attachments, (_k, v) => (typeof v === 'bigint' ? String(v) : v)) &&
		JSON.stringify(previous.sticker_items) === JSON.stringify(row.sticker_items)
	)
		return [];
	const channel = await getChannelRepository().findUnique(row.channel_id);
	if (!channel?.guildId) return [];
	await checkAutoModMessageHold(channel.guildId, row.author_id);
	const now = row.edited_timestamp?.getTime() ?? Date.now();
	return new AutoModRepository().prepare(channel.guildId, {
		id: autoModKey(`message:${row.message_id}:${previous?.version ?? 0}`),
		guild_id: String(channel.guildId),
		user_id: String(row.author_id),
		channel_id: String(channel.id),
		message_id: String(row.message_id),
		kind: 'message',
		occurred_at: now,
		content: row.content ?? '',
		media: (row.attachments?.length ?? 0) + (row.sticker_items?.length ?? 0),
		edited: !!previous,
	});
}
export async function prepareAutoModJoin(guildId: GuildID, userId: UserID) {
	if (!eventLogSupported() || eventLogStopped() || eventLogContext.getStore()?.suppress) return [];
	await checkAutoModHold(guildId, userId, true);
	return new AutoModRepository().prepare(guildId, {
		id: autoModKey(`join:${guildId}:${userId}:${eventLogContext.getStore()?.request_id ?? Date.now()}`),
		guild_id: String(guildId),
		user_id: String(userId),
		channel_id: null,
		message_id: null,
		kind: 'join',
		occurred_at: Date.now(),
		content: '',
		media: 0,
		edited: false,
	});
}
// Only potentially destructive administrative operations count. Message/emoji housekeeping does not.
export const AUTO_MOD_NUKE_ACTIONS = new Set<number>([
	AuditLogActionType.GUILD_UPDATE,
	AuditLogActionType.CHANNEL_CREATE,
	AuditLogActionType.CHANNEL_UPDATE,
	AuditLogActionType.CHANNEL_DELETE,
	AuditLogActionType.CHANNEL_OVERWRITE_CREATE,
	AuditLogActionType.CHANNEL_OVERWRITE_UPDATE,
	AuditLogActionType.CHANNEL_OVERWRITE_DELETE,
	AuditLogActionType.ROLE_CREATE,
	AuditLogActionType.ROLE_UPDATE,
	AuditLogActionType.ROLE_DELETE,
	AuditLogActionType.MEMBER_KICK,
	AuditLogActionType.MEMBER_BAN_ADD,
	AuditLogActionType.MEMBER_ROLE_UPDATE,
	AuditLogActionType.BOT_ADD,
	AuditLogActionType.WEBHOOK_CREATE,
	AuditLogActionType.WEBHOOK_UPDATE,
	AuditLogActionType.WEBHOOK_DELETE,
]);
export async function prepareAutoModAudit(row: GuildAuditLogRow) {
	if (
		!eventLogSupported() ||
		eventLogStopped() ||
		eventLogContext.getStore()?.suppress ||
		row.user_id === 0n ||
		!AUTO_MOD_NUKE_ACTIONS.has(row.action_type)
	)
		return [];
	return new AutoModRepository().prepare(row.guild_id, {
		id: autoModKey(`audit:${row.log_id}`),
		guild_id: String(row.guild_id),
		user_id: String(row.user_id),
		channel_id: null,
		message_id: null,
		kind: 'audit',
		occurred_at: Date.now(),
		content: '',
		media: 0,
		edited: false,
	});
}
