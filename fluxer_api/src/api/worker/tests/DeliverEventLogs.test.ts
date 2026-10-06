// SPDX-License-Identifier: AGPL-3.0-or-later

import {Config} from '@app/api/Config';
import {EventLogDeliveryService} from '@app/api/netrcol/EventLogDeliveryService';
import {type EventLogDelivery, EventLogRepository} from '@app/api/netrcol/EventLogRepository';
import {NoopLogger} from '@app/api/test/mocks/NoopLogger';
import deliverEventLogs from '@app/api/worker/tasks/DeliverEventLogs';
import {clearWorkerDependencies, setWorkerDependenciesForTest} from '@app/api/worker/WorkerContext';
import type {WorkerTaskHelpers} from '@pkgs/worker/src/contracts/WorkerTask';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const baseline = {selfHosted: Config.instance.selfHosted, backend: Config.database.backend};
const candidate = {event_id: 10n, guild_id: 100n, attempts: 0} as EventLogDelivery;
const helpers: WorkerTaskHelpers = {
	logger: new NoopLogger(),
	jobId: 1n,
	addJob: async () => 1n,
	reportProgress: async () => {},
	shouldCancel: async () => false,
	setContextLink: async () => {},
};

beforeEach(() => {
	Config.instance.selfHosted = true;
	Config.database.backend = 'postgres';
	setWorkerDependenciesForTest({});
	vi.spyOn(EventLogRepository.prototype, 'listPending').mockResolvedValue([]);
	vi.spyOn(EventLogRepository.prototype, 'findByIds').mockResolvedValue([candidate]);
	vi.spyOn(EventLogRepository.prototype, 'claim').mockImplementation(async (row) => ({...row, attempts: 1}));
	vi.spyOn(EventLogRepository.prototype, 'finish').mockResolvedValue();
	vi.spyOn(EventLogRepository.prototype, 'retry').mockResolvedValue();
	vi.spyOn(EventLogDeliveryService.prototype, 'deliver').mockResolvedValue();
});
afterEach(() => {
	vi.restoreAllMocks();
	clearWorkerDependencies();
	Config.instance.selfHosted = baseline.selfHosted;
	Config.database.backend = baseline.backend;
});

describe('immediate and recovery event-log delivery', () => {
	it('targets committed IDs directly without traversing an older backlog', async () => {
		expect(await deliverEventLogs({event_ids: ['10', '10', '11']}, helpers)).toEqual({processed: 1});
		expect(EventLogRepository.prototype.findByIds).toHaveBeenCalledWith([10n, 11n]);
		expect(EventLogRepository.prototype.listPending).not.toHaveBeenCalled();
		expect(EventLogDeliveryService.prototype.deliver).toHaveBeenCalledOnce();
	});

	it('keeps empty cron payloads as the periodic recovery sweep', async () => {
		vi.mocked(EventLogRepository.prototype.listPending).mockResolvedValueOnce([candidate]);
		expect(await deliverEventLogs({}, helpers)).toEqual({processed: 1});
		expect(EventLogRepository.prototype.findByIds).not.toHaveBeenCalled();
		expect(EventLogRepository.prototype.listPending).toHaveBeenCalled();
	});

	it('ignores a duplicate notification for an already removed outbox row', async () => {
		vi.mocked(EventLogRepository.prototype.findByIds).mockResolvedValue([]);
		expect(await deliverEventLogs({event_ids: ['10']}, helpers)).toEqual({processed: 0});
		expect(EventLogDeliveryService.prototype.deliver).not.toHaveBeenCalled();
	});

	it('respects an active lease and retry backoff', async () => {
		vi.mocked(EventLogRepository.prototype.claim).mockResolvedValue(null);
		expect(await deliverEventLogs({event_ids: ['10']}, helpers)).toEqual({processed: 0});
		expect(EventLogDeliveryService.prototype.deliver).not.toHaveBeenCalled();
	});

	it('retains normal retry handling for an immediate delivery failure', async () => {
		vi.mocked(EventLogDeliveryService.prototype.deliver).mockRejectedValue(new Error('gateway unavailable'));
		expect(await deliverEventLogs({event_ids: ['10']}, helpers)).toEqual({processed: 1});
		expect(EventLogRepository.prototype.retry).toHaveBeenCalledOnce();
		expect(EventLogRepository.prototype.finish).not.toHaveBeenCalled();
	});

	it('honours cancellation before acquiring the delivery lease', async () => {
		expect(await deliverEventLogs({event_ids: ['10']}, {...helpers, shouldCancel: async () => true})).toEqual({
			processed: 0,
		});
		expect(EventLogRepository.prototype.claim).not.toHaveBeenCalled();
	});

	it.each([{event_ids: ['not-an-id']}, {event_ids: Array(201).fill('10')}, {event_ids: ['-1']}])(
		'rejects malformed or unbounded immediate delivery jobs: %j',
		async (payload) => {
			await expect(deliverEventLogs(payload, helpers)).rejects.toThrow();
			expect(EventLogRepository.prototype.findByIds).not.toHaveBeenCalled();
		},
	);
});
