// SPDX-License-Identifier: AGPL-3.0-or-later

import {createGuildID} from '@app/api/BrandedTypes';
import {resolveEventLogPresentation} from '@app/api/netrcol/EventLogPresentation';
import {type EventLogPresentation, renderEventLog} from '@app/api/netrcol/EventLogRender';
import type {EventLogDelivery} from '@app/api/netrcol/EventLogRepository';
import {ChannelTypes, Permissions} from '@fluxer/constants/src/ChannelConstants';
import {EVENT_LOG_CATALOG} from '@fluxer/constants/src/EventLogConstants';
import {EVENT_LOG_TRANSLATIONS} from '@fluxer/constants/src/EventLogTranslations';
import type {EventLogPayload} from '@fluxer/schema/src/domains/guild/GuildEventLogSchemas';
import {describe, expect, it, vi} from 'vitest';

const guildId = createGuildID(10n);
const presentation: EventLogPresentation = {
	users: {'20': 'Ada', '21': 'Moderator'},
	channels: {
		'30': {name: 'general', type: ChannelTypes.GUILD_TEXT},
		'31': {name: 'Lounge', type: ChannelTypes.GUILD_VOICE},
	},
	roles: {'40': 'Members'},
	guildName: 'Community',
	appUrl: 'http://localhost:8088',
};
function delivery(kind: EventLogDelivery['kind'], payload: EventLogPayload, language = 'tr'): EventLogDelivery {
	return {
		kind,
		guild_id: guildId,
		subject_id: 20n,
		language,
		occurred_at: Date.UTC(2026, 9, 5, 15),
		payload: JSON.stringify(payload),
	} as EventLogDelivery;
}
const embed = (kind: EventLogDelivery['kind'], payload: EventLogPayload, context = presentation) =>
	renderEventLog(delivery(kind, payload), context).embeds[0]!;

