// SPDX-License-Identifier: AGPL-3.0-or-later

import {createChannelID, createGuildID, createMessageID, createUserID} from '@app/api/BrandedTypes';
import {SYSTEM_USER_ID} from '@app/api/constants/Core';
import {createRequestCache} from '@app/api/middleware/RequestCacheMiddleware';
import type {Message} from '@app/api/models/Message';
import {
	autoModEffectiveAction,
	autoModFingerprint,
	autoModRuleApplies,
	evaluateAutoMod,
} from '@app/api/netrcol/AutoModEngine';
import {type AutoModJob, AutoModRepository} from '@app/api/netrcol/AutoModRepository';
import {eventLogContext} from '@app/api/netrcol/EventLogContext';
import {eventLogStopped} from '@app/api/netrcol/EventLogRepository';
import type {WorkerDependencies} from '@app/api/worker/WorkerDependencies';
import {AUTO_MOD_RULE_IDS} from '@fluxer/constants/src/AutoModConstants';
import {AUTO_MOD_TRANSLATIONS} from '@fluxer/constants/src/AutoModTranslations';
import {ChannelTypes, MessageTypes} from '@fluxer/constants/src/ChannelConstants';
import {EVENT_LOG_TRANSLATIONS} from '@fluxer/constants/src/EventLogTranslations';

function matchesMessage(message: Message, job: AutoModJob) {
	return (
		message.authorId?.toString() === job.user_id &&
		(message.content ?? '') === job.content &&
		message.attachments.length + message.stickers.length === job.media &&
		(job.edited ? message.editedTimestamp?.getTime() === job.occurred_at : !message.editedTimestamp)
	);
}

