// SPDX-License-Identifier: AGPL-3.0-or-later

import {randomUUID} from 'node:crypto';
import {createChannelID, createGuildID} from '@app/api/BrandedTypes';
import {checkAutoModHold} from '@app/api/netrcol/AutoModSources';
import {eventLogContext} from '@app/api/netrcol/EventLogContext';
import type {HonoEnv} from '@app/api/types/HonoEnv';
import {AccessDeniedError} from '@fluxer/errors/src/domains/core/AccessDeniedError';
import {UnauthorizedError} from '@fluxer/errors/src/domains/core/UnauthorizedError';
import {createMiddleware} from 'hono/factory';

function ensureOAuth2BearerRouteSupport(
	authTokenType: 'session' | 'bearer' | 'bot' | 'admin_api_key' | undefined,
	oauthBearerAllowed: boolean | undefined,
): void {
	if (authTokenType === 'bearer' && !oauthBearerAllowed) {
		throw new AccessDeniedError();
	}
}

export const LoginRequired = createMiddleware<HonoEnv>(async (ctx, next) => {
	const user = ctx.get('user');
	if (!user) {
		throw new UnauthorizedError();
	}
	ensureOAuth2BearerRouteSupport(ctx.get('authTokenType'), ctx.get('oauthBearerAllowed'));
	if (!['GET', 'HEAD', 'OPTIONS'].includes(ctx.req.method)) {
		const guildParam = ctx.req.param('guild_id');
		const channelParam = ctx.req.param('channel_id');
		const guildId =
			guildParam && /^\d{1,20}$/.test(guildParam)
				? createGuildID(BigInt(guildParam))
				: channelParam && /^\d{1,20}$/.test(channelParam)
					? (await ctx.get('channelRepository').findUnique(createChannelID(BigInt(channelParam))))?.guildId
					: null;
		if (guildId) await checkAutoModHold(guildId, user.id);
	}
	let reason = ctx.req.header('x-audit-log-reason');
	try {
		if (reason) reason = decodeURIComponent(reason);
	} catch {
		reason = undefined;
	}
	await eventLogContext.run(
		{actor_id: user.id.toString(), request_id: randomUUID(), reason: reason?.slice(0, 1024)},
		next,
	);
});
export const DefaultUserOnly = createMiddleware<HonoEnv>(async (ctx, next) => {
	const user = ctx.get('user');
	if (!user) {
		throw new UnauthorizedError();
	}
	if (user.isBot) {
		throw new AccessDeniedError();
	}
	await next();
});
