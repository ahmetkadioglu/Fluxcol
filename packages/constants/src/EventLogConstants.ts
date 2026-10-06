// SPDX-License-Identifier: AGPL-3.0-or-later

import {AuditLogActionType as Audit} from '@fluxer/constants/src/AuditLogActionType';

export const EVENT_LOG_CATEGORIES = ['members', 'moderation', 'messages', 'reactions', 'channels', 'permissions', 'roles', 'invites', 'integrations', 'guild', 'voice'] as const;
export type EventLogCategory = (typeof EVENT_LOG_CATEGORIES)[number];

export const EVENT_LOG_CATALOG = [
	{id: 'member_join', category: 'members', title: 'Member joined'},
	{id: 'member_leave', category: 'members', title: 'Member left'},
	{id: 'bot_add', category: 'members', title: 'Bot added', audit: Audit.BOT_ADD},
	{id: 'member_update', category: 'members', title: 'Community profile changed', audit: Audit.MEMBER_UPDATE},
	{id: 'user_profile_update', category: 'members', title: 'Public user profile changed'},
	{id: 'member_kick', category: 'moderation', title: 'Member kicked', audit: Audit.MEMBER_KICK},
	{id: 'member_prune', category: 'moderation', title: 'Members pruned', audit: Audit.MEMBER_PRUNE, unavailable: true},
	{id: 'member_ban_add', category: 'moderation', title: 'Member banned', audit: Audit.MEMBER_BAN_ADD},
	{id: 'member_ban_remove', category: 'moderation', title: 'Member unbanned', audit: Audit.MEMBER_BAN_REMOVE},
	{id: 'member_timeout', category: 'moderation', title: 'Member timeout changed'},
	{id: 'member_server_mute', category: 'moderation', title: 'Server mute changed'},
	{id: 'member_server_deaf', category: 'moderation', title: 'Server deafen changed'},
	{id: 'member_move', category: 'moderation', title: 'Member moved by a moderator', audit: Audit.MEMBER_MOVE},
	{id: 'member_disconnect', category: 'moderation', title: 'Member disconnected by a moderator', audit: Audit.MEMBER_DISCONNECT},
	{id: 'message_create', category: 'messages', title: 'Message created', highVolume: true},
	{id: 'message_update', category: 'messages', title: 'Message edited'},
	{id: 'message_delete', category: 'messages', title: 'Message deleted', audit: Audit.MESSAGE_DELETE},
	{id: 'message_bulk_delete', category: 'messages', title: 'Messages bulk deleted', audit: Audit.MESSAGE_BULK_DELETE},
	{id: 'message_pin', category: 'messages', title: 'Message pinned', audit: Audit.MESSAGE_PIN},
	{id: 'message_unpin', category: 'messages', title: 'Message unpinned', audit: Audit.MESSAGE_UNPIN},
	{id: 'message_publish', category: 'messages', title: 'Announcement published'},
	{id: 'reaction_add', category: 'reactions', title: 'Reaction added', highVolume: true},
	{id: 'reaction_remove', category: 'reactions', title: 'Reaction removed', highVolume: true},
	{id: 'reaction_clear', category: 'reactions', title: 'All reactions removed', highVolume: true},
	{id: 'reaction_clear_emoji', category: 'reactions', title: 'Emoji reactions removed', highVolume: true},
	{id: 'channel_create', category: 'channels', title: 'Channel created', audit: Audit.CHANNEL_CREATE},
	{id: 'channel_update', category: 'channels', title: 'Channel changed', audit: Audit.CHANNEL_UPDATE},
	{id: 'channel_delete', category: 'channels', title: 'Channel deleted', audit: Audit.CHANNEL_DELETE},
	{id: 'channel_overwrite_create', category: 'permissions', title: 'Channel permission override added', audit: Audit.CHANNEL_OVERWRITE_CREATE},
	{id: 'channel_overwrite_update', category: 'permissions', title: 'Channel permission override changed', audit: Audit.CHANNEL_OVERWRITE_UPDATE},
	{id: 'channel_overwrite_delete', category: 'permissions', title: 'Channel permission override removed', audit: Audit.CHANNEL_OVERWRITE_DELETE},
	{id: 'role_create', category: 'roles', title: 'Role created', audit: Audit.ROLE_CREATE},
	{id: 'role_update', category: 'roles', title: 'Role changed', audit: Audit.ROLE_UPDATE},
	{id: 'role_delete', category: 'roles', title: 'Role deleted', audit: Audit.ROLE_DELETE},
	{id: 'member_role_update', category: 'roles', title: 'Member roles changed', audit: Audit.MEMBER_ROLE_UPDATE},
	{id: 'invite_create', category: 'invites', title: 'Invite created', audit: Audit.INVITE_CREATE},
	{id: 'invite_update', category: 'invites', title: 'Invite changed', audit: Audit.INVITE_UPDATE, unavailable: true},
	{id: 'invite_delete', category: 'invites', title: 'Invite deleted', audit: Audit.INVITE_DELETE},
	{id: 'invite_use', category: 'invites', title: 'Invite used'},
	{id: 'webhook_create', category: 'integrations', title: 'Webhook created', audit: Audit.WEBHOOK_CREATE},
	{id: 'webhook_update', category: 'integrations', title: 'Webhook changed', audit: Audit.WEBHOOK_UPDATE},
	{id: 'webhook_delete', category: 'integrations', title: 'Webhook deleted', audit: Audit.WEBHOOK_DELETE},
	{id: 'emoji_create', category: 'integrations', title: 'Emoji created', audit: Audit.EMOJI_CREATE},
	{id: 'emoji_update', category: 'integrations', title: 'Emoji changed', audit: Audit.EMOJI_UPDATE},
	{id: 'emoji_delete', category: 'integrations', title: 'Emoji deleted', audit: Audit.EMOJI_DELETE},
	{id: 'sticker_create', category: 'integrations', title: 'Sticker created', audit: Audit.STICKER_CREATE},
	{id: 'sticker_update', category: 'integrations', title: 'Sticker changed', audit: Audit.STICKER_UPDATE},
	{id: 'sticker_delete', category: 'integrations', title: 'Sticker deleted', audit: Audit.STICKER_DELETE},
	{id: 'guild_update', category: 'guild', title: 'Community settings changed', audit: Audit.GUILD_UPDATE},
	{id: 'voice_join', category: 'voice', title: 'Voice channel joined'},
	{id: 'voice_leave', category: 'voice', title: 'Voice channel left'},
	{id: 'voice_move', category: 'voice', title: 'Voice channel changed'},
	{id: 'voice_self_mute', category: 'voice', title: 'Self mute changed', highVolume: true},
	{id: 'voice_self_deaf', category: 'voice', title: 'Self deafen changed', highVolume: true},
	{id: 'voice_video', category: 'voice', title: 'Camera state changed', highVolume: true},
	{id: 'voice_stream', category: 'voice', title: 'Screen sharing changed', highVolume: true},
	{id: 'voice_suppress', category: 'voice', title: 'Voice suppression changed', highVolume: true},
	{id: 'entrance_sound_play', category: 'voice', title: 'Entrance sound played', highVolume: true},
	{id: 'presence_status', category: 'voice', title: 'Visible presence changed', highVolume: true},
	{id: 'presence_custom_status', category: 'voice', title: 'Custom status changed', highVolume: true},
] as const;
export type EventLogKind = (typeof EVENT_LOG_CATALOG)[number]['id'];
// Canonical producers: a management audit never duplicates a message mutation.
export type EventLogProducer = 'audit' | 'membership' | 'message' | 'reaction' | 'invite_use' | 'public_profile' | 'gateway_voice' | 'gateway_presence' | 'entrance_sound' | 'unsupported';
export const eventLogProducer = (id: EventLogKind): EventLogProducer => {
	if (id === 'member_prune' || id === 'invite_update') return 'unsupported';
	if (id === 'member_join' || id === 'member_leave') return 'membership';
	if (id === 'user_profile_update') return 'public_profile';
	if (id === 'invite_use') return 'invite_use';
	if (id === 'entrance_sound_play') return 'entrance_sound';
	if (id.startsWith('presence_')) return 'gateway_presence';
	if (id.startsWith('voice_')) return 'gateway_voice';
	if (id.startsWith('reaction_')) return 'reaction';
	if (['message_create', 'message_update', 'message_delete', 'message_bulk_delete', 'message_publish'].includes(id)) return 'message';
	return 'audit';
};
export const EVENT_LOG_IDS = EVENT_LOG_CATALOG.map((entry) => entry.id) as [EventLogKind, ...Array<EventLogKind>];
export const eventLogDefinition = (id: EventLogKind) => EVENT_LOG_CATALOG.find((entry) => entry.id === id)!;
export const eventLogAvailable = (id: EventLogKind) => !('unavailable' in eventLogDefinition(id));
export const eventLogChannel = (settings: {channel_id: string | null; category_channels?: Record<string, string | null>; event_channels?: Record<string, string | null>}, id: EventLogKind) => settings.event_channels?.[id] ?? settings.category_channels?.[eventLogDefinition(id).category] ?? settings.channel_id;
