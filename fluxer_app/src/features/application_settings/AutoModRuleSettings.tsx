// SPDX-License-Identifier: AGPL-3.0-or-later

import {AUTO_MOD_COPY as COPY} from '@app/features/application_settings/AutoModCopy';
import {AutoModPermissions} from '@app/features/application_settings/AutoModPermissions';
import styles from '@app/features/application_settings/BadWordsSettings.module.css';
import {SettingsSection} from '@app/features/guild/components/modals/guild_tabs/guild_overview_tab/components/GuildOverviewTabSettingsSection';
import overviewStyles from '@app/features/guild/components/modals/guild_tabs/guild_overview_tab/GuildOverviewTab.module.css';
import {Button} from '@app/features/ui/button/Button';
import {Switch} from '@app/features/ui/components/form/FormSwitch';
import FocusRing from '@app/features/ui/focus_ring/FocusRing';
import {
	type AutoModRule,
	type AutoModSettingsResponse,
	sharedAutoModPermissions,
} from '@fluxer/schema/src/domains/guild/GuildAutoModSchemas';
import {useLingui} from '@lingui/react/macro';
import {ArrowLeftIcon, CaretDownIcon, CaretUpIcon} from '@phosphor-icons/react';
import {type ReactNode, useEffect, useId, useRef, useState} from 'react';

export function AutoModCollapsibleSection({
	title,
	children,
	initiallyOpen = true,
}: {
	title: string;
	children: ReactNode;
	initiallyOpen?: boolean;
}) {
	const [open, setOpen] = useState(initiallyOpen);
	const id = useId();
	return (
		<SettingsSection
			title={
				<FocusRing>
					<button
						type="button"
						className={styles.sectionToggle}
						aria-expanded={open}
						aria-controls={id}
						onClick={() => setOpen(!open)}
					>
						{title}
						{open ? <CaretUpIcon size={16} aria-hidden="true" /> : <CaretDownIcon size={16} aria-hidden="true" />}
					</button>
				</FocusRing>
			}
		>
			<div id={id} hidden={!open}>
				<div className={styles.sectionContent}>{children}</div>
			</div>
		</SettingsSection>
	);
}

export interface AutoModRuleSettingsProps {
	rule: AutoModRule;
	available: AutoModSettingsResponse;
	onChange: (patch: Partial<AutoModRule>) => void;
	onBack: () => void;
	onDiscard: () => void;
	onSaveClose: () => void;
	busy: boolean;
	valid: boolean;
	error: ReactNode;
}

export function AutoModRuleSettings({
	title,
	dataFlx,
	rule,
	available,
	onChange,
	onBack,
	onDiscard,
	onSaveClose,
	busy,
	valid,
	error,
	children,
	showPermissions = true,
}: AutoModRuleSettingsProps & {
	title: string;
	dataFlx: string;
	children: ReactNode;
	showPermissions?: boolean;
}) {
	const {i18n} = useLingui();
	const heading = useRef<HTMLHeadingElement>(null);
	useEffect(() => {
		heading.current?.focus();
	}, []);
	return (
		<div className={styles.page} data-flx={dataFlx} aria-busy={busy}>
			<header className={styles.header}>
				<div className={styles.heading}>
					<Button
						variant="ghost"
						square
						icon={<ArrowLeftIcon size={18} aria-hidden="true" />}
						aria-label={i18n._(COPY.back)}
						disabled={busy}
						onClick={onBack}
					/>
					<h2 ref={heading} tabIndex={-1}>
						{title}
					</h2>
				</div>
				<div className={styles.actions}>
					<Button variant="secondary" disabled={busy} onClick={onDiscard}>
						{i18n._(COPY.discard)}
					</Button>
					<Button disabled={busy || !valid} submitting={busy} onClick={onSaveClose}>
						{i18n._(COPY.saveClose)}
					</Button>
				</div>
			</header>
			{error}
			{showPermissions && (
				<AutoModCollapsibleSection title={i18n._(COPY.permissions)}>
					{rule.permissions === null && <p className={overviewStyles.sectionDescription}>{i18n._(COPY.inherited)}</p>}
					<Switch
						label={i18n._(COPY.separate)}
						value={rule.permissions !== null}
						disabled={busy}
						onChange={(separate) =>
							onChange({
								permissions: separate ? structuredClone(sharedAutoModPermissions(available.settings)) : null,
							})
						}
					/>
					<AutoModPermissions
						value={rule.permissions ?? sharedAutoModPermissions(available.settings)}
						available={available}
						disabled={busy || rule.permissions === null}
						onChange={(permissions) => onChange({permissions})}
					/>
				</AutoModCollapsibleSection>
			)}
			{children}
		</div>
	);
}
