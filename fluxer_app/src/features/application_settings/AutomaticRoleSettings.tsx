// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	APPLICATION_SETTINGS_COPY as COPY,
	APPLICATION_SETTINGS_MODULES as MODULES,
} from '@app/features/application_settings/ApplicationSettingsCatalog';
import styles from '@app/features/application_settings/ApplicationSettingsPage.module.css';
import {AUTOMATIC_ROLE_COPY as LABELS} from '@app/features/application_settings/AutomaticRoleCopy';
import {AutomaticRoleHistory} from '@app/features/application_settings/AutomaticRoleHistory';
import {EVENT_LOG_COPY as TEXT} from '@app/features/application_settings/EventLogCopy';
import {eventLogTabId} from '@app/features/application_settings/EventLogSettings';
import {GuildSettingsModal} from '@app/features/guild/components/modals/GuildSettingsModal';
import {SettingsSection} from '@app/features/guild/components/modals/guild_tabs/guild_overview_tab/components/GuildOverviewTabSettingsSection';
import overviewStyles from '@app/features/guild/components/modals/guild_tabs/guild_overview_tab/GuildOverviewTab.module.css';
import {http} from '@app/features/platform/transport/RestTransport';
import {Button} from '@app/features/ui/button/Button';
import * as ModalCommands from '@app/features/ui/commands/ModalCommands';
import {Combobox} from '@app/features/ui/components/form/FormCombobox';
import {Input} from '@app/features/ui/components/form/FormInput';
import {Switch} from '@app/features/ui/components/form/FormSwitch';
import {Spinner} from '@app/features/ui/components/Spinner';
import UnsavedChanges from '@app/features/ui/state/UnsavedChanges';
import {
	AutomaticRoleSettingsResponse,
	type AutomaticRoleSettings as Settings,
	AutomaticRoleSettings as SettingsSchema,
} from '@fluxer/schema/src/domains/guild/GuildAutomaticRoleSchemas';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {useCallback, useEffect, useRef, useState} from 'react';

const CREATE_ROLE_DESCRIPTOR = msg({message: 'Create role'});
const endpoint = (guildId: string) => `/guilds/${guildId}/application-settings/automatic-roles`;

