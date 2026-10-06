// SPDX-License-Identifier: AGPL-3.0-or-later

import {AntiAbuseSettings} from '@app/features/application_settings/AntiAbuseSettings';
import {AntiSpamSettings} from '@app/features/application_settings/AntiSpamSettings';
import {
	APPLICATION_SETTINGS_COPY as COPY,
	APPLICATION_SETTINGS_FIELDS as FIELDS,
	APPLICATION_SETTINGS_MODULES as MODULES,
} from '@app/features/application_settings/ApplicationSettingsCatalog';
import {AUTO_MOD_COPY as LABELS} from '@app/features/application_settings/AutoModCopy';
import {mergeAutoModEntries, mergeAutoModWords} from '@app/features/application_settings/AutoModEntryList';
import {AutoModLinkSettings} from '@app/features/application_settings/AutoModLinkSettings';
import {AutoModPermissions} from '@app/features/application_settings/AutoModPermissions';
import {
	AutoModCollapsibleSection,
	type AutoModRuleSettingsProps,
} from '@app/features/application_settings/AutoModRuleSettings';
import styles from '@app/features/application_settings/AutoModSettings.module.css';
import {type BadWordsPending, BadWordsSettings} from '@app/features/application_settings/BadWordsSettings';
import {CharacterLimitSettings} from '@app/features/application_settings/CharacterLimitSettings';
import {EVENT_LOG_LABELS} from '@app/features/application_settings/EventLogCatalogCopy';
import {EVENT_LOG_COPY as TEXT} from '@app/features/application_settings/EventLogCopy';
import {eventLogTabId} from '@app/features/application_settings/EventLogSettings';
import {ExcessiveCapsSettings} from '@app/features/application_settings/ExcessiveCapsSettings';
import {ExcessiveEmojisSettings} from '@app/features/application_settings/ExcessiveEmojisSettings';
import {ExcessiveMentionsSettings} from '@app/features/application_settings/ExcessiveMentionsSettings';
import {ExcessiveSpoilersSettings} from '@app/features/application_settings/ExcessiveSpoilersSettings';
import {MediaSpamSettings} from '@app/features/application_settings/MediaSpamSettings';
import {RepeatedTextSettings} from '@app/features/application_settings/RepeatedTextSettings';
import {ZalgoSettings} from '@app/features/application_settings/ZalgoSettings';
import {SettingsSection} from '@app/features/guild/components/modals/guild_tabs/guild_overview_tab/components/GuildOverviewTabSettingsSection';
import overviewStyles from '@app/features/guild/components/modals/guild_tabs/guild_overview_tab/GuildOverviewTab.module.css';
import {http} from '@app/features/platform/transport/RestTransport';
import {Button} from '@app/features/ui/button/Button';
import {Combobox} from '@app/features/ui/components/form/FormCombobox';
import {Input, Textarea} from '@app/features/ui/components/form/FormInput';
import {Switch} from '@app/features/ui/components/form/FormSwitch';
import {Spinner} from '@app/features/ui/components/Spinner';
import UnsavedChanges from '@app/features/ui/state/UnsavedChanges';
import {CompactComboboxRow} from '@app/features/user/components/modals/tabs/components/CompactComboboxRow';
import {AUTO_MOD_RULE_IDS, type AutoModRuleId, autoModActions} from '@fluxer/constants/src/AutoModConstants';
import {
	type AutoModRule,
	AutoModSettingsResponse,
	AutoModSimulationResponse,
	AutoModSettings as Settings,
	sharedAutoModPermissions,
} from '@fluxer/schema/src/domains/guild/GuildAutoModSchemas';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {GearIcon} from '@phosphor-icons/react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

const MODULE = MODULES.find((module) => module.id === 'automod')!;
const SETTINGS = msg({message: 'Settings'});
const PREVIEW = msg({message: 'Preview'});
const endpoint = (guildId: string) => `/guilds/${guildId}/application-settings/automod`;
type DetailRuleId = AutoModRuleId;
function isLinkRule(id: AutoModRuleId | null): id is 'server_invites' | 'external_links' {
	return id === 'server_invites' || id === 'external_links';
}

