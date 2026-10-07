// SPDX-License-Identifier: AGPL-3.0-or-later
import type {GuildID, UserID} from '@app/api/BrandedTypes';
import type {IGuildRepositoryAggregate} from '@app/api/guild/repositories/IGuildRepositoryAggregate';
import {automaticRoleEligible} from '@app/api/netrcol/AutomaticRolePolicy';
import {AutomaticRoleRepository} from '@app/api/netrcol/AutomaticRoleRepository';
import {eventLogStopped, eventLogSupported} from '@app/api/netrcol/EventLogRepository';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import {MissingAccessError} from '@fluxer/errors/src/domains/core/MissingAccessError';
import {MissingPermissionsError} from '@fluxer/errors/src/domains/core/MissingPermissionsError';
import {
	type AutomaticRoleSettingsResponse,
	AutomaticRoleUpdateRequest,
} from '@fluxer/schema/src/domains/guild/GuildAutomaticRoleSchemas';

export class AutomaticRoleService {
	constructor(
		private readonly guilds: IGuildRepositoryAggregate,
		private readonly repository = new AutomaticRoleRepository(),
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
	async read(guildId: GuildID, userId: UserID): Promise<AutomaticRoleSettingsResponse> {
		const guild = await this.authorize(guildId, userId);
		const [config, roles] = await Promise.all([this.repository.config(guildId), this.guilds.listRoles(guildId)]);
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
			roles: roles
				.filter((r) => String(r.id) !== String(guildId))
				.sort((a, b) => b.position - a.position)
				.map((r) => ({id: String(r.id), name: r.name, eligible: automaticRoleEligible(r, guildId)})),
		};
	}
	async save(guildId: GuildID, userId: UserID, input: AutomaticRoleUpdateRequest) {
		const {revision, ...settings} = AutomaticRoleUpdateRequest.parse(input);
		const available = await this.read(guildId, userId);
		const eligible = new Set(available.roles.filter((r) => r.eligible).map((r) => r.id));
		if ([...settings.member_role_ids, ...settings.bot_role_ids].some((id) => !eligible.has(id)))
			throw InputValidationError.fromCode('role_ids', ValidationErrorCodes.INVALID_FORMAT);
		if (settings.enabled && !settings.member_role_ids.length && !settings.bot_role_ids.length)
			throw InputValidationError.fromCode('role_ids', ValidationErrorCodes.INVALID_FORMAT);
		await this.authorize(guildId, userId);
		await this.repository.save(guildId, userId, settings, revision);
		return this.read(guildId, userId);
	}
}