describe('Readable native event-log embeds', () => {
	it('shows one named author and channel, without raw identity or redundant counts', () => {
		const result = embed('message_create', {
			actor_id: '20',
			subject_id: '50',
			subject_type: 'message',
			source_channel_id: '30',
			details: {count: '1', channel: 'general', author_id: '20'},
			message_text: 'Hello',
		});
		expect(result).toMatchObject({
			title: 'Mesaj oluşturuldu',
			description: '**Ada** · [#general](http://localhost:8088/channels/10/30)',
			color: 0x43b581,
			url: 'http://localhost:8088/channels/10/30/50',
			timestamp: new Date(Date.UTC(2026, 9, 5, 15)),
			footer: {text: 'Olay kayıtları'},
			fields: [{name: 'Mesaj', value: 'Hello', inline: false}],
		});
	});
	it('shows only before and after text for a self edit, escaping copied mentions and formatting', () => {
		const result = embed('message_update', {
			actor_id: '20',
			subject_id: '50',
			subject_type: 'message',
			source_channel_id: '30',
			details: {count: '1', author_id: '20', channel: 'general'},
			changes: [{key: 'content', before: null, after: null}],
			previous_text: 'old',
			message_text: '@everyone **new** <@21>',
		});
		expect(result.fields).toEqual([
			{name: 'Önce', value: 'old', inline: false},
			{name: 'Sonra', value: '@\u200beveryone \\*\\*new\\*\\* \\<@\u200b21\\>', inline: false},
		]);
	});
	it('identifies moderation actors and reason; unknown executors are explicit and deleted messages have no jump link', () => {
		const payload: EventLogPayload = {actor_id: '21', subject_id: '20', subject_type: 'user', reason: 'Rule violation'};
		const ban = embed('member_ban_add', payload);
		expect(ban.description).toBe('**Ada**');
		expect(ban.color).toBe(0xed4245);
		expect(ban.fields?.map((field) => field.value)).toEqual(['Moderator', 'Rule violation']);
		const removed = embed('message_delete', {
			...payload,
			actor_id: null,
			subject_type: 'message',
			subject_id: '50',
			source_channel_id: '30',
			details: {author_id: '20'},
			message_text: 'Deleted text',
		});
		expect(removed.url).toBeNull();
		expect(removed.fields?.[0]?.value).toBe('Bilinmiyor');
		expect(removed.fields?.at(-1)?.value).toBe('Deleted text');
	});
	it('uses localized presence and permission names, with permission deltas instead of bitmasks', () => {
		const state = embed('presence_status', {
			actor_id: '20',
			subject_id: '20',
			subject_type: 'user',
			changes: [{key: 'status', before: 'online', after: 'idle'}],
		});
		expect(state.fields).toEqual([{name: 'Durum', value: 'Çevrimiçi → Boşta', inline: false}]);
		const result = embed('role_update', {
			actor_id: '21',
			subject_id: '40',
			subject_type: 'roles',
			changes: [
				{key: 'permissions', before: Permissions.VIEW_CHANNEL.toString(), after: Permissions.SEND_MESSAGES.toString()},
			],
		});
		expect(result.fields?.at(-1)?.value).toBe(
			`+ ${EVENT_LOG_TRANSLATIONS.tr!.permission_SEND_MESSAGES}\n− ${EVENT_LOG_TRANSLATIONS.tr!.permission_VIEW_CHANNEL}`,
		);
		const overrides = embed('channel_update', {
			actor_id: '21',
			subject_id: '30',
			subject_type: 'channels',
			changes: [
				{
					key: 'permission_overwrites',
					before: '[]',
					after: JSON.stringify([{id: '40', type: 0, allow: Permissions.VIEW_CHANNEL.toString(), deny: '0'}]),
				},
			],
		});
		expect(overrides.fields?.at(-1)?.value).toContain('Members');
		expect(overrides.fields?.at(-1)?.value).toContain(EVENT_LOG_TRANSLATIONS.tr!.permission_VIEW_CHANNEL);
		expect(overrides.fields?.at(-1)?.value).not.toContain('1024');
	});
	it('names voice moves, role changes and deleted targets without redundant or dead channel links', () => {
		const move = embed('voice_move', {
			subject_type: 'user',
			subject_id: '20',
			source_channel_id: '31',
			changes: [{key: 'channel_id', before: '30', after: '31'}],
		});
		expect(move.description).toBe('**Ada**');
		expect(move.fields?.[0]?.value).toContain('#general');
		expect(move.fields?.[0]?.value).toContain('🔊 Lounge');
		const roles = embed('member_role_update', {
			actor_id: '21',
			subject_type: 'user',
			subject_id: '20',
			changes: [{key: '$add', before: null, after: '40'}],
		});
		expect(roles.fields?.at(-1)?.value).toBe('Members');
		const removed = embed('channel_delete', {
			actor_id: '21',
			subject_type: 'channels',
			subject_id: '32',
			source_channel_id: '32',
			details: {type: '4'},
			changes: [
				{key: 'name', before: 'Category', after: null},
				{key: 'position', before: '5', after: null},
			],
		});
		expect(removed.description).toBe('Category');
		expect(removed.fields?.map((field) => field.value)).toEqual([
			'Moderator',
			EVENT_LOG_TRANSLATIONS.tr!.channel_category,
		]);
	});
	it('omits default create snapshot values, counts, IDs and duplicated metadata', () => {
		const result = embed('role_create', {
			actor_id: '21',
			subject_type: 'roles',
			subject_id: '40',
			changes: [
				{key: 'name', before: null, after: 'Members'},
				{key: 'permissions', before: null, after: '0'},
				{key: 'hoist', before: null, after: 'false'},
				{key: 'position', before: null, after: '12'},
			],
		});
		expect(result.fields).toEqual([{name: EVENT_LOG_TRANSLATIONS.tr!.actor, value: 'Moderator', inline: true}]);
	});
	it('formats file metadata without copying files, and never invents text when capture is off', () => {
		const result = embed('message_update', {
			actor_id: '20',
			subject_type: 'message',
			subject_id: '50',
			details: {
				author_id: '20',
				attachments: 'photo.png (image/png, 2048)',
				previous_attachments: 'old.png (image/png, 1024)',
			},
			changes: [{key: 'attachments', before: '1', after: '1'}],
		});
		expect(result.fields?.map((field) => field.value)).toEqual([
			'old.png image/png · 1.0 KiB',
			'photo.png image/png · 2.0 KiB',
		]);
		expect(result.fields?.every((field) => field.name !== 'Önce' && field.name !== 'Sonra')).toBe(true);
	});
	it('keeps every localized event family in native embed limits and saves complete overflow text', () => {
		for (const [language, copy] of Object.entries(EVENT_LOG_TRANSLATIONS)) {
			for (const event of EVENT_LOG_CATALOG) {
				const rendered = renderEventLog(
					delivery(event.id, {subject_id: '20', subject_type: 'user'}, language),
					presentation,
				);
				expect(rendered.content).toBe('');
				expect(rendered.embeds[0]!.title).toBe(copy[event.id]);
			}
		}
		const rendered = renderEventLog(
			delivery('guild_update', {
				subject_type: 'guild',
				subject_id: '10',
				changes: Array.from({length: 30}, (_, index) => ({
					key: `field${index}`,
					before: null,
					after: '😀'.repeat(4000),
				})),
				transcript: 'complete bulk transcript',
			}),
			presentation,
		);
		const result = rendered.embeds[0]!;
		const text = [
			result.title ?? '',
			result.description ?? '',
			result.footer?.text ?? '',
			...(result.fields ?? []).flatMap((field) => [field.name ?? '', field.value ?? '']),
		];
		expect(text.reduce((length, value) => length + value.length, 0)).toBeLessThanOrEqual(6000);
		expect(result.fields!.length).toBeLessThanOrEqual(25);
		for (const field of result.fields!) {
			expect(field.name!.length).toBeLessThanOrEqual(256);
			expect(field.value!.length).toBeLessThanOrEqual(1024);
			expect(field.value).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
		}
		expect(rendered.attachment).toContain('😀'.repeat(4000));
		expect(rendered.attachment).toContain('complete bulk transcript');
	});
	it('does not repeat unchanged attachments on a text edit or attribute a bulk deletion to its first author', () => {
		const edit = embed('message_update', {
			actor_id: '20',
			subject_id: '50',
			subject_type: 'message',
			details: {
				author_id: '20',
				attachments: 'photo.png (image/png, 2048)',
				previous_attachments: 'photo.png (image/png, 2048)',
			},
			previous_text: 'old',
			message_text: 'new',
		});
		expect(edit.fields?.map((field) => field.name)).toEqual(['Önce', 'Sonra']);
		const bulk = renderEventLog(
			delivery('message_bulk_delete', {
				actor_id: '20',
				subject_id: '50',
				subject_type: 'message',
				source_channel_id: '30',
				details: {author_id: '20', count: '2'},
				message_text: 'first message',
				transcript: 'full transcript of both authors',
			}),
			presentation,
		);
		expect(bulk.embeds[0]!.description).toBe('[#general](http://localhost:8088/channels/10/30)');
		expect(bulk.embeds[0]!.fields?.map((field) => field.value)).toEqual(['Ada', '2']);
		expect(bulk.attachment).toContain('full transcript of both authors');
	});
	it('marks test messages and reads old membership queue records', () => {
		const result = renderEventLog(
			{
				...delivery('test', {test_event: 'member_join', subject_id: '20', subject_type: 'user'}),
				payload: JSON.stringify({test_event: 'member_join'}),
			},
			presentation,
		);
		expect(result.embeds[0]!.title).toBe('Test mesajı · Üye katıldı');
		expect(result.embeds[0]!.description).toBe('**Ada**');
	});
});