export function AutoModSettings({guildId}: {guildId: string}) {
	const {i18n} = useLingui();
	const [saved, setSaved] = useState<AutoModSettingsResponse | null>(null);
	const [draft, setDraft] = useState<Settings | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<keyof typeof TEXT | null>(null);
	const [notice, setNotice] = useState(false);
	const [sample, setSample] = useState('');
	const [preview, setPreview] = useState<Array<AutoModRuleId> | null>(null);
	const [detailRule, setDetailRule] = useState<DetailRuleId | null>(null);
	const [pendingLinks, setPendingLinks] = useState('');
	const entryWhitelist = useRef<Array<string>>([]);
	const [pendingWords, setPendingWords] = useState<BadWordsPending>({
		exact: '',
		partial: '',
	});
	const entryRule = useRef<AutoModRule | null>(null);
	const detailTriggers = useRef<Partial<Record<AutoModRuleId, HTMLButtonElement | null>>>({});
	const returnFocus = useRef<AutoModRuleId | null>(null);
	const [domainText, setDomainText] = useState<Partial<Record<AutoModRuleId, string>>>({});
	const requestId = useRef(0),
		tabId = eventLogTabId(guildId);
	const prepared = useMemo(() => {
		if (!draft) return null;
		const prepared =
			!pendingWords.exact.trim() && !pendingWords.partial.trim()
				? draft
				: {
						...draft,
						rules: {
							...draft.rules,
							bad_words: {
								...draft.rules.bad_words,
								words: mergeAutoModWords(draft.rules.bad_words.words, pendingWords.exact),
								partial_words: mergeAutoModWords(draft.rules.bad_words.partial_words, pendingWords.partial),
							},
						},
					};
		return pendingLinks.trim()
			? {
					...prepared,
					link_whitelist: mergeAutoModEntries(prepared.link_whitelist, pendingLinks, true),
				}
			: prepared;
	}, [draft, pendingWords, pendingLinks]);
	const dirty = !!saved && !!prepared && JSON.stringify(saved.settings) !== JSON.stringify(prepared);
	const valid =
		!!prepared &&
		Settings.safeParse(prepared).success &&
		(!prepared.enabled || Object.values(prepared.rules).some((rule) => rule.action !== 'disabled'));
	const load = useCallback(async () => {
		const id = ++requestId.current;
		setBusy(true);
		setError(null);
		setSaved(null);
		setDraft(null);
		setPendingWords({exact: '', partial: ''});
		setDomainText({});
		setPendingLinks('');
		try {
			const response = AutoModSettingsResponse.parse((await http.get(endpoint(guildId))).body);
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
		setPreview(null);
		setPendingWords({exact: '', partial: ''});
		setDomainText({});
		setPendingLinks('');
	}, [saved]);
	const save = useCallback(async () => {
		if (!prepared || !saved || busy || !valid) return false;
		const id = ++requestId.current;
		setBusy(true);
		setError(null);
		setNotice(false);
		try {
			const response = AutoModSettingsResponse.parse(
				(
					await http.put(endpoint(guildId), {
						body: {...prepared, revision: saved.revision},
						mode: 'strict',
					})
				).body,
			);
			if (id === requestId.current) {
				setSaved(response);
				setDraft(response.settings);
				setNotice(true);
				setPendingWords({exact: '', partial: ''});
				setPendingLinks('');
				return true;
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
		return false;
	}, [guildId, prepared, saved, busy, valid]);
	const closeDetail = useCallback(() => {
		returnFocus.current = detailRule;
		setDetailRule(null);
		setPendingWords({exact: '', partial: ''});
		setPendingLinks('');
		setError(null);
	}, [detailRule]);
	const discardDetail = useCallback(() => {
		const original = entryRule.current;
		if (original && detailRule)
			setDraft((current) =>
				current
					? {
							...current,
							rules: {...current.rules, [detailRule]: original},
							...(isLinkRule(detailRule) ? {link_whitelist: entryWhitelist.current} : {}),
						}
					: current,
			);
		if (original && isLinkRule(detailRule))
			setDomainText((current) => ({
				...current,
				[detailRule]: original.allowed_domains.join('\n'),
			}));
		setPendingWords({exact: '', partial: ''});
		closeDetail();
	}, [closeDetail, detailRule]);
	const saveCloseDetail = useCallback(async () => {
		if (busy || !valid) return;
		if ((!dirty && saved?.status !== 'owner_changed') || (await save())) closeDetail();
	}, [busy, valid, dirty, saved?.status, save, closeDetail]);
	useEffect(() => {
		if (!detailRule && returnFocus.current) {
			detailTriggers.current[returnFocus.current]?.focus();
			returnFocus.current = null;
		}
	}, [detailRule]);
	useEffect(() => {
		UnsavedChanges.setUnsavedChanges(tabId, dirty);
		UnsavedChanges.setTabData(tabId, {
			onSave: () => void (detailRule ? saveCloseDetail() : save()),
			onReset: detailRule ? discardDetail : reset,
			isSubmitting: busy || !valid,
			saveLabel: i18n._(TEXT.save),
			resetLabel: i18n._(detailRule ? LABELS.discard : TEXT.reset),
		});
	}, [tabId, dirty, save, reset, busy, valid, i18n, detailRule, saveCloseDetail, discardDetail]);
	useEffect(() => {
		if (!dirty) return;
		const warn = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = '';
		};
		window.addEventListener('beforeunload', warn);
		return () => window.removeEventListener('beforeunload', warn);
	}, [dirty]);
	const updateRule = (id: AutoModRuleId, patch: Partial<AutoModRule>) => {
		if (draft) {
			setDraft((current) =>
				current
					? {
							...current,
							rules: {
								...current.rules,
								[id]: {...current.rules[id], ...patch},
							},
						}
					: current,
			);
			setNotice(false);
			setPreview(null);
		}
	};
	const simulate = async () => {
		if (busy || dirty || !sample.trim()) return;
		const id = ++requestId.current;
		setBusy(true);
		setError(null);
		try {
			const result = AutoModSimulationResponse.parse(
				(
					await http.post(`${endpoint(guildId)}/simulate`, {
						body: {content: sample},
						mode: 'strict',
					})
				).body,
			);
			if (id === requestId.current) setPreview(result.rules);
		} catch {
			if (id === requestId.current) setError('loadError');
		} finally {
			if (id === requestId.current) setBusy(false);
		}
	};
	if (detailRule && saved && draft) {
		const props: AutoModRuleSettingsProps = {
			rule: draft.rules[detailRule],
			available: {...saved, settings: draft},
			onChange: (patch) => updateRule(detailRule, patch),
			busy,
			valid,
			onBack: () => {
				if (
					JSON.stringify(prepared?.rules[detailRule]) !== JSON.stringify(entryRule.current) ||
					(isLinkRule(detailRule) &&
						JSON.stringify(prepared?.link_whitelist) !== JSON.stringify(entryWhitelist.current))
				)
					UnsavedChanges.triggerFlash(tabId);
				else closeDetail();
			},
			onDiscard: discardDetail,
			onSaveClose: () => void saveCloseDetail(),
			error: (error || !valid) && (
				<p role="alert" className={styles.error}>
					{i18n._(error === 'conflict' ? TEXT.conflict : LABELS.saveError)}
				</p>
			),
		};
		return detailRule === 'bad_words' ? (
			<BadWordsSettings {...props} pending={pendingWords} onPendingChange={setPendingWords} />
		) : detailRule === 'repeated_text' ? (
			<RepeatedTextSettings {...props} />
		) : detailRule === 'excessive_caps' ? (
			<ExcessiveCapsSettings {...props} />
		) : detailRule === 'excessive_emojis' ? (
			<ExcessiveEmojisSettings {...props} />
		) : detailRule === 'excessive_spoilers' ? (
			<ExcessiveSpoilersSettings {...props} />
		) : detailRule === 'excessive_mentions' ? (
			<ExcessiveMentionsSettings {...props} />
		) : detailRule === 'zalgo' ? (
			<ZalgoSettings {...props} />
		) : detailRule === 'anti_spam' ? (
			<AntiSpamSettings {...props} />
		) : detailRule === 'character_limit' ? (
			<CharacterLimitSettings {...props} />
		) : detailRule === 'media_spam' ? (
			<MediaSpamSettings {...props} />
		) : detailRule === 'anti_raid' || detailRule === 'anti_nuke' ? (
			<AntiAbuseSettings {...props} id={detailRule} />
		) : (
			<AutoModLinkSettings
				{...props}
				key={detailRule}
				ruleId={detailRule}
				pending={pendingLinks}
				onPendingChange={setPendingLinks}
				onWhitelistChange={(link_whitelist) => {
					setDraft((current) => (current ? {...current, link_whitelist} : current));
					setNotice(false);
					setPreview(null);
				}}
				domainText={domainText[detailRule] ?? draft.rules[detailRule].allowed_domains.join('\n')}
				onDomainTextChange={(text) => {
					setDomainText((current) => ({...current, [detailRule]: text}));
					updateRule(detailRule, {
						allowed_domains: text
							.split(/\r?\n/u)
							.map((value) => value.trim())
							.filter(Boolean),
					});
				}}
			/>
		);
	}
	return (
		<div data-flx="application-settings.automod" aria-busy={busy}>
			<SettingsSection title={i18n._(COPY.configuration)} description={i18n._(MODULE.description)}>
				<p className={overviewStyles.sectionDescription}>{i18n._(LABELS.scope)}</p>
				{busy && !saved && <Spinner />}
				{error && (
					<p className={styles.error} role="alert">
						{i18n._(error === 'loadError' || error === 'saveError' ? LABELS[error] : TEXT[error])}
					</p>
				)}
				{notice && (
					<p role="status" className={overviewStyles.sectionDescription}>
						{i18n._(TEXT.saved)}
					</p>
				)}
				{saved && draft && (
					<div className={overviewStyles.brandingContent}>
						<p role="status" className={overviewStyles.sectionDescription}>
							{i18n._(TEXT[saved.status === 'owner_changed' ? 'ownerChanged' : saved.status])}
						</p>
						<Switch
							label={i18n._(COPY.enable)}
							value={draft.enabled}
							disabled={busy}
							onChange={(enabled) => setDraft({...draft, enabled})}
						/>
						<Switch
							label={i18n._(LABELS.ignoreBots)}
							value={draft.ignore_bots}
							disabled={busy}
							onChange={(ignore_bots) => setDraft({...draft, ignore_bots})}
						/>
						<CompactComboboxRow
							label={i18n._(FIELDS.channel.label)}
							value={draft.channel_id}
							options={[
								{value: null, label: i18n._(EVENT_LOG_LABELS.source)},
								...saved.channels.map((channel) => ({
									value: channel.id,
									label: `#${channel.name}`,
								})),
							]}
							onChange={(channel_id) => setDraft({...draft, channel_id})}
							disabled={busy}
							controlWidth="wide"
							dataFlx="application-settings.automod.channel"
						/>
						<Input
							type="number"
							label={`${i18n._(FIELDS.duration.label)} (s)`}
							min={10}
							max={86400}
							value={draft.duration_seconds}
							disabled={busy}
							onChange={(event) =>
								setDraft({
									...draft,
									duration_seconds: Number(event.target.value),
								})
							}
						/>
						{saved.lockdown_until > Date.now() && (
							<p role="status" className={overviewStyles.sectionDescription}>
								{i18n._(LABELS.lockdown)} ·{' '}
								{new Intl.DateTimeFormat(i18n.locale, {
									dateStyle: 'short',
									timeStyle: 'short',
								}).format(saved.lockdown_until)}
							</p>
						)}
					</div>
				)}
			</SettingsSection>
			{draft && saved && (
				<>
					<SettingsSection title={i18n._(FIELDS.rules.label)}>
						<div className={styles.rules}>
							{AUTO_MOD_RULE_IDS.map((id) => (
								<section
									key={id}
									className={styles.rule}
									aria-label={i18n._(LABELS[id])}
									data-flx={`application-settings.automod.rule.${id}`}
								>
									<div className={styles.ruleHeader}>
										<h3>{i18n._(LABELS[id])}</h3>
										<Button
											variant="secondary"
											disabled={busy}
											aria-label={`${i18n._(LABELS[id])} · ${i18n._(SETTINGS)}`}
											leftIcon={<GearIcon size={14} aria-hidden="true" />}
											ref={(node) => {
												detailTriggers.current[id] = node;
											}}
											onClick={() => {
												entryRule.current = structuredClone(draft.rules[id]);
												if (isLinkRule(id)) {
													entryWhitelist.current = [...draft.link_whitelist];
													setDomainText((current) => ({
														...current,
														[id]: draft.rules[id].allowed_domains.join('\n'),
													}));
												}
												setDetailRule(id);
											}}
										>
											{i18n._(SETTINGS)}
										</Button>
									</div>
									<Combobox
										aria-label={i18n._(LABELS[id])}
										value={draft.rules[id].action}
										options={autoModActions(id).map((action) => ({
											value: action,
											label: i18n._(LABELS[action]),
										}))}
										onChange={(action) => updateRule(id, {action})}
										disabled={busy}
										isSearchable={false}
										data-flx={`application-settings.automod.action.${id}`}
									/>
								</section>
							))}
						</div>
					</SettingsSection>
					<AutoModCollapsibleSection title={i18n._(LABELS.sharedPermissions)} initiallyOpen={false}>
						<AutoModPermissions
							value={sharedAutoModPermissions(draft)}
							available={saved}
							disabled={busy}
							onChange={(permissions) =>
								setDraft({
									...draft,
									permissions,
									exempt_channel_ids: permissions.channels.mode === 'exclude' ? permissions.channels.ids : [],
									exempt_role_ids: permissions.roles.mode === 'exclude' ? permissions.roles.ids : [],
								})
							}
						/>
					</AutoModCollapsibleSection>
					<SettingsSection title={i18n._(PREVIEW)}>
						<div className={overviewStyles.brandingContent}>
							<Textarea
								label={i18n._(FIELDS.message.label)}
								value={sample}
								maxLength={10000}
								disabled={busy}
								onChange={(event) => {
									setSample(event.target.value);
									setPreview(null);
								}}
							/>
							<Button variant="secondary" disabled={busy || dirty || !sample.trim()} onClick={() => void simulate()}>
								{i18n._(PREVIEW)}
							</Button>
							{preview && (
								<p role="status" className={overviewStyles.sectionDescription}>
									{preview.length ? preview.map((id) => i18n._(LABELS[id])).join(' · ') : i18n._(EVENT_LOG_LABELS.none)}
								</p>
							)}
						</div>
					</SettingsSection>
					{!valid && (
						<p role="alert" className={styles.error}>
							{i18n._(LABELS.saveError)}
						</p>
					)}
					<div className={styles.actions}>
						<Button
							disabled={busy || !valid || (!dirty && saved.status !== 'owner_changed')}
							onClick={() => void save()}
						>
							{i18n._(TEXT.save)}
						</Button>
						<Button variant="secondary" disabled={busy || !dirty} onClick={reset}>
							{i18n._(TEXT.reset)}
						</Button>
						{error === 'conflict' && (
							<Button variant="secondary" disabled={busy} onClick={() => void load()}>
								{i18n._(TEXT.refresh)}
							</Button>
						)}
					</div>
				</>
			)}
			{!saved && !busy && (
				<Button variant="secondary" onClick={() => void load()}>
					{i18n._(TEXT.refresh)}
				</Button>
			)}
		</div>
	);
}
