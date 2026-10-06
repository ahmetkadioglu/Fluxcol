// SPDX-License-Identifier: AGPL-3.0-or-later

import {EventLogDeliveryService} from '@app/api/netrcol/EventLogDeliveryService';
import {EventLogRepository, eventLogSupported} from '@app/api/netrcol/EventLogRepository';
import {EVENT_LOG_WAKE_BATCH_SIZE} from '@app/api/netrcol/EventLogWakeup';
import {getWorkerDependencies} from '@app/api/worker/WorkerContext';
import type {WorkerTaskHelpers} from '@pkgs/worker/src/contracts/WorkerTask';
import {z} from 'zod';

const deliveryRequest = z.object({
	event_ids: z
		.array(z.string().regex(/^\d{1,20}$/))
		.max(EVENT_LOG_WAKE_BATCH_SIZE)
		.optional(),
});

let sweepCursor: bigint | undefined;

export default async function deliverEventLogs(payload: unknown, helpers: WorkerTaskHelpers) {
	if (!eventLogSupported()) return {processed: 0};
	const request = deliveryRequest.parse(payload ?? {});
	const repository = new EventLogRepository();
	const service = new EventLogDeliveryService(getWorkerDependencies(), repository);
	let processed = 0;
	const deliverCandidate = async (candidate: Parameters<EventLogRepository['claim']>[0]) => {
		const delivery = await repository.claim(candidate);
		if (!delivery) return;
		try {
			await service.deliver(delivery);
		} catch (error) {
			helpers.logger.warn(
				{eventId: delivery.event_id.toString(), guildId: delivery.guild_id.toString(), error},
				'Event log delivery failed',
			);
			if (delivery.attempts >= 6) await repository.finish(delivery, 'failed', 'delivery_failed');
			else await repository.retry(delivery);
		}
		processed++;
	};
	if (request.event_ids) {
		// Target new commits directly, even while the recovery cursor is scanning an older backlog.
		const pending = await repository.findByIds([...new Set(request.event_ids)].map((id) => BigInt(id)));
		for (const candidate of pending) {
			if (await helpers.shouldCancel()) break;
			await deliverCandidate(candidate);
		}
		return {processed};
	}
	let after = sweepCursor;
	// Bound each sweep; delayed retries at the head do not starve later events.
	for (let page = 0; page < 4; page++) {
		const pending = await repository.listPending(after);
		if (!pending.length) {
			after = undefined;
			break;
		}
		for (const candidate of pending) {
			if (await helpers.shouldCancel()) return {processed};
			after = candidate.event_id;
			await deliverCandidate(candidate);
		}
		if (pending.length < 50) {
			after = undefined;
			break;
		}
	}
	sweepCursor = after;
	return {processed};
}
