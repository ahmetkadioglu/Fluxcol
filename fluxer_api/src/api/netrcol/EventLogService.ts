// SPDX-License-Identifier: AGPL-3.0-or-later

import type {GuildID, UserID} from '@app/api/BrandedTypes';
import {createChannelID} from '@app/api/BrandedTypes';
import type {IChannelRepository} from '@app/api/channel/IChannelRepository';
import type {IGuildRepositoryAggregate} from '@app/api/guild/repositories/IGuildRepositoryAggregate';
import type {ISnowflakeService} from '@app/api/infrastructure/ISnowflakeService';
import {EventLogRepository, eventLogStopped, eventLogSupported} from '@app/api/netrcol/EventLogRepository';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import {eventLogAvailable, eventLogChannel} from '@fluxer/constants/src/EventLogConstants';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import {MissingAccessError} from '@fluxer/errors/src/domains/core/MissingAccessError';
import {MissingPermissionsError} from '@fluxer/errors/src/domains/core/MissingPermissionsError';
import {ServiceUnavailableError} from '@fluxer/errors/src/domains/core/ServiceUnavailableError';
import type {
	EventLogEvent,
	EventLogSettingsResponse,
	EventLogUpdateRequest,
} from '@fluxer/schema/src/domains/guild/GuildEventLogSchemas';

export const EVENT_LOG_LANGUAGES = new Set([
	'ar',
	'bg',
	'cs',
	'da',
	'de',
	'el',
	'en-US',
	'en-GB',
	'es-ES',
	'es-419',
	'fi',
	'fr',
	'he',
	'hi',
	'hr',
	'hu',
	'id',
	'it',
	'ja',
	'ko',
	'lt',
	'nl',
	'no',
	'pl',
	'pt-BR',
	'ro',
	'ru',
	'sv-SE',
	'th',
	'tr',
	'uk',
	'vi',
	'zh-CN',
	'zh-TW',
]);

export class EventLogService {
	constructor(
		private readonly guilds: IGuildRepositoryAggregate,
		private readonly channels: IChannelRepository,
		private readonly repository = new EventLogRepository(),
	) {}

	async authorize(guildId: GuildID, userId: UserID): Promise<void> {
		if (!eventLogSupported()) throw new MissingAccessError();
		const [guild, member] = await Promise.all([
			this.guilds.findUnique(guildId),
			this.guilds.getMember(guildId, userId),
		]);
		if (!guild || !member) throw new MissingAccessError();
		if (guild.ownerId !== userId) throw new MissingPermissionsError();
	}

	async read(guildId: GuildID, userId: UserID): Promise<EventLogSettingsResponse> {
		await this.authorize(guildId, userId);
		const [config, allChannels] = await Promise.all([
			this.repository.getConfig(guildId),
			this.channels.listGuildChannels(guildId),
		]);
		const channels = allChannels
			.filter(
				(channel) => channel.guildId === guildId && channel.type === ChannelTypes.GUILD_TEXT && !channel.isSoftDeleted,
			)
			.sort((a, b) => a.position - b.position)
			.map((channel) => ({id: channel.id.toString(), name: channel.name ?? channel.id.toString()}));
		const status = eventLogStopped()
			? 'stopped'
			: !config.settings.enabled
				? 'disabled'
				: config.approved_by !== userId.toString()
					? 'owner_changed'
					: config.settings.events.some(
								(event) => !channels.some((channel) => channel.id === eventLogChannel(config.settings, event)),
							)
						? 'channel_missing'
						: 'enabled';
		return {settings: config.settings, revision: config.revision, status, channels};
	}

	async save(guildId: GuildID, userId: UserID, data: EventLogUpdateRequest): Promise<EventLogSettingsResponse> {
		await this.authorize(guildId, userId);
		if (!EVENT_LOG_LANGUAGES.has(data.language))
			throw new InputValidationError([{path: 'language', message: 'Choose a supported language.'}]);
		if (data.events.some((event) => !eventLogAvailable(event)))
			throw new InputValidationError([{path: 'events', message: 'Fluxer does not produce this event yet.'}]);
		if (data.enabled && (data.events.length === 0 || data.events.some((event) => !eventLogChannel(data, event))))
			throw new InputValidationError([{path: 'channel_id', message: 'Choose a text channel and at least one event.'}]);
		for (const channelId of new Set(
			[
				data.channel_id,
				...Object.values(data.category_channels ?? {}),
				...Object.values(data.event_channels ?? {}),
			].filter((id): id is string => !!id),
		)) {
			const channel = await this.channels.findUnique(createChannelID(BigInt(channelId)));
			if (!channel || channel.guildId !== guildId || channel.type !== ChannelTypes.GUILD_TEXT || channel.isSoftDeleted)
				throw new InputValidationError([{path: 'channel_id', message: 'Choose a text channel in this community.'}]);
		}
		const {revision, ...settings} = data;
		await this.authorize(guildId, userId);
		await this.repository.saveConfig(guildId, userId, settings, revision);
		return this.read(guildId, userId);
	}

	async history(guildId: GuildID, userId: UserID) {
		await this.authorize(guildId, userId);
		return {entries: await this.repository.history(guildId)};
	}

	async test(guildId: GuildID, userId: UserID, snowflake: ISnowflakeService, event?: EventLogEvent): Promise<void> {
		const state = await this.read(guildId, userId);
		if (state.status !== 'enabled')
			throw new ServiceUnavailableError({
				code: APIErrorCodes.SERVICE_UNAVAILABLE,
				message: 'Enable event logs and save a valid channel before sending a test.',
			});
		if (event && (!eventLogAvailable(event) || !state.settings.events.includes(event)))
			throw new InputValidationError([{path: 'event_type', message: 'Choose an enabled event.'}]);
		await this.repository.enqueueTest(guildId, userId, snowflake, event ?? state.settings.events[0]);
	}
}