export function AutomaticRoleSettings({guildId}: {guildId: string}) {
	const {i18n} = useLingui();
	const [saved, setSaved] = useState<AutomaticRoleSettingsResponse | null>(null);
	const [draft, setDraft] = useState<Settings | null>(null);
	const [error, setError] = useState<'loadError' | 'saveError' | 'conflict' | null>(null);
	const [notice, setNotice] = useState(false);
	const [busy, setBusy] = useState(false);
	const requestId = useRef(0);
	const tabId = eventLogTabId(guildId);
	const dirty = !!saved && !!draft && JSON.stringify(saved.settings) !== JSON.stringify(draft);
	const valid =
		!!draft &&
		!!saved &&
		SettingsSchema.safeParse(draft).success &&
		(!draft.enabled || !!(draft.member_role_ids.length + draft.bot_role_ids.length)) &&
		[...draft.member_role_ids, ...draft.bot_role_ids].every((id) => saved.roles.some((r) => r.id === id && r.eligible));
	const load = useCallback(async () => {
		const id = ++requestId.current;
		setBusy(true);
		setError(null);
		setNotice(false);
		setSaved(null);
		setDraft(null);
		try {
			const response = AutomaticRoleSettingsResponse.parse((await http.get(endpoint(guildId))).body);
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
	const refreshRoles = useCallback(async () => {
		const id = ++requestId.current;
		setBusy(true);
		setError(null);
		try {
			const response = AutomaticRoleSettingsResponse.parse((await http.get(endpoint(guildId))).body);
			if (id === requestId.current) setSaved((current) => current && {...current, roles: response.roles});
		} catch {
			if (id === requestId.current) setError('loadError');
		} finally {
			if (id === requestId.current) setBusy(false);
		}
	}, [guildId]);
	const openRoleSettings = useCallback(() => {
		const key = `automatic-roles-create-${guildId}`;
		ModalCommands.pushWithKey(
			ModalCommands.modal(() => (
				<GuildSettingsModal
					guildId={guildId}
					initialTab="roles"
					initialMobileTab="roles"
					onRoleCreated={() => {
						ModalCommands.popWithKey(key);
						void refreshRoles();
					}}
				/>
			)),
			key,
		);
	}, [guildId, refreshRoles]);
	const save = useCallback(async () => {
		if (!draft || !saved || busy || !valid) return;
		const id = ++requestId.current;
		setBusy(true);
		setError(null);
		setNotice(false);
		try {
			const response = AutomaticRoleSettingsResponse.parse(
				(
					await http.put(endpoint(guildId), {
						body: {...draft, revision: saved.revision},
						mode: 'strict',
					})
				).body,
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
	}, [draft, saved, busy, guildId, valid]);
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
		<div data-flx="application-settings.automatic-roles" aria-busy={busy}>
			<SettingsSection
				title={i18n._(COPY.configuration)}
				description={i18n._(MODULES.find((m) => m.id === 'autorole')!.description)}
			>
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
				{draft && saved && (
					<div className={overviewStyles.brandingContent}>
						<p role="status" className={overviewStyles.sectionDescription}>
							{i18n._(
								saved.status === 'owner_changed'
									? TEXT.ownerChanged
									: saved.status === 'stopped'
										? TEXT.stopped
										: TEXT[saved.status],
							)}
						</p>
						<Switch
							label={i18n._(COPY.enable)}
							value={draft.enabled}
							onChange={(enabled) => {
								setDraft({...draft, enabled});
								setNotice(false);
							}}
							disabled={busy}
						/>
						<p className={overviewStyles.sectionDescription}>{i18n._(LABELS.roleHelp)}</p>
						{(['member_role_ids', 'bot_role_ids'] as const).map((kind) => {
							const selected = draft[kind];
							const options = saved.roles
								.filter((r) => r.eligible || selected.includes(r.id))
								.map((r) => ({
									value: r.id,
									label: r.name,
									isDisabled: !r.eligible || (selected.length >= 20 && !selected.includes(r.id)),
								}));
							for (const id of selected)
								if (!options.some((o) => o.value === id)) options.push({value: id, label: id, isDisabled: true});
							const invalid = selected.some((id) => !saved.roles.some((r) => r.id === id && r.eligible));
							return (
								<div key={kind}>
									<Combobox<string, true>
										label={i18n._(kind === 'member_role_ids' ? LABELS.memberRoles : LABELS.botRoles)}
										value={selected}
										isMulti
										options={options}
										popupAction={{
											label: i18n._(CREATE_ROLE_DESCRIPTOR),
											onClick: openRoleSettings,
										}}
										disabled={busy}
										onChange={(ids) => {
											setDraft({...draft, [kind]: ids});
											setNotice(false);
										}}
									/>
									{kind === 'bot_role_ids' && (
										<p className={overviewStyles.sectionDescription}>{i18n._(LABELS.botHelp)}</p>
									)}
									{invalid && (
										<p role="alert" className={styles.liveError}>
											{i18n._(LABELS.roleUnavailable)}
										</p>
									)}
								</div>
							);
						})}
						<Input
							label={i18n._(LABELS.delay)}
							type="number"
							min={0}
							max={3600}
							step={1}
							value={String(draft.delay_seconds)}
							disabled={busy}
							onChange={(event) => {
								setDraft({
									...draft,
									delay_seconds: event.target.value === '' ? 0 : Number(event.target.value),
								});
								setNotice(false);
							}}
						/>
					</div>
				)}
				{draft && (
					<div className={styles.liveActions}>
						<Button onClick={() => void save()} disabled={busy || !dirty || !valid}>
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
			<AutomaticRoleHistory guildId={guildId} key={saved?.revision ?? 0} />
		</div>
	);
}
