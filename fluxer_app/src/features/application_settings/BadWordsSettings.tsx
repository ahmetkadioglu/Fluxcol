// SPDX-License-Identifier: AGPL-3.0-or-later

import {AUTO_MOD_COPY as COPY} from '@app/features/application_settings/AutoModCopy';
import {AutoModEntryList} from '@app/features/application_settings/AutoModEntryList';
import {
	AutoModCollapsibleSection,
	AutoModRuleSettings,
	type AutoModRuleSettingsProps,
} from '@app/features/application_settings/AutoModRuleSettings';
import styles from '@app/features/application_settings/BadWordsSettings.module.css';
import overviewStyles from '@app/features/guild/components/modals/guild_tabs/guild_overview_tab/GuildOverviewTab.module.css';
import {useLingui} from '@lingui/react/macro';

export interface BadWordsPending {
	exact: string;
	partial: string;
}
export function BadWordsSettings({
	pending,
	onPendingChange,
	...props
}: AutoModRuleSettingsProps & {
	pending: BadWordsPending;
	onPendingChange: (pending: BadWordsPending) => void;
}) {
	const {i18n} = useLingui();
	const {rule, onChange, busy} = props;
	return (
		<AutoModRuleSettings {...props} title={i18n._(COPY.bad_words)} dataFlx="application-settings.automod.bad-words">
			<AutoModCollapsibleSection title={i18n._(COPY.additional)}>
				<p className={overviewStyles.sectionDescription}>{i18n._(COPY.wordHint)}</p>
				<AutoModEntryList
					label={i18n._(COPY.exactWords)}
					value={rule.words}
					pending={pending.exact}
					onPendingChange={(exact) => onPendingChange({...pending, exact})}
					onChange={(words) => onChange({words})}
					disabled={busy}
				/>
				<AutoModEntryList
					label={i18n._(COPY.partialWords)}
					value={rule.partial_words}
					pending={pending.partial}
					onPendingChange={(partial) => onPendingChange({...pending, partial})}
					onChange={(partial_words) => onChange({partial_words})}
					disabled={busy}
				/>
				<div className={styles.examples}>
					<h3>{i18n._(COPY.howWorks)}</h3>
					<p className={overviewStyles.sectionDescription}>{i18n._(COPY.matchingHint)}</p>
					<div>
						<h4>{i18n._(COPY.exactWords)}</h4>
						<p className={styles.example}>
							<span>Hello world, </span>
							<mark>how</mark>
							<span> can I show my skill?</span>
						</p>
					</div>
					<div>
						<h4>{i18n._(COPY.partialWords)}</h4>
						<p className={styles.example}>
							<span>Hello world, s</span>
							<mark>how</mark>
							<span>case mode is active.</span>
						</p>
					</div>
				</div>
			</AutoModCollapsibleSection>
		</AutoModRuleSettings>
	);
}
