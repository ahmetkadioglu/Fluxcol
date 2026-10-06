// SPDX-License-Identifier: AGPL-3.0-or-later

import {AUTO_MOD_COPY as COPY} from '@app/features/application_settings/AutoModCopy';
import {
	AutoModCollapsibleSection,
	AutoModRuleSettings,
	type AutoModRuleSettingsProps,
} from '@app/features/application_settings/AutoModRuleSettings';
import overviewStyles from '@app/features/guild/components/modals/guild_tabs/guild_overview_tab/GuildOverviewTab.module.css';
import {Input} from '@app/features/ui/components/form/FormInput';
import {useLingui} from '@lingui/react/macro';

export function RepeatedTextSettings(props: AutoModRuleSettingsProps) {
	const {i18n} = useLingui();
	return (
		<AutoModRuleSettings
			{...props}
			title={i18n._(COPY.repeated_text)}
			dataFlx="application-settings.automod.repeated-text"
		>
			<AutoModCollapsibleSection title={i18n._(COPY.additional)}>
				<p className={overviewStyles.sectionDescription}>{i18n._(COPY.repeatCountHint)}</p>
				<Input
					type="number"
					label={i18n._(COPY.repeatThreshold)}
					min={1}
					max={1000}
					value={props.rule.threshold}
					disabled={props.busy}
					onChange={(event) => props.onChange({threshold: Number(event.target.value)})}
				/>
				<Input
					type="number"
					label={i18n._(COPY.window)}
					min={1}
					max={300}
					value={props.rule.window_seconds}
					disabled={props.busy}
					onChange={(event) => props.onChange({window_seconds: Number(event.target.value)})}
				/>
				<p className={overviewStyles.sectionDescription}>{i18n._(COPY.repeatWindowHint)}</p>
			</AutoModCollapsibleSection>
		</AutoModRuleSettings>
	);
}
