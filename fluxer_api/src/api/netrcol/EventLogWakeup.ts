// SPDX-License-Identifier: AGPL-3.0-or-later

import {Config} from '@app/api/Config';
import {Logger} from '@app/api/Logger';
import {getWorkerService} from '@app/api/middleware/ServiceRegistry';
import type {IWorkerService} from '@pkgs/worker/src/contracts/IWorkerService';

export const EVENT_LOG_WAKE_BATCH_SIZE = 200;

/** The outbox stays authoritative; JetStream only wakes the existing delivery worker. */
export class EventLogWakeup {
	private readonly pending = new Set<string>();
	private publishing: Promise<void> | null = null;

	constructor(
		private readonly worker: () => Pick<IWorkerService<'deliverEventLogs'>, 'addJob'>,
		private readonly enabled: () => boolean,
		private readonly onFailure: (error: unknown) => void,
	) {}

	notify(eventId: bigint): void {
		if (!this.enabled()) return;
		this.pending.add(eventId.toString());
		this.start();
	}

	async drain(): Promise<void> {
		while (this.publishing) await this.publishing;
	}

	private start(): void {
		if (this.publishing || !this.pending.size) return;
		// Coalesce commits in the same turn without introducing a timer or a polling delay.
		this.publishing = Promise.resolve()
			.then(() => this.publish())
			.finally(() => {
				this.publishing = null;
				this.start();
			});
	}

	private async publish(): Promise<void> {
		while (this.pending.size) {
			const eventIds: Array<string> = [];
			for (const eventId of this.pending) {
				eventIds.push(eventId);
				if (eventIds.length === EVENT_LOG_WAKE_BATCH_SIZE) break;
			}
			for (const eventId of eventIds) this.pending.delete(eventId);
			if (!this.enabled()) {
				this.pending.clear();
				return;
			}
			try {
				await this.worker().addJob('deliverEventLogs', {event_ids: eventIds}, {skipLedger: true});
			} catch (error) {
				// No retry loop here: the five-second recovery sweep will find the durable records.
				this.pending.clear();
				this.onFailure(error);
				return;
			}
		}
	}
}

export const eventLogWakeup = new EventLogWakeup(
	() => getWorkerService(),
	() =>
		Config.instance.selfHosted &&
		Config.database.backend === 'postgres' &&
		process.env.NETRCOL_AUTOMATIONS_ENABLED !== 'false',
	(error) => Logger.warn({err: error}, 'Event log wake-up failed; recovery sweep will deliver pending records'),
);
