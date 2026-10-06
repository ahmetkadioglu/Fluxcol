// SPDX-License-Identifier: AGPL-3.0-or-later

import {createGuildID} from '@app/api/BrandedTypes';
import {GuildRepository} from '@app/api/guild/repositories/GuildRepository';
import {LoginRequired} from '@app/api/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@app/api/middleware/RateLimitMiddleware';
import {OpenAPI} from '@app/api/middleware/ResponseTypeMiddleware';
import {EventLogService} from '@app/api/netrcol/EventLogService';
import {RateLimitConfigs} from '@app/api/RateLimitConfig';
import type {HonoApp, HonoEnv} from '@app/api/types/HonoEnv';
import {Validator} from '@app/api/Validator';
import {MissingPermissionsError} from '@fluxer/errors/src/domains/core/MissingPermissionsError';
import {GuildIdParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';
import {
	EventLogEvent,
	EventLogHistoryResponse,
	EventLogSettingsResponse,
	EventLogUpdateRequest,
} from '@fluxer/schema/src/domains/guild/GuildEventLogSchemas';
import type {Context} from 'hono';
import {z} from 'zod';

function service(ctx: Context<HonoEnv>) {
	if (ctx.get('user').isBot || ctx.get('user').isSystem) throw new MissingPermissionsError();
	return new EventLogService(new GuildRepository(), ctx.get('channelRepository'));
}

export function EventLogController(app: HonoApp) {
	app.get(
		'/guilds/:guild_id/application-settings/event-logs',
		RateLimitMiddleware(RateLimitConfigs.GUILD_AUDIT_LOGS),
		LoginRequired,
		Validator('param', GuildIdParam),
		OpenAPI({
			operationId: 'get_event_log_settings',
			summary: 'Get built-in event log settings',
			description: 'Community-owner-only settings on self-hosted PostgreSQL instances.',
			responseSchema: EventLogSettingsResponse,
			statusCode: 200,
			security: ['sessionToken'],
			tags: ['Guilds'],
		}),
		async (ctx) =>
			ctx.json(await service(ctx).read(createGuildID(ctx.req.valid('param').guild_id), ctx.get('user').id)),
	);
	app.put(
		'/guilds/:guild_id/application-settings/event-logs',
		RateLimitMiddleware(RateLimitConfigs.GUILD_UPDATE),
		LoginRequired,
		Validator('param', GuildIdParam),
		Validator('json', EventLogUpdateRequest),
		OpenAPI({
			operationId: 'update_event_log_settings',
			summary: 'Save built-in event log settings',
			description: 'Validates community ownership, channel scope and configuration revision.',
			responseSchema: EventLogSettingsResponse,
			statusCode: 200,
			security: ['sessionToken'],
			tags: ['Guilds'],
		}),
		async (ctx) =>
			ctx.json(
				await service(ctx).save(
					createGuildID(ctx.req.valid('param').guild_id),
					ctx.get('user').id,
					ctx.req.valid('json'),
				),
			),
	);
	app.get(
		'/guilds/:guild_id/application-settings/history',
		RateLimitMiddleware(RateLimitConfigs.GUILD_AUDIT_LOGS),
		LoginRequired,
		Validator('param', GuildIdParam),
		OpenAPI({
			operationId: 'list_application_settings_history',
			summary: 'List built-in module action history',
			description: 'Returns the latest 50 configuration changes and event log outcomes for this community.',
			responseSchema: EventLogHistoryResponse,
			statusCode: 200,
			security: ['sessionToken'],
			tags: ['Guilds'],
		}),
		async (ctx) =>
			ctx.json(await service(ctx).history(createGuildID(ctx.req.valid('param').guild_id), ctx.get('user').id)),
	);
	app.post(
		'/guilds/:guild_id/application-settings/event-logs/test',
		RateLimitMiddleware(RateLimitConfigs.GUILD_UPDATE),
		LoginRequired,
		Validator('param', GuildIdParam),
		Validator('json', z.object({event_type: EventLogEvent.optional()}).strict()),
		OpenAPI({
			operationId: 'test_event_log_delivery',
			summary: 'Queue an event log test',
			description: 'Queues one test in the saved channel. Does not change membership.',
			responseSchema: z.object({queued: z.literal(true)}),
			statusCode: 200,
			security: ['sessionToken'],
			tags: ['Guilds'],
		}),
		async (ctx) => {
			await service(ctx).test(
				createGuildID(ctx.req.valid('param').guild_id),
				ctx.get('user').id,
				ctx.get('snowflakeService'),
				ctx.req.valid('json').event_type,
			);
			return ctx.json({queued: true as const});
		},
	);
}
