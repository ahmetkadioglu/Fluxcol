// SPDX-License-Identifier: AGPL-3.0-or-later

import {createGuildID} from '@app/api/BrandedTypes';
import {GuildRepository} from '@app/api/guild/repositories/GuildRepository';
import {LoginRequired} from '@app/api/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@app/api/middleware/RateLimitMiddleware';
import {OpenAPI} from '@app/api/middleware/ResponseTypeMiddleware';
import {ModuleSettingsService} from '@app/api/netrcol/ModuleSettingsService';
import {RateLimitConfigs} from '@app/api/RateLimitConfig';
import type {HonoApp, HonoEnv} from '@app/api/types/HonoEnv';
import {Validator} from '@app/api/Validator';
import {MissingPermissionsError} from '@fluxer/errors/src/domains/core/MissingPermissionsError';
import {GuildIdParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';
import {
	ModuleSettingsResponse,
	ModuleSettingsUpdateRequest,
} from '@fluxer/schema/src/domains/guild/GuildModuleSettingsSchemas';
import type {Context} from 'hono';

function service(ctx: Context<HonoEnv>) {
	if (ctx.get('user').isBot || ctx.get('user').isSystem) throw new MissingPermissionsError();
	return new ModuleSettingsService(new GuildRepository());
}
export function ModuleSettingsController(app: HonoApp) {
	const path = '/guilds/:guild_id/application-settings/modules';
	app.get(
		path,
		RateLimitMiddleware(RateLimitConfigs.GUILD_AUDIT_LOGS),
		LoginRequired,
		Validator('param', GuildIdParam),
		OpenAPI({
			operationId: 'get_module_settings',
			summary: 'Get shared module settings',
			description: 'Owner-only Netrcol message language for this community.',
			responseSchema: ModuleSettingsResponse,
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
		Validator('json', ModuleSettingsUpdateRequest),
		OpenAPI({
			operationId: 'update_module_settings',
			summary: 'Save shared module settings',
			description: 'Saves Netrcol message language with ownership and revision checks.',
			responseSchema: ModuleSettingsResponse,
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
}
