// SPDX-License-Identifier: AGPL-3.0-or-later
import {createGuildID, createRoleID, createUserID} from '@app/api/BrandedTypes';
import {createRequestCache} from '@app/api/middleware/RequestCacheMiddleware';
import {automaticRoleEligible} from '@app/api/netrcol/AutomaticRolePolicy';
import {type AutomaticRoleJob, AutomaticRoleRepository} from '@app/api/netrcol/AutomaticRoleRepository';
import {eventLogContext} from '@app/api/netrcol/EventLogContext';
import {eventLogStopped} from '@app/api/netrcol/EventLogRepository';
import type {WorkerDependencies} from '@app/api/worker/WorkerDependencies';

export class AutomaticRoleProcessor {
	constructor(
		private readonly deps: Pick<WorkerDependencies, 'guildRepository' | 'userRepository' | 'guildService'>,
		private readonly repository = new AutomaticRoleRepository(),
	) {}
	async process(row: Parameters<AutomaticRoleRepository['claim']>[0], job: AutomaticRoleJob) {
		const guildId = createGuildID(BigInt(job.guild_id)),
			userId = createUserID(BigInt(job.user_id));
		const finish = (
			status: NonNullable<AutomaticRoleJob['result']>,
			reason: NonNullable<AutomaticRoleJob['outcome']> = 'none',
		) => this.repository.finish(guildId, row, job, status, reason);
		if (job.status === 'done') return finish(job.result ?? 'skipped', job.outcome);
		const check = async () => {
			if (eventLogStopped()) return 'stopped' as const;
			const [config, guild, member] = await Promise.all([
				this.repository.config(guildId),
				this.deps.guildRepository.findUnique(guildId),
				this.deps.guildRepository.getMember(guildId, userId),
			]);
			if (
				!guild ||
				!config.settings.enabled ||
				config.revision !== job.revision ||
				config.approved_by !== job.approved_by ||
				String(guild.ownerId) !== job.approved_by
			)
				return 'policy_changed' as const;
			if (!member || member.joinedAt.getTime() !== job.joined_at) return 'member_left' as const;
			return null;
		};
		const reason = await check();
		if (reason) return finish('skipped', reason);
		if (!(await this.repository.ownsLease(row, job))) return;
		const [config, user] = await Promise.all([
			this.repository.config(guildId),
			this.deps.userRepository.findUnique(userId),
		]);
		if (!user || user.isSystem) return finish('skipped', 'no_roles');
		const ids = user.isBot ? config.settings.bot_role_ids : config.settings.member_role_ids;
		if (!ids.length) return finish('skipped', 'no_roles');
		job.role_ids = ids;
		let unavailable = false;
		for (const id of ids) {
			if (job.completed_roles.includes(id)) continue;
			const currentReason = await check();
			if (currentReason) return finish('skipped', currentReason);
			if (!(await this.repository.ownsLease(row, job))) return;
			const roleId = createRoleID(BigInt(id));
			const role = await this.deps.guildRepository.getRole(roleId, guildId);
			if (!role || !automaticRoleEligible(role, guildId)) {
				unavailable = true;
				continue;
			}
			try {
				await eventLogContext.run({actor_id: '0', reason: 'Automatic roles', request_id: job.id}, () =>
					this.deps.guildService.members.systemAddMemberRole({
						guildId,
						targetId: userId,
						roleId,
						initiatorId: createUserID(0n),
						requestCache: createRequestCache(),
						expectedJoinedAt: job.joined_at,
					}),
				);
			} catch (err) {
				const changed = await check();
				if (changed) return finish('skipped', changed);
				const refreshed = await this.deps.guildRepository.getRole(roleId, guildId);
				if (!refreshed || !automaticRoleEligible(refreshed, guildId)) {
					unavailable = true;
					continue;
				}
				throw err;
			}
			job.completed_roles.push(id);
			if (!(await this.repository.update(row, job))) return;
		}
		return finish(unavailable ? 'skipped' : 'assigned', unavailable ? 'role_unavailable' : 'none');
	}
}
