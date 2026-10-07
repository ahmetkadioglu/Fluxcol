// SPDX-License-Identifier: AGPL-3.0-or-later

import type {GuildID, UserID} from '@app/api/BrandedTypes';
import type {IGuildRepositoryAggregate} from '@app/api/guild/repositories/IGuildRepositoryAggregate';
import {eventLogSupported} from '@app/api/netrcol/EventLogRepository';
import {ModuleSettingsRepository} from '@app/api/netrcol/ModuleSettingsRepository';
import {MissingAccessError} from '@fluxer/errors/src/domains/core/MissingAccessError';
import {MissingPermissionsError} from '@fluxer/errors/src/domains/core/MissingPermissionsError';
import {ModuleSettingsUpdateRequest} from '@fluxer/schema/src/domains/guild/GuildModuleSettingsSchemas';

export class ModuleSettingsService {
	constructor(
		private readonly guilds: IGuildRepositoryAggregate,
		private readonly repository = new ModuleSettingsRepository(),
	) {}
	async authorize(guildId: GuildID, userId: UserID) {
		if (!eventLogSupported()) throw new MissingAccessError();
		const [guild, member] = await Promise.all([
			this.guilds.findUnique(guildId),
			this.guilds.getMember(guildId, userId),
		]);
		if (!guild || !member) throw new MissingAccessError();
		if (guild.ownerId !== userId) throw new MissingPermissionsError();
	}
	async read(guildId: GuildID, userId: UserID) {
		await this.authorize(guildId, userId);
		return this.repository.read(guildId);
	}
	async save(guildId: GuildID, userId: UserID, request: ModuleSettingsUpdateRequest) {
		await this.authorize(guildId, userId);
		const {revision, ...settings} = ModuleSettingsUpdateRequest.parse(request);
		await this.authorize(guildId, userId);
		await this.repository.save(guildId, userId, settings, revision);
		return this.read(guildId, userId);
	}
}
