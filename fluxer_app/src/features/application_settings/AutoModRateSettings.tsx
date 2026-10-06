// SPDX-License-Identifier: AGPL-3.0-or-later

import {AUTO_MOD_COPY as COPY} from '@app/features/application_settings/AutoModCopy';
import styles from '@app/features/application_settings/AutoModRateSettings.module.css';
import {
	AutoModCollapsibleSection,
	AutoModRuleSettings,
	type AutoModRuleSettingsProps,
} from '@app/features/application_settings/AutoModRuleSettings';
import overviewStyles from '@app/features/guild/components/modals/guild_tabs/guild_overview_tab/GuildOverviewTab.module.css';
import {Slider} from '@app/features/ui/components/Slider';
import {AUTO_MOD_DEFAULT_THRESHOLDS, AUTO_MOD_MAX_WINDOW_SECONDS} from '@fluxer/constants/src/AutoModConstants';
import {useLingui} from '@lingui/react/macro';
import {useId, useState} from 'react';

export function AutoModRateSettings(props: AutoModRuleSettingsProps & {id: 'anti_spam' | 'media_spam'}) {
	const {i18n} = useLingui();
	const prefix = useId();
	// Existing records may have a higher limit; opening this page must not clamp it.
	const [limitMax] = useState(() => Math.max(100, props.rule.threshold));
	const [windowMin] = useState(() => Math.min(props.id === 'media_spam' ? 5 : 1, props.rule.window_seconds));
	const media = props.id === 'media_spam';
	const format = (value: number) => i18n.number(value);
	return (
		<AutoModRuleSettings
			{...props}
			title={i18n._(COPY[props.id])}
			dataFlx={`application-settings.automod.${media ? 'media-spam' : 'anti-spam'}`}
		>
			<AutoModCollapsibleSection title={i18n._(COPY.additional)}>
				<div className={styles.control}>
					<div className={styles.label}>
						<span id={`${prefix}-limit`}>{i18n._(media ? COPY.mediaLimit : COPY.messageLimit)}</span>
						<span>{format(props.rule.threshold)}</span>
					</div>
					<Slider
						value={props.rule.threshold}
						defaultValue={AUTO_MOD_DEFAULT_THRESHOLDS[props.id]}
						factoryDefaultValue={AUTO_MOD_DEFAULT_THRESHOLDS[props.id]}
						minValue={1}
						maxValue={limitMax}
						step={1}
						markers={[1, limitMax]}
						ariaLabelledBy={`${prefix}-limit`}
						ariaValueText={format(props.rule.threshold)}
						onValueRender={format}
						onMarkerRender={format}
						disabled={props.busy}
						onValueChange={(threshold) => props.onChange({threshold})}
					/>
				</div>
				<div className={styles.control}>
					<div className={styles.label}>
						<span id={`${prefix}-window`}>{i18n._(COPY.window)}</span>
						<span>{format(props.rule.window_seconds)}</span>
					</div>
					<Slider
						value={props.rule.window_seconds}
						defaultValue={10}
						factoryDefaultValue={10}
						minValue={windowMin}
						maxValue={AUTO_MOD_MAX_WINDOW_SECONDS}
						step={1}
						markers={[windowMin, AUTO_MOD_MAX_WINDOW_SECONDS]}
						ariaLabelledBy={`${prefix}-window`}
						ariaValueText={format(props.rule.window_seconds)}
						onValueRender={format}
						onMarkerRender={format}
						disabled={props.busy}
						onValueChange={(window_seconds) => props.onChange({window_seconds})}
					/>
				</div>
				<p className={overviewStyles.sectionDescription}>{i18n._(media ? COPY.mediaSpamHint : COPY.spamHint)}</p>
			</AutoModCollapsibleSection>
		</AutoModRuleSettings>
	);
}
