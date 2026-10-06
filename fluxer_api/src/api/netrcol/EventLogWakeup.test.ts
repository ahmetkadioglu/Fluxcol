// SPDX-License-Identifier: AGPL-3.0-or-later

import {EventLogWakeup} from '@app/api/netrcol/EventLogWakeup';
import type {WorkerJobOptions, WorkerJobPayload} from '@pkgs/worker/src/contracts/WorkerTypes';
import {describe, expect, it, vi} from 'vitest';

function harness() {
	const worker = {addJob: vi.fn(async (_task: string, _payload: WorkerJobPayload, _options?: WorkerJobOptions) => 1n)};
	let enabled = true;
	const failure = vi.fn();
	return {
		worker,
		failure,
		setEnabled: (value: boolean) => {
			enabled = value;
		},
		wakeup: new EventLogWakeup(
			() => worker,
			() => enabled,
			failure,
		),
	};
}

describe('post-commit event log wake-up', () => {
	it('coalesces same-turn commits and repeats without waiting for a clock tick', async () => {
		const {wakeup, worker} = harness();
		wakeup.notify(10n);
		wakeup.notify(11n);
		wakeup.notify(10n);
		await wakeup.drain();
		expect(worker.addJob.mock.calls).toEqual([['deliverEventLogs', {event_ids: ['10', '11']}, {skipLedger: true}]]);
	});

	it('bounds jobs while keeping every ID in a large burst', async () => {
		const {wakeup, worker} = harness();
		for (let id = 1n; id <= 601n; id++) wakeup.notify(id);
		await wakeup.drain();
		expect(worker.addJob.mock.calls.map(([, payload]) => (payload.event_ids as Array<string>).length)).toEqual([
			200, 200, 200, 1,
		]);
		expect(worker.addJob.mock.calls.flatMap(([, payload]) => payload.event_ids)).toEqual(
			Array.from({length: 601}, (_, index) => String(index + 1)),
		);
	});

	it('retains commits arriving while the first publish is in flight', async () => {
		const {wakeup, worker} = harness();
		let release: ((id: bigint) => void) | undefined;
		worker.addJob.mockImplementationOnce(
			() =>
				new Promise<bigint>((resolve) => {
					release = resolve;
				}),
		);
		wakeup.notify(10n);
		await Promise.resolve();
		expect(worker.addJob).toHaveBeenCalledTimes(1);
		wakeup.notify(11n);
		wakeup.notify(12n);
		release!(1n);
		await wakeup.drain();
		expect(worker.addJob.mock.calls.map(([, payload]) => payload.event_ids)).toEqual([['10'], ['11', '12']]);
	});

	it('uses the recovery sweep on a failed publish and can wake on the next commit', async () => {
		const {wakeup, worker, failure} = harness();
		const error = new Error('broker unavailable');
		worker.addJob.mockRejectedValueOnce(error);
		for (let id = 1n; id <= 300n; id++) wakeup.notify(id);
		await expect(wakeup.drain()).resolves.toBeUndefined();
		expect(worker.addJob).toHaveBeenCalledTimes(1);
		expect(failure).toHaveBeenCalledWith(error);
		wakeup.notify(301n);
		await wakeup.drain();
		expect(worker.addJob.mock.calls[1]?.[1]).toEqual({event_ids: ['301']});
	});

	it('does not publish while the operator stop switch is active', async () => {
		const {wakeup, worker, setEnabled} = harness();
		setEnabled(false);
		wakeup.notify(10n);
		await wakeup.drain();
		expect(worker.addJob).not.toHaveBeenCalled();
	});

	it('rechecks the stop switch before sending an already scheduled wake-up', async () => {
		const {wakeup, worker, setEnabled} = harness();
		wakeup.notify(10n);
		setEnabled(false);
		await wakeup.drain();
		expect(worker.addJob).not.toHaveBeenCalled();
	});

	it('contains an uninitialised publisher failure after the commit', async () => {
		const failure = vi.fn();
		const wakeup = new EventLogWakeup(
			() => {
				throw new Error('not ready');
			},
			() => true,
			failure,
		);
		wakeup.notify(10n);
		await expect(wakeup.drain()).resolves.toBeUndefined();
		expect(failure).toHaveBeenCalledTimes(1);
	});
});
