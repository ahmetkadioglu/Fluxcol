// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	APPLICATION_SETTINGS_COPY as COPY,
	APPLICATION_SETTINGS_FIELDS as FIELDS,
} from '@app/features/application_settings/ApplicationSettingsCatalog';
import styles from '@app/features/application_settings/ApplicationSettingsPage.module.css';
import {EVENT_LOG_LABELS as LABELS} from '@app/features/application_settings/EventLogCatalogCopy';
import {EVENT_LOG_COPY as TEXT} from '@app/features/application_settings/EventLogCopy';
import {EventLogEventPicker} from '@app/features/application_settings/EventLogEventPicker';
import {SettingsSection} from '@app/features/guild/components/modals/guild_tabs/guild_overview_tab/components/GuildOverviewTabSettingsSection';
import overviewStyles from '@app/features/guild/components/modals/guild_tabs/guild_overview_tab/GuildOverviewTab.module.css';
import {http} from '@app/features/platform/transport/RestTransport';
import {Button} from '@app/features/ui/button/Button';
import {Switch} from '@app/features/ui/components/form/FormSwitch';
import {Spinner} from '@app/features/ui/components/Spinner';
import UnsavedChanges from '@app/features/ui/state/UnsavedChanges';
import {CompactComboboxRow} from '@app/features/user/components/modals/tabs/components/CompactComboboxRow';
import {eventLogChannel} from '@fluxer/constants/src/EventLogConstants';
import type {EventLogEvent} from '@fluxer/schema/src/domains/guild/GuildEventLogSchemas';
import {
	EventLogSettingsResponse,
	type EventLogSettings as Settings,
} from '@fluxer/schema/src/domains/guild/GuildEventLogSchemas';
import {useLingui} from '@lingui/react/macro';
import {useCallback, useEffect, useRef, useState} from 'react';

export const eventLogTabId = (guildId: string) => `application-settings-event-logs:${guildId}`;
const endpoint = (guildId: string) => `/guilds/${guildId}/application-settings/event-logs`;

