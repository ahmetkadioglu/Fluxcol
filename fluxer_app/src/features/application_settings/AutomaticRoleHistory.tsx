// SPDX-License-Identifier: AGPL-3.0-or-later
import {APPLICATION_SETTINGS_MODULES as MODULES} from '@app/features/application_settings/ApplicationSettingsCatalog';
import styles from '@app/features/application_settings/ApplicationSettingsPage.module.css';
import {AUTOMATIC_ROLE_COPY as COPY} from '@app/features/application_settings/AutomaticRoleCopy';
import {EVENT_LOG_LABELS as LABELS} from '@app/features/application_settings/EventLogCatalogCopy';
import {EVENT_LOG_COPY as TEXT} from '@app/features/application_settings/EventLogCopy';
import {SettingsSection} from '@app/features/guild/components/modals/guild_tabs/guild_overview_tab/components/GuildOverviewTabSettingsSection';
import overviewStyles from '@app/features/guild/components/modals/guild_tabs/guild_overview_tab/GuildOverviewTab.module.css';
import {http} from '@app/features/platform/transport/RestTransport';
import {Button} from '@app/features/ui/button/Button';
import {Spinner} from '@app/features/ui/components/Spinner';
import {
	type AutomaticRoleHistoryEntry,
	AutomaticRoleHistoryResponse,
} from '@fluxer/schema/src/domains/guild/GuildAutomaticRoleSchemas';
import {useLingui} from '@lingui/react/macro';
import {useCallback, useEffect, useRef, useState} from 'react';

export function AutomaticRoleHistory({guildId}: {guildId: string}) {
	const {i18n} = useLingui();
	const [entries, setEntries] = useState<Array<AutomaticRoleHistoryEntry>>([]);
	const [busy, setBusy] = useState(false),
		[failed, setFailed] = useState(false);
	const requestId = useRef(0);
	const load = useCallback(async () => {
		const id = ++requestId.current;
		setBusy(true);
		setFailed(false);
		setEntries([]);
		try {
			const response = AutomaticRoleHistoryResponse.parse(
				(await http.get(`/guilds/${guildId}/application-settings/automatic-roles/history`)).body,
			);
			if (id === requestId.current) setEntries(response.entries);
		} catch {
			if (id === requestId.current) setFailed(true);
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
		<SettingsSection
			title={`${i18n._(MODULES.find((m) => m.id === 'autorole')!.title)} · ${i18n._(MODULES.find((m) => m.id === 'audit')!.title)}`}
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
									entry.status === 'saved' ? COPY.configUpdated : MODULES.find((m) => m.id === 'autorole')!.title,
								)}
							</strong>
							<span>{i18n._(entry.status === 'assigned' ? COPY.assigned : TEXT[entry.status])}</span>
						</div>
						<p className={overviewStyles.sectionDescription}>
							<time dateTime={new Date(entry.at).toISOString()}>
								{new Intl.DateTimeFormat(i18n.locale, {dateStyle: 'medium', timeStyle: 'short'}).format(entry.at)}
							</time>
							{' · '}
							{entry.actor_id === '0' ? 'Netrcol' : `${i18n._(TEXT.user)} ${entry.actor_id}`}
							{entry.user_id && ` · ${i18n._(LABELS.target)} ${entry.user_id}`}
							{entry.role_ids.length > 0 && ` · ${entry.role_ids.join(', ')}`}
						</p>
						{entry.reason !== 'none' && (
							<p className={overviewStyles.sectionDescription}>
								{i18n._(
									entry.reason === 'policy_changed'
										? TEXT.policyChanged
										: entry.reason === 'member_left'
											? LABELS.member_leave
											: entry.reason === 'role_unavailable'
												? COPY.roleUnavailable
												: entry.reason === 'no_roles'
													? COPY.noRoles
													: entry.reason === 'stopped'
														? TEXT.stopped
														: TEXT.failed,
								)}
							</p>
						)}
					</li>
				))}
			</ol>
		</SettingsSection>
	);
}
