// SPDX-License-Identifier: AGPL-3.0-or-later

import {randomUUID} from 'node:crypto';
import type {GuildID} from '@app/api/BrandedTypes';
import {createMessageID} from '@app/api/BrandedTypes';
import {fetchOne} from '@app/api/database/CassandraQueryExecution';
import type {PreparedQuery} from '@app/api/database/CassandraTypes';
import type {GuildAuditLogRow} from '@app/api/database/types/GuildTypes';
import type {MessageRow} from '@app/api/database/types/MessageTypes';
import {getChannelRepository, getUserRepository} from '@app/api/middleware/ServiceSingletons';
import {eventLogContext} from '@app/api/netrcol/EventLogContext';
import {
	EventLogRecords,
	EventLogRepository,
	enqueueEventLog,
	eventLogStopped,
	eventLogSupported,
	prepareEventLog,
} from '@app/api/netrcol/EventLogRepository';
import {AuditLogActionType} from '@fluxer/constants/src/AuditLogActionType';
import {MessageFlags, MessageTypes} from '@fluxer/constants/src/ChannelConstants';
import {EVENT_LOG_CATALOG} from '@fluxer/constants/src/EventLogConstants';
import type {EventLogEvent, EventLogPayload} from '@fluxer/schema/src/domains/guild/GuildEventLogSchemas';

export {eventLogContext} from '@app/api/netrcol/EventLogContext';

const value = (item: unknown): string | null =>
	item == null
		? null
		: typeof item === 'string'
			? item
			: JSON.stringify(item, (_key, v) => (typeof v === 'bigint' ? v.toString() : v));
// Only public/community mutation fields. Never forward raw private user or webhook payloads.
export const EVENT_LOG_CHANGE_FIELDS = new Set([
	'name',
	'nick',
	'username',
	'discriminator',
	'global_name',
	'avatar_hash',
	'banner_hash',
	'bio',
	'pronouns',
	'accent_color',
	'roles',
	'$add',
	'$remove',
	'permissions',
	'color',
	'hoist',
	'mentionable',
	'position',
	'hoist_position',
	'icon',
	'icon_hash',
	'unicode_emoji',
	'topic',
	'type',
	'parent_id',
	'nsfw',
	'rate_limit_per_user',
	'bitrate',
	'user_limit',
	'voice_connection_limit',
	'rtc_region',
	'permission_overwrites',
	'allow',
	'deny',
	'id',
	'owner_id',
	'verification_level',
	'default_message_notifications',
	'explicit_content_filter',
	'afk_channel_id',
	'afk_timeout',
	'system_channel_id',
	'system_channel_flags',
	'splash_hash',
	'embed_splash_hash',
	'description',
	'features',
	'vanity_url_code',
	'disabled_operations',
	'max_age',
	'max_uses',
	'uses',
	'temporary',
	'channel_id',
	'inviter_id',
	'creator_id',
	'guild_id',
	'available',
	'mute',
	'deaf',
	'communication_disabled_until',
	'url',
	'format_type',
	'tags',
	'flags',
	'animated',
]);
for (const field of [
	'banner_width',
	'banner_height',
	'splash_width',
	'splash_height',
	'splash_card_alignment',
	'embed_splash_width',
	'embed_splash_height',
	'mfa_level',
	'nsfw_level',
	'content_warning_level',
	'content_warning_text',
	'rules_channel_id',
	'member_count',
	'message_history_cutoff',
	'emoji_id',
	'sticker_id',
])
	EVENT_LOG_CHANGE_FIELDS.add(field);
