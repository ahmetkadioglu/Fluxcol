// SPDX-License-Identifier: AGPL-3.0-or-later

import {randomUUID} from 'node:crypto';
import type {GuildID, UserID} from '@app/api/BrandedTypes';
import {executeConditional, fetchOne} from '@app/api/database/CassandraQueryExecution';
import {Db} from '@app/api/database/CassandraTypes';
import {type GuildRecord, ApplicationSettingsRecords as Records} from '@app/api/netrcol/ApplicationSettingsRecords';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {ConflictError} from '@fluxer/errors/src/domains/core/ConflictError';
import type {EventLogHistoryEntry} from '@fluxer/schema/src/domains/guild/GuildEventLogSchemas';
import {ModuleSettings, type ModuleSettingsResponse} from '@fluxer/schema/src/domains/guild/GuildModuleSettingsSchemas';

export class ModuleSettingsRepository {
	private record(guildId: GuildID, key: string) {
		return fetchOne<GuildRecord>(
			Records.select({where: [Records.where.eq('guild_id'), Records.where.eq('key')]}).bind({guild_id: guildId, key}),
		);
	}
	async override(guildId: GuildID): Promise<ModuleSettings['message_language'] | null> {
		const row = await this.record(guildId, 'module-settings');
		return row ? ModuleSettings.parse(JSON.parse(row.value)).message_language : null;
	}
	async read(guildId: GuildID): Promise<ModuleSettingsResponse> {
		const row = await this.record(guildId, 'module-settings');
		if (row) return {settings: ModuleSettings.parse(JSON.parse(row.value)), revision: row.version};
		const legacy = await this.record(guildId, 'config');
		const language = legacy ? JSON.parse(legacy.value).settings?.language : 'en-US';
		const settings = ModuleSettings.safeParse({message_language: language});
		return {settings: settings.success ? settings.data : {message_language: 'en-US'}, revision: 0};
	}
	async save(guildId: GuildID, actorId: UserID, settings: ModuleSettings, revision: number) {
		const id = `${Date.now().toString().padStart(16, '0')}:${randomUUID()}`;
		const history: EventLogHistoryEntry = {
			id,
			kind: 'module_settings_updated',
			status: 'saved',
			actor_id: String(actorId),
			subject_id: null,
			channel_id: null,
			message_id: null,
			revision: revision + 1,
			created_at: Date.now(),
			reason: 'none',
		};
		const row = {guild_id: guildId, key: 'module-settings', value: JSON.stringify(settings), version: revision + 1};
		const applied = await executeConditional(
			Records.conditionalBatch([
				revision === 0
					? {action: 'insert', row}
					: {
							action: 'patch',
							pk: {guild_id: guildId, key: row.key},
							patch: {value: Db.set(row.value), version: Db.set(row.version)},
							expected: {version: revision},
						},
				{
					action: 'insert',
					row: {guild_id: guildId, key: `audit:${id}`, value: JSON.stringify(history), version: 1},
					ttlSeconds: 90 * 86400,
				},
			]),
		);
		if (!applied)
			throw new ConflictError({
				code: APIErrorCodes.CONFLICT,
				message: 'Module settings changed. Reload before saving.',
			});
	}
}
