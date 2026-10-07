// SPDX-License-Identifier: AGPL-3.0-or-later

import {APPLICATION_SETTINGS_COPY as COPY} from '@app/features/application_settings/ApplicationSettingsCatalog';
import styles from '@app/features/application_settings/ApplicationSettingsPage.module.css';
import {EVENT_LOG_COPY as TEXT} from '@app/features/application_settings/EventLogCopy';
import {eventLogTabId} from '@app/features/application_settings/EventLogSettings';
import {MODULE_SETTINGS_COPY as LABELS} from '@app/features/application_settings/ModuleSettingsCopy';
import {SettingsSection} from '@app/features/guild/components/modals/guild_tabs/guild_overview_tab/components/GuildOverviewTabSettingsSection';
import overviewStyles from '@app/features/guild/components/modals/guild_tabs/guild_overview_tab/GuildOverviewTab.module.css';
import {http} from '@app/features/platform/transport/RestTransport';
import {Button} from '@app/features/ui/button/Button';
import {Spinner} from '@app/features/ui/components/Spinner';
import UnsavedChanges from '@app/features/ui/state/UnsavedChanges';
import {CompactComboboxRow} from '@app/features/user/components/modals/tabs/components/CompactComboboxRow';
import {getSortedLocales} from '@app/features/user/utils/LocaleUtils';
import {NETRCOL_MESSAGE_LANGUAGES} from '@fluxer/constants/src/ModuleSettingsConstants';
import {
	ModuleSettingsResponse,
	type ModuleSettings as Settings,
} from '@fluxer/schema/src/domains/guild/GuildModuleSettingsSchemas';
import {useLingui} from '@lingui/react/macro';
import {useCallback, useEffect, useRef, useState} from 'react';

const endpoint = (guildId: string) => `/guilds/${guildId}/application-settings/modules`;

export function ModuleSettings({guildId}: {guildId: string}) {
	const {i18n} = useLingui();
	const [saved, setSaved] = useState<ModuleSettingsResponse | null>(null);
	const [draft, setDraft] = useState<Settings | null>(null);
	const [error, setError] = useState<'loadError' | 'saveError' | 'conflict' | null>(null);
	const [notice, setNotice] = useState(false);
	const [busy, setBusy] = useState(false);
	const requestId = useRef(0);
	const tabId = eventLogTabId(guildId);
	const dirty = !!saved && !!draft && saved.settings.message_language !== draft.message_language;
	const load = useCallback(async () => {
		const id = ++requestId.current;
		setBusy(true);
		setError(null);
		setNotice(false);
		setSaved(null);
		setDraft(null);
		try {
			const response = ModuleSettingsResponse.parse((await http.get(endpoint(guildId))).body);
			if (id === requestId.current) {
				setSaved(response);
				setDraft(response.settings);
			}
		} catch {
			if (id === requestId.current) setError('loadError');
		} finally {
			if (id === requestId.current) setBusy(false);
		}
	}, [guildId]);
	useEffect(() => {
		void load();
		return () => {
			requestId.current++;
			UnsavedChanges.clearUnsavedChanges(tabId);
		};
	}, [load, tabId]);
	const reset = useCallback(() => {
		if (saved) setDraft(saved.settings);
		setError(null);
		setNotice(false);
	}, [saved]);
	const save = useCallback(async () => {
		if (!draft || !saved || busy) return;
		const id = ++requestId.current;
		setBusy(true);
		setError(null);
		setNotice(false);
		try {
			const response = ModuleSettingsResponse.parse(
				(await http.put(endpoint(guildId), {body: {...draft, revision: saved.revision}, mode: 'strict'})).body,
			);
			if (id === requestId.current) {
				setSaved(response);
				setDraft(response.settings);
				setNotice(true);
			}
		} catch (failure) {
			if (id === requestId.current)
				setError(
					typeof failure === 'object' && failure !== null && 'status' in failure && failure.status === 409
						? 'conflict'
						: 'saveError',
				);
		} finally {
			if (id === requestId.current) setBusy(false);
		}
	}, [draft, saved, busy, guildId]);
	useEffect(() => {
		UnsavedChanges.setUnsavedChanges(tabId, dirty);
		UnsavedChanges.setTabData(tabId, {
			onSave: () => void save(),
			onReset: reset,
			isSubmitting: busy,
			saveLabel: i18n._(TEXT.save),
			resetLabel: i18n._(TEXT.reset),
		});
	}, [tabId, dirty, save, reset, busy, i18n]);
	useEffect(() => {
		if (!dirty) return;
		const warn = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = '';
		};
		window.addEventListener('beforeunload', warn);
		return () => window.removeEventListener('beforeunload', warn);
	}, [dirty]);
	return (
		<div data-flx="application-settings.module-settings" aria-busy={busy}>
			<SettingsSection title={i18n._(COPY.configuration)} description={i18n._(LABELS.description)}>
				{!saved && busy && <Spinner />}
				{error && (
					<p role="alert" className={styles.liveError}>
						{i18n._(error === 'conflict' ? TEXT.conflict : LABELS[error])}
					</p>
				)}
				{notice && (
					<p role="status" className={overviewStyles.sectionDescription}>
						{i18n._(TEXT.saved)}
					</p>
				)}
				{draft && (
					<CompactComboboxRow
						label={i18n._(LABELS.language)}
						value={draft.message_language}
						options={getSortedLocales()
							.filter((locale) => NETRCOL_MESSAGE_LANGUAGES.some((code) => code === locale.code))
							.map((locale) => ({
								value: locale.code as Settings['message_language'],
								label: `${locale.nativeName} — ${locale.name}`,
							}))}
						onChange={(language) => {
							setDraft({message_language: language as Settings['message_language']});
							setNotice(false);
						}}
						controlWidth="wide"
						disabled={busy}
						className={styles.previewSelectRow}
						dataFlx="application-settings.module-settings.language"
					/>
				)}
				{draft && (
					<div className={styles.liveActions}>
						<Button onClick={() => void save()} disabled={busy || !dirty}>
							{i18n._(TEXT.save)}
						</Button>
						<Button variant="secondary" onClick={reset} disabled={busy || !dirty}>
							{i18n._(TEXT.reset)}
						</Button>
					</div>
				)}
				{error && (
					<Button variant="secondary" onClick={() => void load()} disabled={busy}>
						{i18n._(TEXT.refresh)}
					</Button>
				)}
			</SettingsSection>
		</div>
	);
}
