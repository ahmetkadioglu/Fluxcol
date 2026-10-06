// SPDX-License-Identifier: AGPL-3.0-or-later
import type {GuildID} from '@app/api/BrandedTypes';
import {BatchBuilder} from '@app/api/database/CassandraQueryExecution';
import {eventLogStopped, eventLogSupported, prepareEventLog} from '@app/api/netrcol/EventLogRepository';
import type {EventLogEvent} from '@fluxer/schema/src/domains/guild/GuildEventLogSchemas';
import type {RpcRequest} from '@fluxer/schema/src/domains/rpc/RpcSchemas';

type Transition = Extract<RpcRequest, {type: 'event_log_transition'}>;
export function gatewayLogEvents(request: Transition): Array<{kind: EventLogEvent; key: string}> {
	const {before, after, family} = request;
	if (family === 'presence') {
		if (!before) return [];
		return (
			[
				['status', 'presence_status'],
				['custom_status', 'presence_custom_status'],
			] as const
		)
			.filter(([key]) => before[key] !== after[key])
			.map(([key, kind]) => ({key, kind}));
	}
	const oldChannel = before?.channel_id ?? null;
	const newChannel = after.channel_id ?? null;
	const result: Array<{kind: EventLogEvent; key: string}> = [];
	if (oldChannel !== newChannel)
		result.push({kind: !oldChannel ? 'voice_join' : !newChannel ? 'voice_leave' : 'voice_move', key: 'channel_id'});
	if (before && oldChannel && newChannel)
		for (const [key, kind] of [
			['self_mute', 'voice_self_mute'],
			['self_deaf', 'voice_self_deaf'],
			['self_video', 'voice_video'],
			['self_stream', 'voice_stream'],
			['suppress', 'voice_suppress'],
		] as const) {
			if (before[key] !== after[key]) result.push({key, kind});
		}
	return result;
}
export async function captureGatewayTransition(guildId: GuildID, request: Transition): Promise<void> {
	if (!eventLogSupported() || eventLogStopped()) return;
	const batch = new BatchBuilder();
	let count = 0;
	for (const {key, kind} of gatewayLogEvents(request)) {
		const stringify = (input: unknown) => (input == null ? null : String(input));
		for (const statement of await prepareEventLog(
			guildId,
			kind,
			`gateway:${request.source_id}`,
			{
				actor_id: request.actor_id ?? null,
				subject_id: request.user_id,
				subject_type: 'user',
				source_channel_id: stringify(request.after.channel_id ?? request.before?.channel_id),
				changes: [{key, before: stringify(request.before?.[key]), after: stringify(request.after[key])}],
			},
			request.occurred_at,
		)) {
			batch.addPrepared(statement);
			count++;
		}
	}
	if (count) await batch.execute();
}
