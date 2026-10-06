// SPDX-License-Identifier: AGPL-3.0-or-later
import {AsyncLocalStorage} from 'node:async_hooks';
export const eventLogContext = new AsyncLocalStorage<{
	actor_id?: string;
	reason?: string;
	request_id?: string;
	suppress?: boolean;
	invite?: {code: string; inviter_id?: string};
}>();