export function auditLogEvents(row: GuildAuditLogRow): Array<{kind: EventLogEvent; payload: EventLogPayload}> {
	if (
		row.action_type === AuditLogActionType.MESSAGE_DELETE ||
		row.action_type === AuditLogActionType.MESSAGE_BULK_DELETE
	)
		return [];
	const entry = EVENT_LOG_CATALOG.find((item) => 'audit' in item && item.audit === row.action_type);
	if (!entry || 'unavailable' in entry) return [];
	const changes = (row.changes ? JSON.parse(row.changes) : []) as Array<{
		key: string;
		old_value?: unknown;
		new_value?: unknown;
	}>;
	const safeChanges = changes
		.filter((item) => EVENT_LOG_CHANGE_FIELDS.has(item.key))
		.map((item) => ({key: item.key, before: value(item.old_value), after: value(item.new_value)}));
	const details = Object.fromEntries(
		[...(row.options ?? new Map())].filter(([key]) =>
			['count', 'channel_id', 'role_name', 'members_removed', 'type', 'max_age', 'max_uses', 'uses', 'id'].includes(
				key,
			),
		),
	);
	const payload: EventLogPayload = {
		actor_id: row.user_id.toString(),
		subject_id: row.target_id,
		subject_type:
			entry.category === 'members' || entry.category === 'moderation' || entry.id === 'member_role_update'
				? 'user'
				: entry.category === 'messages'
					? 'message'
					: entry.category,
		source_channel_id: details.channel_id ?? (entry.category === 'channels' ? row.target_id : null),
		reason: row.reason,
		changes: safeChanges,
		details,
	};
	if (row.action_type !== AuditLogActionType.MEMBER_UPDATE) return [{kind: entry.id, payload}];
	const result: Array<{kind: EventLogEvent; payload: EventLogPayload}> = [];
	for (const [field, kind] of [
		['communication_disabled_until', 'member_timeout'],
		['mute', 'member_server_mute'],
		['deaf', 'member_server_deaf'],
	] as const) {
		const selected = safeChanges.filter((change) => change.key === field);
		if (selected.length) result.push({kind, payload: {...payload, changes: selected}});
	}
	const profile = safeChanges.filter(
		(change) => !['communication_disabled_until', 'mute', 'deaf', 'roles', 'user_id'].includes(change.key),
	);
	if (profile.length) result.push({kind: 'member_update', payload: {...payload, changes: profile}});
	return result;
}
export async function prepareAuditLogs(row: GuildAuditLogRow): Promise<Array<PreparedQuery>> {
	if (!eventLogSupported() || eventLogStopped()) return [];
	return (
		await Promise.all(
			auditLogEvents(row).map(({kind, payload}) => prepareEventLog(row.guild_id, kind, `audit:${row.log_id}`, payload)),
		)
	).flat();
}
export async function isEventLogMessage(guildId: GuildID, messageId: bigint): Promise<boolean> {
	return !!(await fetchOne(
		EventLogRecords.select({where: [EventLogRecords.where.eq('guild_id'), EventLogRecords.where.eq('key')]}).bind({
			guild_id: guildId,
			key: `run:${messageId.toString().padStart(20, '0')}`,
		}),
	));
}
export async function prepareMessageLogs(
	rows: ReadonlyArray<MessageRow>,
	kind: EventLogEvent,
	previous?: MessageRow | null,
): Promise<Array<PreparedQuery>> {
	if (!eventLogSupported() || eventLogStopped() || eventLogContext.getStore()?.suppress || !rows.length) return [];
	const channel = await getChannelRepository().findUnique(rows[0]!.channel_id);
	if (!channel?.guildId) return [];
	const config = await new EventLogRepository().getConfig(channel.guildId);
	if (!config.settings.enabled || !config.settings.events.includes(kind)) return [];
	const originals: Array<MessageRow> = [];
	// ID 0 with DEFAULT type is the reserved automation writer. This also protects
	// old log messages after their delivery-history retention has expired.
	for (const row of rows)
		if (
			!(row.author_id === 0n && row.type === MessageTypes.DEFAULT) &&
			!(await isEventLogMessage(channel.guildId, row.message_id))
		)
			originals.push(row);
	if (!originals.length) return [];
	const first = originals[0]!;
	const context = eventLogContext.getStore();
	const payload: EventLogPayload = {
		actor_id: context?.actor_id ?? null,
		subject_id: first.message_id.toString(),
		subject_type: 'message',
		source_channel_id: channel.id.toString(),
		reason: context?.reason ?? null,
		details: {
			count: originals.length.toString(),
			channel: channel.name ?? channel.id.toString(),
			author_id: first.author_id?.toString() ?? '0',
		},
	};
	const attachments = originals
		.flatMap((row) => row.attachments ?? [])
		.map((file) => `${file.filename} (${file.content_type}, ${file.size})`);
	if (attachments.length) payload.details!.attachments = attachments.join('\n');
	if (previous?.attachments?.length)
		payload.details!.previous_attachments = previous.attachments
			.map((file) => `${file.filename} (${file.content_type}, ${file.size})`)
			.join('\n');
	const transcript = (includeText: boolean) =>
		originals
			.map(
				(row) =>
					`${row.message_id} | ${row.author_id ?? '0'}${includeText ? `\n${row.content ?? ''}` : ''}${row.attachments?.length ? '\n' + row.attachments.map((file) => `${file.filename} (${file.content_type}, ${file.size})`).join('\n') : ''}`,
			)
			.join('\n\n');
	if (config.settings.capture_message_content) {
		payload.message_text = first.content;
		if (previous) payload.previous_text = previous.content;
		if (kind === 'message_bulk_delete') payload.transcript = transcript(true);
	} else if (kind === 'message_bulk_delete') payload.metadata_transcript = transcript(false);
	if (previous)
		payload.changes = ['content', 'attachments', 'embeds', 'flags', 'sticker_items']
			.filter((key) => value(previous[key as keyof MessageRow]) !== value(first[key as keyof MessageRow]))
			.map((key) => ({
				key,
				before:
					key === 'content'
						? null
						: key === 'flags'
							? value(previous.flags)
							: String((previous[key as keyof MessageRow] as Array<unknown> | null)?.length ?? 0),
				after:
					key === 'content'
						? null
						: key === 'flags'
							? value(first.flags)
							: String((first[key as keyof MessageRow] as Array<unknown> | null)?.length ?? 0),
			}));
	const sourceId = `${kind}:${first.message_id}:${previous?.version ?? 0}:${context?.request_id ?? randomUUID()}`;
	return prepareEventLog(channel.guildId, kind, sourceId, payload);
}
export async function prepareMessageWrite(row: MessageRow, previous: MessageRow | null): Promise<Array<PreparedQuery>> {
	if (!previous) return prepareMessageLogs([row], 'message_create');
	if (!(previous.flags & MessageFlags.CROSSPOSTED) && row.flags & MessageFlags.CROSSPOSTED)
		return prepareMessageLogs([row], 'message_publish', previous);
	if (
		['content', 'attachments', 'embeds', 'sticker_items'].some(
			(field) => value(row[field as keyof MessageRow]) !== value(previous[field as keyof MessageRow]),
		) ||
		(row.edited_timestamp?.getTime() ?? null) !== (previous.edited_timestamp?.getTime() ?? null)
	)
		return prepareMessageLogs([row], 'message_update', previous);
	return [];
}

