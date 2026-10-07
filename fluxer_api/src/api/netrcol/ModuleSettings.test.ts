// SPDX-License-Identifier: AGPL-3.0-or-later

import {createGuildID, createUserID} from '@app/api/BrandedTypes';
import {Config} from '@app/api/Config';
import {setCassandraQueryExecutorForTesting} from '@app/api/database/CassandraQueryExecution';
import type {IGuildRepositoryAggregate} from '@app/api/guild/repositories/IGuildRepositoryAggregate';
import {EventLogRepository} from '@app/api/netrcol/EventLogRepository';
import {ModuleSettingsRepository} from '@app/api/netrcol/ModuleSettingsRepository';
import {ModuleSettingsService} from '@app/api/netrcol/ModuleSettingsService';
import {InMemoryCassandraQueryExecutor} from '@app/api/test/InMemoryCassandraQueryExecutor';
import {AUTO_MOD_TRANSLATIONS} from '@fluxer/constants/src/AutoModTranslations';
import {EVENT_LOG_TRANSLATIONS} from '@fluxer/constants/src/EventLogTranslations';
import {NETRCOL_MESSAGE_LANGUAGES} from '@fluxer/constants/src/ModuleSettingsConstants';
import {ModuleSettingsUpdateRequest} from '@fluxer/schema/src/domains/guild/GuildModuleSettingsSchemas';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

describe('Shared Netrcol message language', () => {
	const guildId = createGuildID(100n),
		ownerId = createUserID(200n),
		otherId = createUserID(300n);
	const original = {selfHosted: Config.instance.selfHosted, backend: Config.database.backend};
	let owner = ownerId,
		member: object | null = {};
	let repository: ModuleSettingsRepository, events: EventLogRepository, service: ModuleSettingsService;
	beforeEach(() => {
		Config.instance.selfHosted = true;
		Config.database.backend = 'postgres';
		setCassandraQueryExecutorForTesting(new InMemoryCassandraQueryExecutor());
		owner = ownerId;
		member = {};
		repository = new ModuleSettingsRepository();
		events = new EventLogRepository();
		service = new ModuleSettingsService(
			{
				findUnique: async () => ({ownerId: owner}),
				getMember: async () => member,
			} as unknown as IGuildRepositoryAggregate,
			repository,
		);
	});
	afterEach(() => {
		Config.instance.selfHosted = original.selfHosted;
		Config.database.backend = original.backend;
	});
	const legacy = {enabled: false, channel_id: null, events: [] as [], language: 'tr'};
	it('reads the existing language without writing or changing event configuration', async () => {
		await events.saveConfig(guildId, ownerId, legacy, 0);
		expect(await service.read(guildId, ownerId)).toEqual({settings: {message_language: 'tr'}, revision: 0});
		expect(await repository.override(guildId)).toBeNull();
		expect((await events.getConfig(guildId)).revision).toBe(1);
		expect(await events.history(guildId)).toHaveLength(1);
	});
	it('saves a shared preference and history atomically without changing module revisions', async () => {
		await events.saveConfig(guildId, ownerId, legacy, 0);
		expect(await service.save(guildId, ownerId, {message_language: 'ja', revision: 0})).toEqual({
			settings: {message_language: 'ja'},
			revision: 1,
		});
		const eventSettings = await events.getConfig(guildId);
		expect(eventSettings.settings.language).toBe('ja');
		expect(eventSettings.revision).toBe(1);
		expect((await events.history(guildId)).filter((e) => e.kind === 'module_settings_updated')).toHaveLength(1);
		await expect(service.save(guildId, ownerId, {message_language: 'de', revision: 0})).rejects.toThrow();
		expect((await repository.read(guildId)).settings.message_language).toBe('ja');
		expect(await events.history(guildId)).toHaveLength(2);
	});
	it('uses the shared language even after a stale event-log panel saves its old hidden language', async () => {
		await service.save(guildId, ownerId, {message_language: 'de', revision: 0});
		await events.saveConfig(guildId, ownerId, legacy, 0);
		expect((await events.getConfig(guildId)).settings.language).toBe('de');
		expect((await repository.read(guildId)).settings.message_language).toBe('de');
	});
	it('defaults new communities to English and keeps each community independent', async () => {
		expect((await repository.read(guildId)).settings.message_language).toBe('en-US');
		await service.save(guildId, ownerId, {message_language: 'tr', revision: 0});
		expect((await repository.read(createGuildID(101n))).settings.message_language).toBe('en-US');
	});
	it('rejects non-owners, removed members and unsupported instances', async () => {
		await expect(service.read(guildId, otherId)).rejects.toThrow();
		await expect(service.save(guildId, otherId, {message_language: 'tr', revision: 0})).rejects.toThrow();
		member = null;
		await expect(service.read(guildId, ownerId)).rejects.toThrow();
		member = {};
		Config.instance.selfHosted = false;
		await expect(service.read(guildId, ownerId)).rejects.toThrow();
		Config.instance.selfHosted = true;
		Config.database.backend = 'cassandra';
		await expect(service.read(guildId, ownerId)).rejects.toThrow();
	});
	it('allows the new owner to edit the shared preference without re-enabling paused modules', async () => {
		await events.saveConfig(guildId, ownerId, legacy, 0);
		await service.save(guildId, ownerId, {message_language: 'tr', revision: 0});
		owner = otherId;
		await expect(service.save(guildId, ownerId, {message_language: 'de', revision: 1})).rejects.toThrow();
		await service.save(guildId, otherId, {message_language: 'de', revision: 1});
		expect((await events.getConfig(guildId)).approved_by).toBe(String(ownerId));
	});
	it('accepts exactly the 34 languages that have both message catalogs', () => {
		expect(NETRCOL_MESSAGE_LANGUAGES).toHaveLength(34);
		for (const message_language of NETRCOL_MESSAGE_LANGUAGES) {
			expect(ModuleSettingsUpdateRequest.safeParse({message_language, revision: 0}).success).toBe(true);
			expect(AUTO_MOD_TRANSLATIONS[message_language]).toBeDefined();
			expect(EVENT_LOG_TRANSLATIONS[message_language]).toBeDefined();
		}
		for (const message_language of ['zz', 'en', '', 'tr-TR'])
			expect(ModuleSettingsUpdateRequest.safeParse({message_language, revision: 0}).success).toBe(false);
	});
});
