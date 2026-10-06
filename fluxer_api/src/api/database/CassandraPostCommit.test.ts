// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	BatchBuilder,
	executeConditional,
	executeQuery,
	setCassandraQueryExecutorForTesting,
} from '@app/api/database/CassandraQueryExecution';
import {defineTable} from '@app/api/database/CassandraTableDsl';
import {Db} from '@app/api/database/CassandraTypes';
import {InMemoryCassandraQueryExecutor} from '@app/api/test/InMemoryCassandraQueryExecutor';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const table = defineTable<{id: bigint; value: string}, 'id'>({
	name: 'post_commit_test',
	columns: ['id', 'value'],
	primaryKey: ['id'],
});
let executor: InMemoryCassandraQueryExecutor;

beforeEach(() => {
	executor = new InMemoryCassandraQueryExecutor();
	setCassandraQueryExecutorForTesting(executor);
});
afterEach(() => setCassandraQueryExecutorForTesting(null));

describe('database post-commit notifications', () => {
	it('runs only after the containing batch has finished', async () => {
		let commit: (() => void) | undefined;
		vi.spyOn(executor, 'executeBatch').mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					commit = resolve;
				}),
		);
		const afterCommit = vi.fn();
		const write = new BatchBuilder().addPrepared({...table.insert({id: 1n, value: 'a'}), afterCommit}).execute();
		expect(afterCommit).not.toHaveBeenCalled();
		commit!();
		await write;
		expect(afterCommit).toHaveBeenCalledOnce();
	});

	it('does not notify when the database rolls the batch back', async () => {
		vi.spyOn(executor, 'executeBatch').mockRejectedValueOnce(new Error('transaction aborted'));
		const afterCommit = vi.fn();
		await expect(
			new BatchBuilder().addPrepared({...table.insert({id: 1n, value: 'a'}), afterCommit}).execute(),
		).rejects.toThrow('aborted');
		expect(afterCommit).not.toHaveBeenCalled();
	});

	it('contains a notification error and still notifies other committed writes', async () => {
		const success = vi.fn();
		await expect(
			new BatchBuilder()
				.addPrepared({
					...table.insert({id: 1n, value: 'a'}),
					afterCommit: () => {
						throw new Error('notification failed');
					},
				})
				.addPrepared({...table.insert({id: 2n, value: 'b'}), afterCommit: success})
				.execute(),
		).resolves.toBeUndefined();
		expect(success).toHaveBeenCalledOnce();
		expect(await executeQuery(table.select().bind({}))).toHaveLength(2);
	});

	it('notifies a standalone committed write, but not a rejected conditional write', async () => {
		const afterCommit = vi.fn();
		await executeQuery({...table.insert({id: 1n, value: 'a'}), afterCommit});
		expect(afterCommit).toHaveBeenCalledOnce();
		afterCommit.mockClear();
		expect(
			await executeConditional({
				...table.conditionalPatchByPk({id: 1n}, {value: Db.set('b')}, {value: 'wrong'}),
				afterCommit,
			}),
		).toBe(false);
		expect(afterCommit).not.toHaveBeenCalled();
		expect(
			await executeConditional({
				...table.conditionalPatchByPk({id: 1n}, {value: Db.set('b')}, {value: 'a'}),
				afterCommit,
			}),
		).toBe(true);
		expect(afterCommit).toHaveBeenCalledOnce();
	});

	it('preserves hooks through optional and chunked prepared writes', async () => {
		const afterCommit = vi.fn();
		const batch = new BatchBuilder()
			.addPreparedIf(false, {...table.insert({id: 1n, value: 'a'}), afterCommit})
			.addPreparedIf(true, {...table.insert({id: 2n, value: 'b'}), afterCommit})
			.addPrepared({...table.insert({id: 3n, value: 'c'}), afterCommit});
		await batch.executeChunked(1);
		expect(afterCommit).toHaveBeenCalledTimes(2);
	});
});
