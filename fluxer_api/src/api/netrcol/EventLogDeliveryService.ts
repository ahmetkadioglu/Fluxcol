// SPDX-License-Identifier: AGPL-3.0-or-later

import {createHash} from 'node:crypto';
import {createAttachmentID, createMessageID} from '@app/api/BrandedTypes';
import {Config} from '@app/api/Config';
import {makeAttachmentCdnKey} from '@app/api/channel/services/message/MessageHelpers';
import {SYSTEM_USER_ID} from '@app/api/constants/Core';
import type {MessageAttachment} from '@app/api/database/types/MessageTypes';
import {createRequestCache} from '@app/api/middleware/RequestCacheMiddleware';
import {eventLogContext} from '@app/api/netrcol/EventLogContext';
import {resolveEventLogPresentation} from '@app/api/netrcol/EventLogPresentation';
import {renderEventLog} from '@app/api/netrcol/EventLogRender';
import {type EventLogDelivery, EventLogRepository, eventLogStopped} from '@app/api/netrcol/EventLogRepository';
import type {WorkerDependencies} from '@app/api/worker/WorkerDependencies';
import {ChannelTypes, MessageTypes} from '@fluxer/constants/src/ChannelConstants';
import {eventLogChannel} from '@fluxer/constants/src/EventLogConstants';
import {EventLogPayload} from '@fluxer/schema/src/domains/guild/GuildEventLogSchemas';

export class EventLogDeliveryService {
	constructor(
		private readonly deps: Pick<
			WorkerDependencies,
			'guildRepository' | 'channelRepository' | 'userRepository' | 'channelService' | 'storageService'
		> &
			Partial<Pick<WorkerDependencies, 'webhookRepository'>>,
		private readonly repository = new EventLogRepository(),
	) {}

	async deliver(delivery: EventLogDelivery): Promise<void> {
		if (delivery.status === 'sent' || delivery.status === 'skipped' || delivery.status === 'failed') {
			await this.repository.finish(delivery, delivery.status, delivery.terminal_reason);
			return;
		}
		if (eventLogStopped()) {
			await this.repository.finish(delivery, 'skipped', 'stopped');
			return;
		}
		const [config, guild, channel] = await Promise.all([
			this.repository.getConfig(delivery.guild_id),
			this.deps.guildRepository.findUnique(delivery.guild_id),
			this.deps.channelRepository.findUnique(delivery.channel_id),
		]);
		const payload = delivery.payload ? EventLogPayload.parse(JSON.parse(delivery.payload)) : {};
		const event = delivery.kind === 'test' ? (payload.test_event ?? 'member_join') : delivery.kind;
		if (
			!guild ||
			!config.settings.enabled ||
			config.revision !== delivery.revision ||
			guild.ownerId.toString() !== delivery.approved_by ||
			config.approved_by !== delivery.approved_by ||
			eventLogChannel(config.settings, event) !== delivery.channel_id.toString() ||
			(delivery.kind !== 'test' && !config.settings.events.includes(delivery.kind))
		) {
			await this.repository.finish(delivery, 'skipped', 'policy_changed');
			return;
		}
		if (
			!channel ||
			channel.guildId !== delivery.guild_id ||
			channel.type !== ChannelTypes.GUILD_TEXT ||
			channel.isSoftDeleted
		) {
			await this.repository.finish(delivery, 'failed', 'channel_missing');
			return;
		}
		const messageId = createMessageID(delivery.event_id);
		const requestCache = createRequestCache();
		try {
			await eventLogContext.run({suppress: true}, () =>
				this.deps.channelService.messages.writeLock.withFreshMessage(channel.id, messageId, async (existing) => {
					if (!(await this.repository.ownsLease(delivery))) return;
					// The same saved message ID is used after a crash; an already persisted message is reconciled.
					const freshConfig = await this.repository.getConfig(delivery.guild_id);
					const freshGuild = await this.deps.guildRepository.findUnique(delivery.guild_id);
					if (
						eventLogStopped() ||
						!freshConfig.settings.enabled ||
						freshConfig.revision !== delivery.revision ||
						freshGuild?.ownerId.toString() !== delivery.approved_by
					) {
						await this.repository.finish(delivery, 'skipped', 'policy_changed');
						return;
					}
					const freshChannel = await this.deps.channelRepository.findUnique(delivery.channel_id);
					if (
						!freshChannel ||
						freshChannel.guildId !== delivery.guild_id ||
						freshChannel.isSoftDeleted ||
						freshChannel.type !== ChannelTypes.GUILD_TEXT
					) {
						await this.repository.finish(delivery, 'failed', 'channel_missing');
						return;
					}
					const presentation = await resolveEventLogPresentation(delivery, this.deps, freshGuild.name);
					const rendered = renderEventLog({...delivery, language: freshConfig.settings.language}, presentation);
					const processedAttachments: Array<MessageAttachment> = [];
					if (!existing && rendered.attachment) {
						const attachmentId = createAttachmentID(delivery.event_id);
						const body = Buffer.from(rendered.attachment, 'utf8');
						await this.deps.storageService.uploadObject({
							bucket: Config.s3.buckets.cdn,
							key: makeAttachmentCdnKey(channel.id, attachmentId, 'event-log.txt'),
							body,
							contentType: 'text/plain; charset=utf-8',
						});
						processedAttachments.push({
							attachment_id: attachmentId,
							filename: 'event-log.txt',
							size: BigInt(body.length),
							content_type: 'text/plain',
							content_hash: createHash('sha256').update(body).digest('hex'),
							flags: 0,
							title: null,
							description: null,
							width: null,
							height: null,
							placeholder: null,
							duration: null,
							nsfw: null,
							waveform: null,
						});
					}
					const message =
						existing ??
						(
							await this.deps.channelService.messages.persistence.createMessage({
								messageId,
								channelId: channel.id,
								guildId: delivery.guild_id,
								channel: freshChannel,
								userId: SYSTEM_USER_ID,
								type: MessageTypes.DEFAULT,
								flags: 0,
								content: rendered.content,
								processedEmbeds: rendered.embeds,
								processedAttachments,
								allowedMentions: {parse: [], users: [], roles: [], replied_user: false},
								mentionData: {
									flags: 0,
									mentionUserIds: [],
									mentionRoleIds: [],
									mentionChannelIds: [],
									mentionEveryone: false,
								},
								skipDeferredEmbeds: true,
							})
						).message;
					await this.deps.channelService.messages.dispatch.dispatchMessageCreate({
						channel: freshChannel,
						message,
						requestCache,
					});
					await this.repository.finish(delivery, 'sent');
				}),
			);
		} finally {
			requestCache.clear();
		}
	}
}
