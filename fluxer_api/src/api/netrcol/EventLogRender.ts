// SPDX-License-Identifier: AGPL-3.0-or-later
import type {MessageEmbed, MessageEmbedField} from '@app/api/database/types/MessageTypes';
import type {EventLogDelivery} from '@app/api/netrcol/EventLogRepository';
import {ChannelTypes, Permissions} from '@fluxer/constants/src/ChannelConstants';
import {EVENT_LOG_TRANSLATIONS} from '@fluxer/constants/src/EventLogTranslations';
import {EventLogPayload} from '@fluxer/schema/src/domains/guild/GuildEventLogSchemas';

export interface EventLogPresentation {
	users?: Record<string, string>;
	channels?: Record<string, {name: string; type: number}>;
	roles?: Record<string, string>;
	guildName?: string;
	subjectName?: string;
	appUrl?: string;
}
const plain = (text: string) => text.replace(/@/g, '@\u200b').replace(/([\\`*_~<>[\]()])/g, '\\$1');
const clip = (text: string, limit: number) =>
	text.length <= limit ? text : `${text.slice(0, limit - 1).replace(/[\uD800-\uDBFF]$/, '')}…`;

export function eventLogPayload(delivery: EventLogDelivery): EventLogPayload {
	return {
		subject_id: delivery.subject_id === 0n ? null : delivery.subject_id.toString(),
		subject_type: 'user',
		...(delivery.payload ? EventLogPayload.parse(JSON.parse(delivery.payload)) : {}),
	};
}

export function renderEventLog(
	delivery: EventLogDelivery,
	presentation: EventLogPresentation = {},
): {content: string; embeds: Array<MessageEmbed>; attachment: string | null} {
	const copy = EVENT_LOG_TRANSLATIONS[delivery.language] ?? EVENT_LOG_TRANSLATIONS['en-US']!;
	const t = (key: string) => copy[key] ?? copy.unknown!;
	const payload = eventLogPayload(delivery);
	const details = payload.details ?? {};
	const event = delivery.kind === 'test' ? (payload.test_event ?? 'member_join') : delivery.kind;
	const title = delivery.kind === 'test' ? `${t('testMark')} · ${t(event)}` : t(event);
	const unknown = (id?: string | null) => `${t('unknown')}${id ? ` · \`${plain(id)}\`` : ''}`;
	const user = (id?: string | null) =>
		id === '0' ? t('system') : id && presentation.users?.[id] ? plain(presentation.users[id]!) : unknown(id);
	const snapshotName = payload.changes?.find((change) => change.key === 'name');
	const targetName = snapshotName?.after ?? snapshotName?.before ?? details.role_name ?? presentation.subjectName;
	const channel = (id?: string | null) => {
		if (!id) return t('none');
		const resolved = presentation.channels?.[id];
		const name =
			resolved?.name ??
			(id === payload.source_channel_id ? details.channel : null) ??
			(id === payload.subject_id && payload.subject_type === 'channels' ? targetName : null);
		if (!name) return unknown(id);
		const type =
			resolved?.type ??
			(id === payload.subject_id
				? Number(details.type ?? payload.changes?.find((change) => change.key === 'type')?.before)
				: undefined);
		const prefix = type === ChannelTypes.GUILD_VOICE ? '🔊 ' : type === ChannelTypes.GUILD_CATEGORY ? '' : '#';
		const label = plain(`${prefix}${name}`);
		return presentation.appUrl && resolved && type !== ChannelTypes.GUILD_CATEGORY && type !== ChannelTypes.GUILD_LINK
			? `[${label}](${presentation.appUrl.replace(/\/$/, '')}/channels/${delivery.guild_id}/${id})`
			: label;
	};
	const role = (id: string) =>
		plain(presentation.roles?.[id] ?? (id === payload.subject_id ? targetName : null) ?? '') || unknown(id);
	const format = (key: string, value: string | null): string => {
		if (value === null || value === '') return t('none');
		if (value === 'true' || value === 'false') return t(value === 'true' ? 'enabled' : 'disabled');
		if (key === 'status') return t(`status_${value}`);
		if (['channel_id', 'parent_id', 'afk_channel_id', 'system_channel_id', 'rules_channel_id'].includes(key))
			return channel(value);
		if (['owner_id', 'inviter_id', 'creator_id', 'author_id', 'user_id'].includes(key)) return user(value);
		if (key === 'type' && ['channels', 'channel'].includes(payload.subject_type ?? '')) {
			const types: Record<string, string> = {
				'0': 'channel_text',
				'2': 'channel_voice',
				'4': 'channel_category',
				'5': 'channel_announcement',
				'998': 'channel_link',
			};
			return types[value] ? t(types[value]!) : plain(value);
		}
		if (['permissions', 'allow', 'deny'].includes(key) && /^\d+$/.test(value)) {
			const bits = BigInt(value);
			const names = Object.entries(Permissions)
				.filter(([, bit]) => (bits & bit) !== 0n)
				.map(([name]) =>
					plain(
						t(`permission_${name}`)
							.replace(/\{everyoneMention\}/g, '@everyone')
							.replace(/\{hereMention\}/g, '@here')
							.replace(/\{rolesMention\}/g, '@role'),
					),
				);
			return names.join(', ') || t('none');
		}
		if (['roles', '$add', '$remove'].includes(key)) {
			try {
				const parsed: unknown = JSON.parse(value);
				if (Array.isArray(parsed))
					return (
						parsed
							.map((item) =>
								typeof item === 'object' && item?.name
									? plain(item.name)
									: role(typeof item === 'string' ? item : String(item?.id)),
							)
							.join(', ') || t('none')
					);
			} catch {
				/* Old single-role records remain readable. */
			}
			if (/^\d+$/.test(value)) return role(value);
		}
		if (key === 'permission_overwrites') {
			try {
				const parsed: unknown = JSON.parse(value);
				if (Array.isArray(parsed))
					return (
						parsed
							.map((item) => {
								const name = item.type === 1 || item.type === '1' ? user(String(item.id)) : role(String(item.id));
								const permissions = [
									['allow', item.allow],
									['deny', item.deny],
								]
									.filter(([, bits]) => bits && String(bits) !== '0')
									.map(([key, bits]) => `${t(`field_${key}`)}: ${format(String(key), String(bits))}`);
								return `${name}: ${permissions.join('; ') || t('none')}`;
							})
							.join('\n') || t('none')
					);
			} catch {
				/* Legacy display values remain readable. */
			}
		}
		if (key === 'custom_status' || key === 'emoji') {
			try {
				const item = JSON.parse(value);
				return plain([item.emoji_name ?? item.name, item.text].filter(Boolean).join(' ')) || t('none');
			} catch {
				/* Unicode emoji and legacy text are already display values. */
			}
		}
		if (key === 'attachments')
			return plain(
				value.replace(/\(([^,\n]+), (\d+)\)/g, (_match, type: string, size: string) => {
					const bytes = Number(size),
						unit = bytes >= 1048576 ? 'MiB' : bytes >= 1024 ? 'KiB' : 'B';
					return `${type} · ${unit === 'B' ? bytes : (bytes / (unit === 'MiB' ? 1048576 : 1024)).toFixed(1)} ${unit}`;
				}),
			);
		if (key === 'communication_disabled_until' && Number.isFinite(Date.parse(value)))
			return `${new Intl.DateTimeFormat(delivery.language, {
				dateStyle: 'medium',
				timeStyle: 'short',
				timeZone: 'UTC',
			}).format(new Date(value))} UTC`;
		if (['avatar_hash', 'banner_hash', 'icon_hash', 'splash_hash', 'embed_splash_hash'].includes(key))
			return t('enabled');
		return plain(value);
	};
	const fields: Array<MessageEmbedField> = [];
	const add = (name: string, value: string, inline = false) => {
		fields.push({name, value, inline});
	};
	const subjectId = payload.subject_id;
	let primary = '';
	if (payload.subject_type === 'user') primary = `**${user(subjectId)}**`;
	else if (payload.subject_type === 'channels') primary = channel(subjectId);
	else if (payload.subject_type === 'roles' && subjectId) primary = `**${role(subjectId)}**`;
	else if (payload.subject_type === 'permissions' && subjectId)
		primary = `**${details.type === '1' ? user(subjectId) : role(subjectId)}**`;
	else if (payload.subject_type === 'guild') primary = plain(presentation.guildName ?? targetName ?? t('unknown'));
	else if (payload.subject_type === 'message' && event !== 'message_bulk_delete' && details.author_id)
		primary = `**${user(details.author_id)}**`;
	else if (targetName) primary = `**${plain(targetName)}**`;
	else if (payload.subject_type === 'invites' && subjectId) primary = `\`${plain(subjectId)}\``;
	else if (payload.subject_type !== 'message' && subjectId) primary = unknown(subjectId);
	if (
		payload.source_channel_id &&
		event !== 'voice_move' &&
		!(payload.subject_type === 'channels' && subjectId === payload.source_channel_id)
	)
		primary = [primary, channel(payload.source_channel_id)].filter(Boolean).join(' · ');
	const actorIsPrimary =
		payload.actor_id &&
		((payload.subject_type === 'user' && payload.actor_id === subjectId) ||
			(event !== 'message_bulk_delete' && payload.actor_id === details.author_id));
	const executorEvents =
		/^(member_(kick|ban|timeout|server|move|disconnect)|channel_|role_|member_role_|invite_|webhook_|emoji_|sticker_|guild_|message_(update|delete|bulk_delete|pin|unpin|publish))/.test(
			event,
		);
	if (!actorIsPrimary && (payload.actor_id != null || executorEvents)) add(t('actor'), user(payload.actor_id), true);
	if (details.user_id && details.user_id !== payload.actor_id && details.user_id !== subjectId)
		add(t('field_user_id'), user(details.user_id), true);
	if (payload.reason) add(t('reason'), plain(payload.reason));
	for (const change of payload.changes ?? []) {
		if (change.before === change.after || change.key === 'content') continue;
		// Delete snapshots identify the target above; repeating every former default hides the event.
		if (event.endsWith('_delete')) continue;
		if (
			event.endsWith('_create') &&
			change.before === null &&
			(['position', 'hoist_position'].includes(change.key) ||
				['0', 'false', '[]', '{}', '', null].includes(change.after))
		)
			continue;
		if (change.key === 'name' && (!change.before || !change.after)) continue;
		if (['id', 'guild_id'].includes(change.key)) continue;
		if (change.key === 'attachments' && (details.attachments || details.previous_attachments)) continue;
		if (change.key === 'channel_id' && event !== 'voice_move') continue;
		if (
			['avatar_hash', 'banner_hash', 'icon_hash', 'splash_hash', 'embed_splash_hash'].includes(change.key) &&
			change.before &&
			change.after
		) {
			add(t(`field_${change.key}`), t('changed'));
			continue;
		}
		if (
			['permissions', 'allow', 'deny'].includes(change.key) &&
			/^\d+$/.test(change.before ?? '') &&
			/^\d+$/.test(change.after ?? '')
		) {
			const before = BigInt(change.before!),
				after = BigInt(change.after!);
			const added = after & ~before,
				removed = before & ~after;
			add(
				t(`field_${change.key}`),
				[
					added ? `+ ${format(change.key, added.toString())}` : '',
					removed ? `− ${format(change.key, removed.toString())}` : '',
				]
					.filter(Boolean)
					.join('\n') || t('changed'),
			);
			continue;
		}
		const before = format(change.key, change.before),
			after = format(change.key, change.after);
		add(
			t(`field_${change.key}`),
			change.before === null ? after : change.after === null ? before : `${before} → ${after}`,
		);
	}
	for (const [key, value] of Object.entries(details)) {
		if (
			['test', 'channel', 'channel_id', 'author_id', 'user_id', 'id', 'role_name', 'previous_attachments'].includes(
				key,
			) ||
			!value
		)
			continue;
		if (key === 'count' && value === '1') continue;
		if (key === 'type' && payload.subject_type === 'permissions') continue;
		if (key !== 'attachments' && payload.changes?.some((change) => change.key === key)) continue;
		if (key === 'attachments' && event === 'message_update' && value === details.previous_attachments) continue;
		if (key === 'attachments' && event === 'message_update' && details.previous_attachments) {
			add(`${t('before')} · ${t('attachments')}`, format('attachments', details.previous_attachments));
			add(`${t('after')} · ${t('attachments')}`, format('attachments', value));
		} else add(t(`field_${key}`), format(key, value));
	}
	if (event === 'message_update') {
		if (
			payload.previous_text !== payload.message_text &&
			(payload.previous_text != null || payload.message_text != null)
		) {
			add(t('before'), plain(payload.previous_text ?? '') || t('none'));
			add(t('after'), plain(payload.message_text ?? '') || t('none'));
		}
	} else if (event !== 'message_bulk_delete' && payload.message_text != null)
		add(t('message'), plain(payload.message_text) || t('none'));
	if (event === 'message_update' && details.previous_attachments && !details.attachments)
		add(`${t('before')} · ${t('attachments')}`, format('attachments', details.previous_attachments));
	const transcript = payload.transcript ?? payload.metadata_transcript;
	const full = [
		title,
		primary,
		...fields.map((field) => `${field.name}\n${field.value}`),
		new Date(delivery.occurred_at).toISOString(),
		transcript ?? '',
	]
		.filter(Boolean)
		.join('\n\n');
	let overflow = title.length > 256 || primary.length > 1000 || fields.length > 20 || !!transcript;
	let budget = 5700 - Math.min(title.length, 256) - Math.min(primary.length, 1000);
	const boundedFields = fields.slice(0, 20).flatMap((field) => {
		const name = clip(field.name!, 256),
			value = clip(field.value!, Math.min(1000, Math.max(1, budget - name.length)));
		if (budget < name.length + 2) {
			overflow = true;
			return [];
		}
		if (value !== field.value || name !== field.name) overflow = true;
		budget -= name.length + value.length;
		return [{...field, name, value}];
	});
	const jumpable =
		payload.subject_type === 'message' &&
		event !== 'message_delete' &&
		event !== 'message_bulk_delete' &&
		!!payload.source_channel_id &&
		/^\d+$/.test(subjectId ?? '') &&
		!!presentation.appUrl;
	const color =
		delivery.kind === 'test'
			? 0x5865f2
			: /(delete|leave|kick|ban_add|disconnect|clear)/.test(event)
				? 0xed4245
				: /(create|join|add|use)$/.test(event)
					? 0x43b581
					: /^(presence_|voice_self)/.test(event)
						? 0x99aab5
						: 0xfaa61a;
	return {
		content: '',
		embeds: [
			{
				type: 'rich',
				title: clip(title, 256),
				description: primary ? clip(primary, 1000) : null,
				url: jumpable
					? `${presentation.appUrl!.replace(/\/$/, '')}/channels/${delivery.guild_id}/${payload.source_channel_id}/${subjectId}`
					: null,
				color,
				timestamp: new Date(delivery.occurred_at),
				footer: {text: `${t('logTitle')}${overflow ? ' · 📎 event-log.txt' : ''}`, icon_url: null},
				fields: boundedFields.length ? boundedFields : null,
				author: null,
				provider: null,
				thumbnail: null,
				image: null,
				video: null,
				nsfw: null,
			},
		],
		attachment: overflow ? full : null,
	};
}
