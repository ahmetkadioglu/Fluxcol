// SPDX-License-Identifier: AGPL-3.0-or-later

import type {GuildID} from '@app/api/BrandedTypes';
import {defineTable} from '@app/api/database/CassandraTableDsl';

export interface GuildRecord {
	guild_id: GuildID;
	key: string;
	value: string;
	version: number;
}
// Keep the existing store and keys so upgrading does not require a data migration.
export const ApplicationSettingsRecords = defineTable<GuildRecord, 'guild_id' | 'key', 'guild_id'>({
	name: 'netrcol_event_log_records',
	columns: ['guild_id', 'key', 'value', 'version'],
	primaryKey: ['guild_id', 'key'],
	partitionKey: ['guild_id'],
});