export async function preparePublicProfile(
	guildId: GuildID,
	userId: string,
	sourceId: string,
	before: Record<string, unknown>,
	after: Record<string, unknown>,
): Promise<Array<PreparedQuery>> {
	const fields = [
		'username',
		'discriminator',
		'global_name',
		'avatar_hash',
		'banner_hash',
		'bio',
		'pronouns',
		'accent_color',
	];
	const changes = fields
		.filter((key) => value(before[key]) !== value(after[key]))
		.map((key) => ({key, before: value(before[key]), after: value(after[key])}));
	if (!changes.length) return [];
	return prepareEventLog(guildId, 'user_profile_update', sourceId, {
		actor_id: eventLogContext.getStore()?.actor_id ?? null,
		subject_id: userId,
		subject_type: 'user',
		changes,
	});
}

export async function prepareUserProfileChange(
	before: import('@app/api/database/types/UserTypes').UserRow | null,
	after: import('@app/api/database/types/UserTypes').UserRow,
): Promise<Array<PreparedQuery>> {
	if (!before || !eventLogSupported() || eventLogStopped()) return [];
	const fields = [
		'username',
		'discriminator',
		'global_name',
		'avatar_hash',
		'banner_hash',
		'bio',
		'pronouns',
		'accent_color',
	] as const;
	if (!fields.some((key) => value(before[key]) !== value(after[key]))) return [];
	const guilds = await getUserRepository().getUserGuildIds(after.user_id);
	return (
		await Promise.all(
			guilds.map((guildId) =>
				preparePublicProfile(
					guildId,
					after.user_id.toString(),
					`profile:${after.user_id}:${(before.version ?? 0) + 1}`,
					{...before},
					{...after},
				),
			),
		)
	).flat();
}

export async function captureReactionEvent(
	channel: import('@app/api/models/Channel').Channel,
	event: string,
	data: unknown,
): Promise<void> {
	const kinds: Record<string, EventLogEvent> = {
		MESSAGE_REACTION_ADD: 'reaction_add',
		MESSAGE_REACTION_REMOVE: 'reaction_remove',
		MESSAGE_REACTION_REMOVE_ALL: 'reaction_clear',
		MESSAGE_REACTION_REMOVE_EMOJI: 'reaction_clear_emoji',
	};
	const kind = kinds[event];
	if (!kind || !channel.guildId || !eventLogSupported() || eventLogStopped() || eventLogContext.getStore()?.suppress)
		return;
	const config = await new EventLogRepository().getConfig(channel.guildId);
	if (!config.settings.enabled || !config.settings.events.includes(kind)) return;
	const body = data as {message_id: string; user_id?: string; emoji?: unknown};
	if (await isEventLogMessage(channel.guildId, BigInt(body.message_id))) return;
	const message = await getChannelRepository().messages.getMessage(
		channel.id,
		createMessageID(BigInt(body.message_id)),
	);
	if (message?.authorId === 0n && message.type === MessageTypes.DEFAULT) return;
	const context = eventLogContext.getStore();
	await enqueueEventLog(channel.guildId, kind, `reaction:${body.message_id}:${context?.request_id ?? randomUUID()}`, {
		actor_id: context?.actor_id ?? null,
		subject_id: body.message_id,
		subject_type: 'message',
		source_channel_id: channel.id.toString(),
		details: {user_id: body.user_id ?? '', emoji: value(body.emoji) ?? ''},
	});
}
