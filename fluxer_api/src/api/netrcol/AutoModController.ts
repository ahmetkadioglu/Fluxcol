// SPDX-License-Identifier: AGPL-3.0-or-later

import {createGuildID} from '@app/api/BrandedTypes';
import {GuildRepository} from '@app/api/guild/repositories/GuildRepository';
import {LoginRequired} from '@app/api/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@app/api/middleware/RateLimitMiddleware';
import {OpenAPI} from '@app/api/middleware/ResponseTypeMiddleware';
import {AutoModRepository} from '@app/api/netrcol/AutoModRepository';
import {AutoModService} from '@app/api/netrcol/AutoModService';
import {RateLimitConfigs} from '@app/api/RateLimitConfig';
import type {HonoApp, HonoEnv} from '@app/api/types/HonoEnv';
import {Validator} from '@app/api/Validator';
import {MissingPermissionsError} from '@fluxer/errors/src/domains/core/MissingPermissionsError';
import {GuildIdParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';
import {
	AutoModHistoryResponse,
	AutoModSettingsResponse,
	AutoModSimulationRequest,
	AutoModSimulationResponse,
	AutoModUpdateRequest,
} from '@fluxer/schema/src/domains/guild/GuildAutoModSchemas';
import type {Context} from 'hono';

function service(ctx: Context<HonoEnv>) {
	if (ctx.get('user').isBot || ctx.get('user').isSystem) throw new MissingPermissionsError();
	return new AutoModService(new GuildRepository(), ctx.get('channelRepository'));
}
export function AutoModController(app: HonoApp) {
	const path = '/guilds/:guild_id/application-settings/automod';
	app.get(
		path,
		RateLimitMiddleware(RateLimitConfigs.GUILD_AUDIT_LOGS),
		LoginRequired,
		Validator('param', GuildIdParam),
		OpenAPI({
			operationId: 'get_auto_mod_settings',
			summary: 'Get AutoMod configuration',
			description: 'Owner-only built-in AutoMod settings.',
			responseSchema: AutoModSettingsResponse,
			statusCode: 200,
			security: ['sessionToken'],
			tags: ['Guilds'],
		}),
		async (ctx) =>
			ctx.json(await service(ctx).read(createGuildID(ctx.req.valid('param').guild_id), ctx.get('user').id)),
	);
	app.put(
		path,
		RateLimitMiddleware(RateLimitConfigs.GUILD_UPDATE),
		LoginRequired,
		Validator('param', GuildIdParam),
		Validator('json', AutoModUpdateRequest),
		OpenAPI({
			operationId: 'update_auto_mod_settings',
			summary: 'Save AutoMod configuration',
			description: 'Validates the saved policy and revision.',
			responseSchema: AutoModSettingsResponse,
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
	app.post(
		`${path}/simulate`,
		RateLimitMiddleware(RateLimitConfigs.GUILD_UPDATE),
		LoginRequired,
		Validator('param', GuildIdParam),
		Validator('json', AutoModSimulationRequest),
		OpenAPI({
			operationId: 'simulate_auto_mod',
			summary: 'Preview message checks',
			description: 'Evaluates saved content rules without sending messages or performing moderation.',
			responseSchema: AutoModSimulationResponse,
			statusCode: 200,
			security: ['sessionToken'],
			tags: ['Guilds'],
		}),
		async (ctx) =>
			ctx.json(
				await service(ctx).simulate(
					createGuildID(ctx.req.valid('param').guild_id),
					ctx.get('user').id,
					ctx.req.valid('json').content,
				),
			),
	);
	app.get(
		`${path}/history`,
		RateLimitMiddleware(RateLimitConfigs.GUILD_AUDIT_LOGS),
		LoginRequired,
		Validator('param', GuildIdParam),
		OpenAPI({
			operationId: 'list_auto_mod_history',
			summary: 'List AutoMod actions',
			description: 'Owner-only moderation outcomes without message contents.',
			responseSchema: AutoModHistoryResponse,
			statusCode: 200,
			security: ['sessionToken'],
			tags: ['Guilds'],
		}),
		async (ctx) => {
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			await service(ctx).authorize(guildId, ctx.get('user').id);
			return ctx.json({entries: await new AutoModRepository().history(guildId)});
		},
	);
}