describe('Event-log display-name resolution', () => {
	it('prefers community nicknames, survives failed member lookup and rejects foreign or deleted channels', async () => {
		const deps = {
			userRepository: {
				findUnique: vi.fn(async (id: bigint) => ({globalName: id === 20n ? 'Global Ada' : 'Moderator'})),
			},
			guildRepository: {
				getMember: vi.fn(async (_guild: bigint, id: bigint) => {
					if (id === 21n) throw Error('unavailable');
					return {nickname: 'Local Ada'};
				}),
			},
			channelRepository: {
				findUnique: vi.fn(async (id: bigint) => ({
					guildId: id === 32n ? 99n : guildId,
					isSoftDeleted: id === 33n,
					name: 'channel',
					type: 0,
				})),
			},
		};
		const result = await resolveEventLogPresentation(
			delivery('message_update', {
				actor_id: '21',
				subject_type: 'message',
				subject_id: '50',
				source_channel_id: '30',
				details: {author_id: '20'},
				changes: [{key: 'parent_id', before: '32', after: '33'}],
			}),
			deps as never,
			'Community',
		);
		expect(result.users).toEqual({'20': 'Local Ada', '21': 'Moderator'});
		expect(Object.keys(result.channels!)).toEqual(['30']);
		expect(deps.userRepository.findUnique).toHaveBeenCalledTimes(2);
	});
	it('bounds role lookups and resolves permission-overwrite targets once', async () => {
		const deps = {
			userRepository: {findUnique: vi.fn(async () => ({username: 'Ada'}))},
			guildRepository: {
				getMember: vi.fn(async () => null),
				listRolesByIds: vi.fn(async (ids: Array<bigint>) => ids.map((id) => ({id, name: `Role ${id}`}))),
			},
			channelRepository: {findUnique: vi.fn(async () => ({guildId, name: 'general', type: 0}))},
		};
		const result = await resolveEventLogPresentation(
			delivery('channel_update', {
				actor_id: '20',
				subject_type: 'channels',
				subject_id: '30',
				source_channel_id: '30',
				changes: [
					{
						key: 'permission_overwrites',
						before: null,
						after: JSON.stringify([
							{id: '20', type: 1, allow: '0', deny: '0'},
							...Array.from({length: 100}, (_, index) => ({id: String(40 + index), type: 0, allow: '0', deny: '0'})),
						]),
					},
				],
			}),
			deps as never,
			'Community',
		);
		expect(Object.keys(result.roles!)).toHaveLength(32);
		expect(deps.guildRepository.listRolesByIds).toHaveBeenCalledTimes(1);
		expect(deps.channelRepository.findUnique).toHaveBeenCalledTimes(1);
		expect(deps.userRepository.findUnique).toHaveBeenCalledTimes(1);
	});
});