export class AutoModProcessor {
	constructor(
		private readonly deps: Pick<
			WorkerDependencies,
			| 'guildRepository'
			| 'channelRepository'
			| 'userRepository'
			| 'guildService'
			| 'channelService'
			| 'snowflakeService'
		>,
		private readonly repository = new AutoModRepository(),
	) {}
	async process(row: Awaited<ReturnType<AutoModRepository['pending']>>[number], job: AutoModJob) {
		const guildId = createGuildID(BigInt(job.guild_id));
		if (job.status === 'done') {
			await this.repository.finish(guildId, row, job, job.outcome ?? 'failed');
			return;
		}
		const userId = createUserID(BigInt(job.user_id));
		const [config, guild, user, member, sourceChannel] = await Promise.all([
			this.repository.config(guildId),
			this.deps.guildRepository.findUnique(guildId),
			this.deps.userRepository.findUnique(userId),
			this.deps.guildRepository.getMember(guildId, userId),
			job.channel_id ? this.deps.channelRepository.findUnique(createChannelID(BigInt(job.channel_id))) : null,
		]);
		const settings = config.settings;
		if (
			eventLogStopped() ||
			!guild ||
			!settings.enabled ||
			config.revision !== job.revision ||
			guild.ownerId.toString() !== job.approved_by ||
			config.approved_by !== job.approved_by ||
			!user ||
			!member ||
			user.isSystem ||
			guild.ownerId === userId ||
			(settings.ignore_bots && user.isBot) ||
			(job.channel_id && (!sourceChannel || sourceChannel.guildId !== guildId || sourceChannel.isSoftDeleted))
		) {
			await this.repository.finish(guildId, row, job, 'skipped');
			return;
		}
		const scope = {
			user_id: job.user_id,
			role_ids: [...member.roleIds].map(String),
			channel_id: job.channel_id,
			category_id: sourceChannel?.parentId?.toString() ?? null,
		};
		const eligible = AUTO_MOD_RULE_IDS.filter(
			(id) => settings.rules[id].action !== 'disabled' && autoModRuleApplies(settings, id, scope),
		);
		if (!eligible.length || job.rules?.some((id) => !eligible.includes(id))) {
			await this.repository.finish(guildId, row, job, 'skipped');
			return;
		}
		if (Date.now() - job.occurred_at > 300000) {
			await this.repository.finish(guildId, row, job, 'skipped');
			return;
		}
		if (job.kind === 'message' && job.channel_id && job.message_id) {
			const current = await this.deps.channelRepository.messages.getMessage(
				createChannelID(BigInt(job.channel_id)),
				createMessageID(BigInt(job.message_id)),
			);
			if ((!current && !job.rules) || (current && !matchesMessage(current, job))) {
				await this.repository.finish(guildId, row, job, 'skipped');
				return;
			}
		}
		if (!job.rules) {
			const samples = await this.repository.sample(
				guildId,
				`window:${job.revision}:${job.kind}:${job.kind === 'join' ? 'guild' : job.user_id}`,
				{
					id: job.id,
					at: job.occurred_at,
					text: autoModFingerprint(job.content),
					media: job.media,
					edited: job.edited,
					rules: eligible,
					user_id: job.user_id,
				},
			);
			job.rules = evaluateAutoMod(settings, job, samples).filter((id) => eligible.includes(id));
			job.actions = job.rules.map((id) => autoModEffectiveAction(settings, id));
			if (!(await this.repository.update(row, job))) return;
		}
		if (!job.rules.length) {
			await this.repository.finish(guildId, row, job, 'passed');
			return;
		}
		const reason = `AutoMod: ${job.rules.join(', ')}`;
		const actions = job.rules.map((id) => autoModEffectiveAction(settings, id));
		if (!(await this.repository.ownsLease(row, job))) return;
		const fresh = await this.repository.config(guildId);
		const freshGuild = await this.deps.guildRepository.findUnique(guildId);
		if (
			eventLogStopped() ||
			!fresh.settings.enabled ||
			fresh.revision !== job.revision ||
			freshGuild?.ownerId.toString() !== job.approved_by
		) {
			await this.repository.finish(guildId, row, job, 'skipped');
			return;
		}
		const requestCache = createRequestCache();
		let stopped = false,
			leaseLost = false;
		const mayContinue = async () => {
			if (!(await this.repository.ownsLease(row, job))) {
				leaseLost = true;
				return false;
			}
			const [policy, currentGuild, currentMember, currentChannel] = await Promise.all([
				this.repository.config(guildId),
				this.deps.guildRepository.findUnique(guildId),
				this.deps.guildRepository.getMember(guildId, userId),
				job.channel_id ? this.deps.channelRepository.findUnique(createChannelID(BigInt(job.channel_id))) : null,
			]);
			stopped =
				eventLogStopped() ||
				!policy.settings.enabled ||
				policy.revision !== job.revision ||
				policy.approved_by !== job.approved_by ||
				currentGuild?.ownerId.toString() !== job.approved_by ||
				!currentMember ||
				(job.channel_id !== null &&
					(!currentChannel || currentChannel.guildId !== guildId || currentChannel.isSoftDeleted)) ||
				job.rules!.some(
					(id) =>
						!autoModRuleApplies(policy.settings, id, {
							...scope,
							role_ids: [...(currentMember?.roleIds ?? [])].map(String),
							category_id: currentChannel?.parentId?.toString() ?? null,
						}),
				);
			return !stopped;
		};
		try {
			await eventLogContext.run({suppress: true, actor_id: '0', reason}, async () => {
				if (actions.includes('lockdown')) {
					if (!(await mayContinue())) return;
					await this.repository.hold(
						guildId,
						job.kind === 'join' ? 'raid_hold' : `nuke_hold:${job.user_id}`,
						job.occurred_at + settings.duration_seconds * 1000,
						config,
					);
				}
				if (actions.includes('timeout') || actions.includes('delete_timeout')) {
					if (!(await mayContinue())) return;
					const until = job.occurred_at + settings.duration_seconds * 1000;
					if ((member.communicationDisabledUntil?.getTime() ?? 0) < until && until > Date.now())
						await this.deps.guildService.members.updateMember(
							{
								guildId,
								userId: guild.ownerId,
								targetId: userId,
								requestCache,
								data: {communication_disabled_until: new Date(until).toISOString(), timeout_reason: reason},
							},
							reason,
						);
				}
				if (
					actions.some((action) => ['delete', 'delete_warn', 'delete_timeout'].includes(action)) &&
					job.channel_id &&
					job.message_id
				) {
					const channelId = createChannelID(BigInt(job.channel_id)),
						messageId = createMessageID(BigInt(job.message_id));
					await this.deps.channelService.messages.writeLock.withFreshMessage(channelId, messageId, async (current) => {
						if (!(await mayContinue())) return;
						if (current && matchesMessage(current, job))
							await this.deps.channelService.messages.deletion.deleteMessage({
								userId: guild.ownerId,
								channelId,
								messageId,
								requestCache,
								auditLogReason: reason,
							});
					});
				}
				const target = settings.channel_id ?? job.channel_id;
				if (target && actions.some((action) => action !== 'observe')) {
					if (stopped || leaseLost || !(await mayContinue())) return;
					const channelId = createChannelID(BigInt(target));
					const channel = await this.deps.channelRepository.findUnique(channelId);
					if (
						!channel ||
						channel.guildId !== guildId ||
						channel.isSoftDeleted ||
						channel.type !== ChannelTypes.GUILD_TEXT
					)
						throw new Error('AutoMod notification channel is missing');
					if (!job.warning_id) {
						job.warning_id = String(await this.deps.snowflakeService.generateForChannel(channelId));
						if (!(await this.repository.update(row, job))) return;
					}
					const copy = AUTO_MOD_TRANSLATIONS[user.locale ?? 'en-US'] ?? AUTO_MOD_TRANSLATIONS['en-US']!;
					const labels = EVENT_LOG_TRANSLATIONS[user.locale ?? 'en-US'] ?? EVENT_LOG_TRANSLATIONS['en-US']!;
					const messageId = createMessageID(BigInt(job.warning_id));
					await this.deps.channelService.messages.writeLock.withFreshMessage(channelId, messageId, async (existing) => {
						const message =
							existing ??
							(
								await this.deps.channelService.messages.persistence.createMessage({
									messageId,
									channelId,
									guildId,
									channel,
									userId: SYSTEM_USER_ID,
									type: MessageTypes.DEFAULT,
									flags: 0,
									content: null,
									processedEmbeds: [
										{
											type: 'rich',
											title: 'AutoMod',
											description: `${(user.globalName ?? user.username).replace(/[\\*_~`<>[\]]/gu, '\\$&')}\n${job.rules!.map((id) => copy[id]).join(' · ')}`,
											color: 0xed4245,
											url: null,
											timestamp: new Date(job.occurred_at),
											author: null,
											provider: null,
											thumbnail: null,
											image: null,
											video: null,
											footer: null,
											nsfw: false,
											fields: [
												{
													name: labels.field_status!,
													value: [...new Set(actions)].map((action) => copy[action]).join(' · '),
													inline: false,
												},
											],
										},
									],
									processedAttachments: [],
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
						await this.deps.channelService.messages.dispatch.dispatchMessageCreate({channel, message, requestCache});
					});
				}
			});
			if (leaseLost) return;
			await this.repository.finish(
				guildId,
				row,
				job,
				stopped ? 'skipped' : actions.every((action) => action === 'observe') ? 'observed' : 'applied',
			);
		} finally {
			requestCache.clear();
		}
	}
}