export function EventLogSettings({guildId}: {guildId: string}) {
	const {i18n} = useLingui();
	const [saved, setSaved] = useState<EventLogSettingsResponse | null>(null);
	const [draft, setDraft] = useState<Settings | null>(null);
	const [error, setError] = useState<keyof typeof TEXT | null>(null);
	const [notice, setNotice] = useState<keyof typeof TEXT | null>(null);
	const [testEvent, setTestEvent] = useState<EventLogEvent>('member_join');
	const [preview, setPreview] = useState(false);
	const [busy, setBusy] = useState(false);
	const requestId = useRef(0);
	const dirty = saved !== null && draft !== null && JSON.stringify(saved.settings) !== JSON.stringify(draft);
	const selectedTestEvent = saved?.settings.events.includes(testEvent)
		? testEvent
		: (saved?.settings.events[0] ?? testEvent);
	const tabId = eventLogTabId(guildId);
	const load = useCallback(async () => {
		const id = ++requestId.current;
		setBusy(true);
		setError(null);
		setNotice(null);
		setSaved(null);
		setDraft(null);
		try {
			const response = EventLogSettingsResponse.parse((await http.get(endpoint(guildId))).body);
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
		setNotice(null);
	}, [saved]);
	const save = useCallback(async () => {
		if (!draft || !saved || busy) return;
		setBusy(true);
		setError(null);
		setNotice(null);
		const id = ++requestId.current;
		try {
			const response = EventLogSettingsResponse.parse(
				(await http.put(endpoint(guildId), {body: {...draft, revision: saved.revision}, mode: 'strict'})).body,
			);
			if (id === requestId.current) {
				setSaved(response);
				setDraft(response.settings);
				setNotice('saved');
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
	const test = async () => {
		if (busy || dirty || saved?.status !== 'enabled') return;
		setBusy(true);
		setError(null);
		setNotice(null);
		const id = ++requestId.current;
		try {
			await http.post(`${endpoint(guildId)}/test`, {body: {event_type: selectedTestEvent}, mode: 'strict'});
			if (id === requestId.current) setNotice('testQueued');
		} catch {
			if (id === requestId.current) setError('deliveryFailed');
		} finally {
			if (id === requestId.current) setBusy(false);
		}
	};
	return (
		<div data-flx="application-settings.event-logs" aria-busy={busy}>
			<SettingsSection title={i18n._(COPY.configuration)} description={i18n._(LABELS.scope)}>
				{!saved && busy && <Spinner />}
				{error && (
					<p role="alert" className={styles.liveError}>
						{i18n._(TEXT[error])}
					</p>
				)}
				{notice && (
					<p role="status" className={overviewStyles.sectionDescription}>
						{i18n._(TEXT[notice])}
					</p>
				)}
				{draft && saved && (
					<div className={overviewStyles.brandingContent}>
						<p role="status" className={overviewStyles.sectionDescription}>
							{i18n._(
								TEXT[
									saved.status === 'enabled'
										? 'enabled'
										: saved.status === 'disabled'
											? 'disabled'
											: saved.status === 'owner_changed'
												? 'ownerChanged'
												: saved.status === 'channel_missing'
													? 'channelMissing'
													: 'stopped'
								],
							)}
						</p>
						<Switch
							label={i18n._(COPY.enable)}
							value={draft.enabled}
							disabled={busy}
							onChange={(enabled) => setDraft({...draft, enabled})}
						/>
						<CompactComboboxRow
							label={i18n._(LABELS.defaultChannel)}
							value={draft.channel_id}
							options={[
								{value: null, label: i18n._(FIELDS.channel.value)},
								...saved.channels.map((channel) => ({value: channel.id, label: `#${channel.name}`})),
							]}
							onChange={(channel_id) => setDraft({...draft, channel_id})}
							controlWidth="wide"
							disabled={busy}
							className={styles.previewSelectRow}
							dataFlx="application-settings.event-logs.channel"
						/>
						<Switch
							label={i18n._(LABELS.capture)}
							value={draft.capture_message_content ?? false}
							disabled={busy}
							onChange={(capture_message_content) => setDraft({...draft, capture_message_content})}
						/>
						<p className={overviewStyles.sectionDescription}>{i18n._(LABELS.privacy)}</p>
						<EventLogEventPicker draft={draft} channels={saved.channels} busy={busy} onChange={setDraft} />
						<CompactComboboxRow
							dataFlx="application-settings.event-logs.test-type"
							label={i18n._(LABELS.test)}
							value={saved.settings.events.length ? selectedTestEvent : null}
							options={saved.settings.events.map((event) => ({value: event, label: i18n._(LABELS[event])}))}
							onChange={(value) => {
								if (value) setTestEvent(value);
							}}
							disabled={busy || dirty}
							controlWidth="wide"
							className={styles.previewSelectRow}
						/>
						<Button variant="secondary" onClick={() => setPreview(!preview)}>
							{i18n._(LABELS.preview)}
						</Button>
						{preview && (
							<div role="status" className={overviewStyles.sectionDescription}>
								<strong>
									{i18n._(LABELS.testMark)} · {i18n._(LABELS[selectedTestEvent])}
								</strong>
								<p>
									{i18n._(LABELS.destination)}:{' '}
									{eventLogChannel(draft, selectedTestEvent)
										? '#' +
											(saved.channels.find((channel) => channel.id === eventLogChannel(draft, selectedTestEvent))
												?.name ?? eventLogChannel(draft, selectedTestEvent))
										: i18n._(LABELS.unknown)}
								</p>
								<p>
									{i18n._(LABELS.time)}:{' '}
									{new Intl.DateTimeFormat(i18n.locale, {dateStyle: 'medium', timeStyle: 'short'}).format(Date.now())}
								</p>
								<p>
									{i18n._(LABELS.actor)}: {i18n._(LABELS.system)}
								</p>
								<p>
									{i18n._(LABELS.target)}: {guildId}
								</p>
								<p>
									{i18n._(LABELS.capture)}: {i18n._(draft.capture_message_content ? LABELS.enabled : LABELS.disabled)}
								</p>
							</div>
						)}
						<div className={styles.liveActions}>
							<Button onClick={() => void save()} disabled={busy || (!dirty && saved.status !== 'owner_changed')}>
								{i18n._(TEXT.save)}
							</Button>
							<Button variant="secondary" onClick={reset} disabled={busy || !dirty}>
								{i18n._(TEXT.reset)}
							</Button>
							<Button
								variant="secondary"
								onClick={() => void test()}
								disabled={busy || dirty || saved.status !== 'enabled'}
							>
								{i18n._(TEXT.test)}
							</Button>
						</div>
					</div>
				)}
				{!draft || error === 'conflict' ? (
					<Button variant="secondary" onClick={() => void load()} disabled={busy}>
						{i18n._(TEXT.refresh)}
					</Button>
				) : null}
			</SettingsSection>
		</div>
	);
}
