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
import {useId} from 'react';

export function CharacterLimitSettings(props: AutoModRuleSettingsProps) {
	const {i18n} = useLingui();
	const hintId = useId();
	return (
		<AutoModRuleSettings
			{...props}
			title={i18n._(COPY.character_limit)}
			dataFlx="application-settings.automod.character-limit"
		>
			<AutoModCollapsibleSection title={i18n._(COPY.additional)}>
				<Input
					type="number"
					label={i18n._(COPY.maximumCharacters)}
					min={1}
					max={10000}
					step={1}
					value={props.rule.threshold}
					disabled={props.busy}
					aria-describedby={hintId}
					onChange={(event) => props.onChange({threshold: Number(event.target.value)})}
				/>
				<p id={hintId} className={overviewStyles.sectionDescription}>
					{i18n._(COPY.characterLimitHint)}
				</p>
			</AutoModCollapsibleSection>
		</AutoModRuleSettings>
	);
}
