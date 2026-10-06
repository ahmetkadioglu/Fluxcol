// SPDX-License-Identifier: AGPL-3.0-or-later

import {createGuildID} from '@app/api/BrandedTypes';
import {AutoModProcessor} from '@app/api/netrcol/AutoModProcessor';
import {AutoModRepository} from '@app/api/netrcol/AutoModRepository';
import {eventLogSupported} from '@app/api/netrcol/EventLogRepository';
import {getWorkerDependencies} from '@app/api/worker/WorkerContext';
import type {WorkerTaskHelpers} from '@pkgs/worker/src/contracts/WorkerTask';
import {z} from 'zod';

let cursor: string | undefined;
export default async function processAutoMod(payload: unknown, helpers: WorkerTaskHelpers) {
	if (!eventLogSupported()) return {processed: 0};
	const {ids} = z
		.object({
			ids: z
				.array(z.string().regex(/^[a-f0-9]{64}$/))
				.max(50)
				.optional(),
		})
		.parse(payload ?? {});
	const repository = new AutoModRepository(),
		processor = new AutoModProcessor(getWorkerDependencies(), repository);
	let processed = 0,
		after = ids ? undefined : cursor;
	for (let page = 0; page < (ids ? 1 : 4); page++) {
		const rows = await repository.pending(after, ids);
		if (!rows.length) {
			after = undefined;
			break;
		}
		for (const row of rows) {
			if (await helpers.shouldCancel()) return {processed};
			after = row.id;
			const job = await repository.claim(row);
			if (!job) continue;
			try {
				await processor.process(row, job);
			} catch (err) {
				helpers.logger.warn({err, id: job.id, guildId: job.guild_id}, 'AutoMod action failed');
				if (job.attempts >= 6) await repository.finish(createGuildID(BigInt(job.guild_id)), row, job, 'failed');
				else
					await repository.update(row, {
						...job,
						status: 'pending',
						lease_until: 0,
						next_attempt_at: Date.now() + 1000 * 2 ** job.attempts,
					});
			}
			processed++;
		}
		if (rows.length < 50) {
			after = undefined;
			break;
		}
	}
	if (!ids) cursor = after;
	return {processed};
}
