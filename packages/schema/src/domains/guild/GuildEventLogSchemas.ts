// SPDX-License-Identifier: AGPL-3.0-or-later

import {EVENT_LOG_CATEGORIES, EVENT_LOG_IDS} from '@fluxer/constants/src/EventLogConstants';
import {schemaMetadata} from '@fluxer/schema/src/SchemaMetadata';
import {z} from 'zod';

export const EventLogEvent = z.enum(EVENT_LOG_IDS);
export type EventLogEvent = z.infer<typeof EventLogEvent>;
const Id = z.string().regex(/^[0-9]{1,20}$/);
export const EventLogSettings = z
	.object({
		enabled: z.boolean(),
		channel_id: Id.nullable(),
		events: z
			.array(EventLogEvent)
			.max(EVENT_LOG_IDS.length)
			.refine((events) => new Set(events).size === events.length),
		language: z.string().regex(/^[a-z]{2}(?:-[A-Z0-9]+)?$/),
		schema_version: z.literal(2).optional(),
		category_channels: z
			.record(z.string(), Id.nullable())
			.refine((value) =>
				Object.keys(value).every((key) => EVENT_LOG_CATEGORIES.includes(key as (typeof EVENT_LOG_CATEGORIES)[number])),
			)
			.register(schemaMetadata, {preserveEmptyValues: true})
			.optional(),
		event_channels: z
			.record(z.string(), Id.nullable())
			.refine((value) =>
				Object.keys(value).every((key) => EVENT_LOG_IDS.includes(key as (typeof EVENT_LOG_IDS)[number])),
			)
			.register(schemaMetadata, {preserveEmptyValues: true})
			.optional(),
		capture_message_content: z.boolean().optional(),
	})
	.strict();
export type EventLogSettings = z.infer<typeof EventLogSettings>;
export const EventLogUpdateRequest = EventLogSettings.extend({revision: z.number().int().min(0)});
export type EventLogUpdateRequest = z.infer<typeof EventLogUpdateRequest>;
export const EventLogStatus = z.enum([
	'disabled',
	'enabled',
	'owner_changed',
	'channel_missing',
	'stopped',
	'unsupported',
]);
export const EventLogSettingsResponse = z.object({
	settings: EventLogSettings,
	revision: z.number().int(),
	status: EventLogStatus,
	channels: z.array(z.object({id: Id, name: z.string()})),
});
export type EventLogSettingsResponse = z.infer<typeof EventLogSettingsResponse>;
export const EventLogHistoryEntry = z.object({
	id: z.string(),
	kind: z.enum(['config_updated', 'test', ...EVENT_LOG_IDS]),
	status: z.enum(['saved', 'pending', 'running', 'sent', 'skipped', 'failed']),
	actor_id: Id.nullable(),
	subject_id: z.string().max(100).nullable(),
	subject_type: z.string().optional(),
	source_id: z.string().optional(),
	source_channel_id: Id.nullable().optional(),
	test_event: EventLogEvent.optional(),
	channel_id: Id.nullable(),
	message_id: Id.nullable(),
	revision: z.number().int(),
	created_at: z.number(),
	reason: z.enum(['none', 'policy_changed', 'channel_missing', 'bot', 'delivery_failed', 'stopped']),
});
export type EventLogHistoryEntry = z.infer<typeof EventLogHistoryEntry>;
export const EventLogHistoryResponse = z.object({entries: z.array(EventLogHistoryEntry)});
export type EventLogHistoryResponse = z.infer<typeof EventLogHistoryResponse>;

export const EventLogPayload = z
	.object({
		actor_id: Id.nullable().optional(),
		subject_id: z.string().max(100).nullable().optional(),
		subject_type: z.string().max(30).optional(),
		source_channel_id: Id.nullable().optional(),
		reason: z.string().max(1024).nullable().optional(),
		changes: z
			.array(
				z.object({
					key: z.string().max(100),
					before: z.string().max(100000).nullable(),
					after: z.string().max(100000).nullable(),
				}),
			)
			.max(100)
			.optional(),
		message_text: z.string().max(100000).nullable().optional(),
		previous_text: z.string().max(100000).nullable().optional(),
		transcript: z.string().max(10000000).optional(),
		metadata_transcript: z.string().max(10000000).optional(),
		details: z.record(z.string().max(100), z.string().max(5000000)).optional(),
		test_event: EventLogEvent.optional(),
	})
	.strict();
export type EventLogPayload = z.infer<typeof EventLogPayload>;
