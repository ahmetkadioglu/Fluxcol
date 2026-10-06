// SPDX-License-Identifier: AGPL-3.0-or-later

import {APPLICATION_SETTINGS_MODULES as MODULES} from '@app/features/application_settings/ApplicationSettingsCatalog';
import styles from '@app/features/application_settings/ApplicationSettingsPage.module.css';
import {AUTO_MOD_COPY as COPY} from '@app/features/application_settings/AutoModCopy';
import {EVENT_LOG_LABELS as LABELS} from '@app/features/application_settings/EventLogCatalogCopy';
import {EVENT_LOG_COPY as TEXT} from '@app/features/application_settings/EventLogCopy';
import {SettingsSection} from '@app/features/guild/components/modals/guild_tabs/guild_overview_tab/components/GuildOverviewTabSettingsSection';
import overviewStyles from '@app/features/guild/components/modals/guild_tabs/guild_overview_tab/GuildOverviewTab.module.css';
import {http} from '@app/features/platform/transport/RestTransport';
import {Button} from '@app/features/ui/button/Button';
import {type AutoModHistoryEntry, AutoModHistoryResponse} from '@fluxer/schema/src/domains/guild/GuildAutoModSchemas';
import {useLingui} from '@lingui/react/macro';
import {useCallback, useEffect, useRef, useState} from 'react';

export function AutoModHistory({guildId}: {guildId: string}) {
	const {i18n} = useLingui();
	const [entries, setEntries] = useState<Array<AutoModHistoryEntry>>([]),
		[busy, setBusy] = useState(false),
		[failed, setFailed] = useState(false);
	const sequence = useRef(0);
	const load = useCallback(async () => {
		const id = ++sequence.current;
		setBusy(true);
		setFailed(false);
		try {
			const response = AutoModHistoryResponse.parse(
				(await http.get(`/guilds/${guildId}/application-settings/automod/history`)).body,
			);
			if (id === sequence.current) setEntries(response.entries);
		} catch {
			if (id === sequence.current) setFailed(true);
		} finally {
			if (id === sequence.current) setBusy(false);
		}
	}, [guildId]);
	useEffect(() => {
		setEntries([]);
		void load();
		return () => {
			sequence.current++;
		};
	}, [load]);
	return (
		<SettingsSection title={`AutoMod · ${i18n._(MODULES.find((module) => module.id === 'audit')!.title)}`}>
			<Button variant="secondary" disabled={busy} onClick={() => void load()}>
				{i18n._(TEXT.refresh)}
			</Button>
			{failed && (
				<p role="alert" className={styles.liveError}>
					{i18n._(COPY.loadError)}
				</p>
			)}
			{!busy && !failed && !entries.length && (
				<p role="status" className={overviewStyles.sectionDescription}>
					{i18n._(TEXT.emptyHistory)}
				</p>
			)}
			<ol className={styles.historyList} aria-busy={busy}>
				{entries.map((entry) => (
					<li className={styles.historyEntry} key={entry.id}>
						<div className={styles.historyHeader}>
							<strong>
								{entry.status === 'saved'
									? i18n._(COPY.configUpdated)
									: entry.rules?.map((id) => i18n._(COPY[id])).join(' · ') || 'AutoMod'}
							</strong>
							<span>
								{entry.status === 'observed'
									? i18n._(COPY.observe)
									: entry.status === 'applied'
										? i18n._(LABELS.changed)
										: i18n._(TEXT[entry.status === 'passed' ? 'enabled' : entry.status])}
							</span>
						</div>
						<p className={overviewStyles.sectionDescription}>
							<time dateTime={new Date(entry.at).toISOString()}>
								{new Intl.DateTimeFormat(i18n.locale, {dateStyle: 'medium', timeStyle: 'short'}).format(entry.at)}
							</time>
							{' · '}
							{i18n._(TEXT.user)} {entry.actor_id}
							{entry.channel_id ? ` · ${i18n._(LABELS.source)} ${entry.channel_id}` : ''}
						</p>
						{entry.actions?.length ? (
							<p className={overviewStyles.sectionDescription}>
								{[...new Set(entry.actions)].map((action) => i18n._(COPY[action])).join(' · ')}
							</p>
						) : null}
					</li>
				))}
			</ol>
		</SettingsSection>
	);
}
