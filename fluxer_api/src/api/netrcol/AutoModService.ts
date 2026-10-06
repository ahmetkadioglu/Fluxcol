// SPDX-License-Identifier: AGPL-3.0-or-later

import {createUserID, type GuildID, type UserID} from '@app/api/BrandedTypes';
import type {IChannelRepository} from '@app/api/channel/IChannelRepository';
import type {IGuildRepositoryAggregate} from '@app/api/guild/repositories/IGuildRepositoryAggregate';
import {evaluateAutoMod} from '@app/api/netrcol/AutoModEngine';
import {AutoModRepository} from '@app/api/netrcol/AutoModRepository';
import {eventLogStopped, eventLogSupported} from '@app/api/netrcol/EventLogRepository';
import {ChannelTypes, GUILD_TEXT_BASED_CHANNEL_TYPES} from '@fluxer/constants/src/ChannelConstants';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import {MissingAccessError} from '@fluxer/errors/src/domains/core/MissingAccessError';
import {MissingPermissionsError} from '@fluxer/errors/src/domains/core/MissingPermissionsError';
import {
	type AutoModSettingsResponse,
	type AutoModUpdateRequest,
	sharedAutoModPermissions,
} from '@fluxer/schema/src/domains/guild/GuildAutoModSchemas';

export class AutoModService {
	constructor(
		private readonly guilds: IGuildRepositoryAggregate,
		private readonly channels: IChannelRepository,
		private readonly repository = new AutoModRepository(),
	) {}
	async authorize(guildId: GuildID, userId: UserID) {
		if (!eventLogSupported()) throw new MissingAccessError();
		const [guild, member] = await Promise.all([
			this.guilds.findUnique(guildId),
			this.guilds.getMember(guildId, userId),
		]);
		if (!guild || !member) throw new MissingAccessError();
		if (guild.ownerId !== userId) throw new MissingPermissionsError();
		return guild;
	}
	async read(guildId: GuildID, userId: UserID): Promise<AutoModSettingsResponse> {
		const guild = await this.authorize(guildId, userId);
		const [config, channels, roles] = await Promise.all([
			this.repository.config(guildId),
			this.channels.listGuildChannels(guildId),
			this.guilds.listRoles(guildId),
		]);
		return {
			settings: config.settings,
			revision: config.revision,
			status: eventLogStopped()
				? 'stopped'
				: !config.settings.enabled
					? 'disabled'
					: config.approved_by !== String(guild.ownerId)
						? 'owner_changed'
						: 'enabled',
			channels: channels
				.filter((c) => c.guildId === guildId && c.type === ChannelTypes.GUILD_TEXT && !c.isSoftDeleted)
				.sort((a, b) => a.position - b.position)
				.map((c) => ({id: String(c.id), name: c.name ?? String(c.id)})),
			roles: roles
				.filter((r) => String(r.id) !== String(guildId))
				.sort((a, b) => b.position - a.position)
				.map((r) => ({id: String(r.id), name: r.name})),
			scope_channels: channels
				.filter((c) => c.guildId === guildId && GUILD_TEXT_BASED_CHANNEL_TYPES.has(c.type) && !c.isSoftDeleted)
				.sort((a, b) => a.position - b.position)
				.map((c) => ({id: String(c.id), name: c.name ?? String(c.id)})),
			categories: channels
				.filter((c) => c.guildId === guildId && c.type === ChannelTypes.GUILD_CATEGORY && !c.isSoftDeleted)
				.sort((a, b) => a.position - b.position)
				.map((c) => ({id: String(c.id), name: c.name ?? String(c.id)})),
			lockdown_until: await this.repository.holdUntil(guildId, 'raid_hold', config),
		};
	}
	async save(guildId: GuildID, userId: UserID, request: AutoModUpdateRequest) {
		const available = await this.read(guildId, userId);
		const {revision, ...settings} = request;
		const validChannels = new Set(available.channels.map((c) => c.id));
		const validRoles = new Set(available.roles.map((r) => r.id));
		const validScopeChannels = new Set(available.scope_channels.map((c) => c.id));
		const validCategories = new Set(available.categories.map((c) => c.id));
		const scopes = [
			sharedAutoModPermissions(settings),
			...Object.values(settings.rules).flatMap((rule) => (rule.permissions ? [rule.permissions] : [])),
		];
		if (
			scopes.some(
				(scope) =>
					scope.channels.ids.some((id) => !validScopeChannels.has(id)) ||
					scope.roles.ids.some((id) => !validRoles.has(id)) ||
					scope.categories.ids.some((id) => !validCategories.has(id)),
			)
		)
			throw InputValidationError.fromCode('permissions', ValidationErrorCodes.INVALID_FORMAT);
		const members = await Promise.all(
			[...new Set(scopes.flatMap((scope) => scope.users.ids))].map((id) =>
				this.guilds.getMember(guildId, createUserID(BigInt(id))),
			),
		);
		if (members.some((member) => !member))
			throw InputValidationError.fromCode('permissions.users', ValidationErrorCodes.INVALID_FORMAT);
		if (
			(settings.channel_id && !validChannels.has(settings.channel_id)) ||
			settings.exempt_channel_ids.some((id) => !validScopeChannels.has(id)) ||
			settings.exempt_role_ids.some((id) => !validRoles.has(id))
		)
			throw InputValidationError.fromCode('settings', ValidationErrorCodes.INVALID_FORMAT);
		if (settings.enabled && Object.values(settings.rules).every((rule) => rule.action === 'disabled'))
			throw InputValidationError.fromCode('rules', ValidationErrorCodes.INVALID_FORMAT);
		await this.authorize(guildId, userId);
		await this.repository.save(guildId, userId, settings, revision);
		return this.read(guildId, userId);
	}
	async simulate(guildId: GuildID, userId: UserID, content: string) {
		await this.authorize(guildId, userId);
		const config = await this.repository.config(guildId);
		return {
			rules: evaluateAutoMod(config.settings, {
				id: 'simulation',
				guild_id: String(guildId),
				user_id: String(userId),
				channel_id: null,
				message_id: null,
				kind: 'message',
				content,
				media: 0,
				occurred_at: Date.now(),
				edited: false,
			}),
		};
	}
}
