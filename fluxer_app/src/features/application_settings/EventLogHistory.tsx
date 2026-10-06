// SPDX-License-Identifier: AGPL-3.0-or-later

import {APPLICATION_SETTINGS_MODULES as MODULES} from '@app/features/application_settings/ApplicationSettingsCatalog';
import styles from '@app/features/application_settings/ApplicationSettingsPage.module.css';
import {EVENT_LOG_LABELS as LABELS} from '@app/features/application_settings/EventLogCatalogCopy';
import {EVENT_LOG_COPY as TEXT} from '@app/features/application_settings/EventLogCopy';
import {SettingsSection} from '@app/features/guild/components/modals/guild_tabs/guild_overview_tab/components/GuildOverviewTabSettingsSection';
import overviewStyles from '@app/features/guild/components/modals/guild_tabs/guild_overview_tab/GuildOverviewTab.module.css';
import {Link} from '@app/features/platform/components/router/RouterReact';
import {http} from '@app/features/platform/transport/RestTransport';
import {Button} from '@app/features/ui/button/Button';
import {Spinner} from '@app/features/ui/components/Spinner';
import {
	type EventLogHistoryEntry,
	EventLogHistoryResponse,
} from '@fluxer/schema/src/domains/guild/GuildEventLogSchemas';
import {useLingui} from '@lingui/react/macro';
import {useCallback, useEffect, useRef, useState} from 'react';

export function EventLogHistory({guildId}: {guildId: string}) {
	const {i18n} = useLingui();
	const [entries, setEntries] = useState<Array<EventLogHistoryEntry>>([]);
	const [busy, setBusy] = useState(false);
	const [failed, setFailed] = useState(false);
	const requestId = useRef(0);
	const load = useCallback(async () => {
		const id = ++requestId.current;
		setBusy(true);
		setFailed(false);
		try {
			const body = EventLogHistoryResponse.parse(
				(await http.get(`/guilds/${guildId}/application-settings/history`)).body,
			);
			if (id === requestId.current) setEntries(body.entries);
		} catch {
			if (id === requestId.current) {
				setFailed(true);
				setEntries([]);
			}
		} finally {
			if (id === requestId.current) setBusy(false);
		}
	}, [guildId]);
	useEffect(() => {
		void load();
		return () => {
			requestId.current++;
		};
	}, [load]);
	return (
		<div data-flx="application-settings.action-history" aria-busy={busy}>
			<SettingsSection
				title={i18n._(MODULES.find((module) => module.id === 'audit')!.title)}
				description={i18n._(TEXT.historyInfo)}
			>
				<Button variant="secondary" onClick={() => void load()} disabled={busy}>
					{i18n._(TEXT.refresh)}
				</Button>
				{busy && <Spinner />}
				{failed && (
					<p role="alert" className={styles.liveError}>
						{i18n._(TEXT.loadError)}
					</p>
				)}
				{!busy && !failed && !entries.length && (
					<p role="status" className={overviewStyles.sectionDescription}>
						{i18n._(TEXT.emptyHistory)}
					</p>
				)}
				<ol className={styles.historyList}>
					{entries.map((entry) => (
						<li key={entry.id} className={styles.historyEntry}>
							<div className={styles.historyHeader}>
								<strong>
									{i18n._(
										entry.kind === 'config_updated'
											? TEXT.configUpdated
											: entry.kind === 'test'
												? LABELS.testMark
												: LABELS[entry.kind],
									)}
								</strong>
								<span>{i18n._(TEXT[entry.status])}</span>
							</div>
							<p className={overviewStyles.sectionDescription}>
								<time dateTime={new Date(entry.created_at).toISOString()}>
									{new Intl.DateTimeFormat(i18n.locale, {dateStyle: 'medium', timeStyle: 'short'}).format(
										entry.created_at,
									)}
								</time>
								{' · '}
								{i18n._(entry.actor_id == null ? LABELS.unknown : entry.actor_id === '0' ? TEXT.system : TEXT.user)}
								{entry.actor_id && entry.actor_id !== '0' ? ` ${entry.actor_id}` : ''}
								{entry.subject_id ? ` · ${i18n._(LABELS.target)} ${entry.subject_id}` : ''}
								{entry.test_event ? ` · ${i18n._(LABELS[entry.test_event])}` : ''}
								{entry.source_channel_id ? ` · ${i18n._(LABELS.source)} ${entry.source_channel_id}` : ''}
							</p>
							{entry.reason !== 'none' && (
								<p className={overviewStyles.sectionDescription}>
									{i18n._(
										TEXT[
											entry.reason === 'policy_changed'
												? 'policyChanged'
												: entry.reason === 'channel_missing'
													? 'channelMissing'
													: entry.reason === 'bot'
														? 'botSkipped'
														: entry.reason === 'stopped'
															? 'stopped'
															: 'deliveryFailed'
										],
									)}
								</p>
							)}
							{entry.message_id && entry.channel_id && (
								<Link to={`/channels/${guildId}/${entry.channel_id}/${entry.message_id}`}>{i18n._(TEXT.sent)}</Link>
							)}
						</li>
					))}
				</ol>
			</SettingsSection>
		</div>
	);
}
