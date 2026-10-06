// SPDX-License-Identifier: AGPL-3.0-or-later

import type {GuildAuditLogRow} from '@app/api/database/types/GuildTypes';
import {gatewayLogEvents} from '@app/api/netrcol/EventLogGateway';
import {renderEventLog} from '@app/api/netrcol/EventLogRender';
import type {EventLogDelivery} from '@app/api/netrcol/EventLogRepository';
import {auditLogEvents, EVENT_LOG_CHANGE_FIELDS} from '@app/api/netrcol/EventLogSources';
import {AuditLogActionType} from '@fluxer/constants/src/AuditLogActionType';
import {
	EVENT_LOG_CATALOG,
	eventLogAvailable,
	eventLogChannel,
	eventLogProducer,
} from '@fluxer/constants/src/EventLogConstants';
import {EVENT_LOG_TRANSLATIONS} from '@fluxer/constants/src/EventLogTranslations';
import {EventLogSettings} from '@fluxer/schema/src/domains/guild/GuildEventLogSchemas';
import {describe, expect, it} from 'vitest';

describe('Comprehensive event catalog', () => {
	it('maps every native audit type once and explicitly disables producerless types', () => {
		const actions = Object.values(AuditLogActionType).filter((value) => typeof value === 'number');
		const mapped = EVENT_LOG_CATALOG.flatMap((event) => ('audit' in event ? [event.audit] : []));
		expect(actions).toHaveLength(35);
		expect([...mapped].sort((a, b) => a - b)).toEqual([...actions].sort((a, b) => a - b));
		expect(EVENT_LOG_CATALOG.filter((event) => !eventLogAvailable(event.id)).map((event) => event.id)).toEqual([
			'member_prune',
			'invite_update',
		]);
		for (const event of EVENT_LOG_CATALOG) {
			expect(eventLogProducer(event.id)).toBeTruthy();
			if (eventLogProducer(event.id) === 'audit')
				expect(
					'audit' in event || ['member_timeout', 'member_server_mute', 'member_server_deaf'].includes(event.id),
				).toBe(true);
		}
		expect(eventLogProducer('message_delete')).toBe('message');
		expect(eventLogProducer('message_pin')).toBe('audit');
	});
	it('uses message deletion as the canonical source and splits moderator changes without exposing secrets', () => {
		const row = {
			action_type: AuditLogActionType.MESSAGE_DELETE,
			user_id: 1n,
			target_id: '2',
			changes: JSON.stringify([
				{key: 'mute', old_value: false, new_value: true},
				{key: 'deaf', old_value: false, new_value: true},
				{key: 'nick', old_value: 'old', new_value: 'new'},
				{key: 'email', new_value: 'secret'},
			]),
			options: null,
			reason: null,
		} as GuildAuditLogRow;
		expect(auditLogEvents(row)).toEqual([]);
		const events = auditLogEvents({...row, action_type: AuditLogActionType.MEMBER_UPDATE});
		expect(events.map((event) => event.kind)).toEqual(['member_server_mute', 'member_server_deaf', 'member_update']);
		expect(JSON.stringify(events)).not.toContain('secret');
		for (const field of ['content_warning_text', 'vanity_url_code', 'owner_id', 'message_history_cutoff'])
			expect(EVENT_LOG_CHANGE_FIELDS.has(field)).toBe(true);
	});
	it('resolves event, category and default channels without fallback to another channel', () => {
		const settings = EventLogSettings.parse({
			enabled: true,
			channel_id: '10',
			events: ['message_delete'],
			language: 'tr',
			category_channels: {messages: '20'},
			event_channels: {message_delete: '30'},
		});
		expect(eventLogChannel(settings, 'message_delete')).toBe('30');
		settings.event_channels!.message_delete = null;
		expect(eventLogChannel(settings, 'message_delete')).toBe('20');
		settings.category_channels!.messages = null;
		expect(eventLogChannel(settings, 'message_delete')).toBe('10');
		settings.channel_id = null;
		expect(eventLogChannel(settings, 'message_delete')).toBeNull();
	});
	it('has complete localized event, field and state labels in all 34 languages', () => {
		expect(Object.keys(EVENT_LOG_TRANSLATIONS)).toHaveLength(34);
		const keys = Object.keys(EVENT_LOG_TRANSLATIONS['en-US']!);
		for (const copy of Object.values(EVENT_LOG_TRANSLATIONS)) {
			expect(Object.keys(copy)).toEqual(keys);
			for (const event of EVENT_LOG_CATALOG) expect(copy[event.id]?.length).toBeGreaterThan(0);
			for (const value of Object.values(copy)) expect(value).not.toMatch(/netrcol\.application_settings/);
			// These are different actions; a generic native label must not erase their meaning.
			expect(copy.voice_self_mute).not.toBe(copy.member_server_mute);
			expect(copy.member_prune).not.toBe(copy.member_kick);
			expect(copy.message_bulk_delete).not.toBe(copy.message_delete);
			expect(copy.field_banner_width).not.toBe(copy.field_banner_height);
		}
	});
	it('ignores presence hydration and unchanged state and separates voice changes', () => {
		const request = {
			type: 'event_log_transition' as const,
			guild_id: 1n,
			user_id: '2',
			source_id: 'test',
			occurred_at: 0,
			family: 'presence' as const,
			before: null,
			after: {status: 'online'},
		};
		expect(gatewayLogEvents(request)).toEqual([]);
		expect(gatewayLogEvents({...request, before: {status: 'online'}})).toEqual([]);
		expect(gatewayLogEvents({...request, before: {status: 'offline'}})).toEqual([
			{kind: 'presence_status', key: 'status'},
		]);
		expect(
			gatewayLogEvents({
				...request,
				family: 'voice',
				before: {channel_id: '10', self_mute: false},
				after: {channel_id: '20', self_mute: true},
			}).map((event) => event.kind),
		).toEqual(['voice_move', 'voice_self_mute']);
	});
	it('keeps long text and bulk transcripts in UTF-8 attachments and disables mention syntax', () => {
		const row = {
			kind: 'message_update',
			language: 'tr',
			occurred_at: 0,
			subject_id: 0n,
			payload: JSON.stringify({
				actor_id: null,
				subject_id: '12',
				source_channel_id: '13',
				message_text: `@everyone ${'ü'.repeat(4000)}`,
				previous_text: 'eski',
				transcript: 'döküm',
			}),
		} as EventLogDelivery;
		const rendered = renderEventLog(row);
		expect(rendered.content).toBe('');
		expect(JSON.stringify(rendered.embeds)).toContain('Bilinmiyor');
		expect(rendered.attachment).toContain('eski');
		expect(rendered.attachment).toContain('döküm');
		expect(JSON.stringify(rendered.embeds)).not.toMatch(/@everyone|<@/);
		for (const field of rendered.embeds[0]!.fields!) expect(field.value!.length).toBeLessThanOrEqual(1024);
		// Fluxer's message limit uses UTF-16 length; a code-point cap would allow 3,400 emoji units.
		const unicode = renderEventLog({
			...row,
			kind: 'guild_update',
			payload: JSON.stringify({
				actor_id: null,
				subject_id: '12',
				changes: [{key: 'description', before: null, after: '😀'.repeat(4000)}],
			}),
		});
		expect(unicode.embeds[0]!.fields![0]!.value!.length).toBeLessThanOrEqual(1024);
		expect(unicode.embeds[0]!.fields![0]!.value).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
		expect(unicode.attachment).toContain('😀'.repeat(4000));
	});
});
