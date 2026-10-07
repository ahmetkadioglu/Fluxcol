// SPDX-License-Identifier: AGPL-3.0-or-later

import {createGuildID} from '@app/api/BrandedTypes';
import {GuildRepository} from '@app/api/guild/repositories/GuildRepository';
import {LoginRequired} from '@app/api/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@app/api/middleware/RateLimitMiddleware';
import {OpenAPI} from '@app/api/middleware/ResponseTypeMiddleware';
import {AutomaticRoleRepository} from '@app/api/netrcol/AutomaticRoleRepository';
import {AutomaticRoleService} from '@app/api/netrcol/AutomaticRoleService';
import {RateLimitConfigs} from '@app/api/RateLimitConfig';
import type {HonoApp, HonoEnv} from '@app/api/types/HonoEnv';
import {Validator} from '@app/api/Validator';
import {MissingPermissionsError} from '@fluxer/errors/src/domains/core/MissingPermissionsError';
import {GuildIdParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';
import {
	AutomaticRoleHistoryResponse,
	AutomaticRoleSettingsResponse,
	AutomaticRoleUpdateRequest,
} from '@fluxer/schema/src/domains/guild/GuildAutomaticRoleSchemas';
import type {Context} from 'hono';

function service(ctx: Context<HonoEnv>) {
	if (ctx.get('user').isBot || ctx.get('user').isSystem) throw new MissingPermissionsError();
	return new AutomaticRoleService(new GuildRepository());
}
export function AutomaticRoleController(app: HonoApp) {
	const path = '/guilds/:guild_id/application-settings/automatic-roles';
	app.get(
		path,
		RateLimitMiddleware(RateLimitConfigs.GUILD_AUDIT_LOGS),
		LoginRequired,
		Validator('param', GuildIdParam),
		OpenAPI({
			operationId: 'get_automatic_roles',
			summary: 'Get automatic role settings',
			description: 'Owner-only starting role assignments for this community.',
			responseSchema: AutomaticRoleSettingsResponse,
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
		Validator('json', AutomaticRoleUpdateRequest),
		OpenAPI({
			operationId: 'update_automatic_roles',
			summary: 'Save automatic role settings',
			description: 'Saves starting role assignments with ownership, role eligibility and revision checks.',
			responseSchema: AutomaticRoleSettingsResponse,
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
		`${path}/history`,
		RateLimitMiddleware(RateLimitConfigs.GUILD_AUDIT_LOGS),
		LoginRequired,
		Validator('param', GuildIdParam),
		OpenAPI({
			operationId: 'get_automatic_role_history',
			summary: 'Get automatic role action history',
			description: 'Owner-only configuration changes and starting role assignment results.',
			responseSchema: AutomaticRoleHistoryResponse,
			statusCode: 200,
			security: ['sessionToken'],
			tags: ['Guilds'],
		}),
		async (ctx) => {
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			await service(ctx).authorize(guildId, ctx.get('user').id);
			return ctx.json({entries: await new AutomaticRoleRepository().history(guildId)});
		},
	);
}
