// SPDX-License-Identifier: AGPL-3.0-or-later

import {AUTO_MOD_COPY as COPY} from '@app/features/application_settings/AutoModCopy';
import {
	AutoModCollapsibleSection,
	AutoModRuleSettings,
	type AutoModRuleSettingsProps,
} from '@app/features/application_settings/AutoModRuleSettings';
import overviewStyles from '@app/features/guild/components/modals/guild_tabs/guild_overview_tab/GuildOverviewTab.module.css';
import {Input} from '@app/features/ui/components/form/FormInput';
import {Switch} from '@app/features/ui/components/form/FormSwitch';
import {useLingui} from '@lingui/react/macro';
import {useId} from 'react';

export function AntiAbuseSettings(props: AutoModRuleSettingsProps & {id: 'anti_raid' | 'anti_nuke'}) {
	const {i18n} = useLingui();
	const prefix = useId();
	const raid = props.id === 'anti_raid';
	const numberValue = (value: number) => (Number.isNaN(value) ? '' : value);
	const parse = (value: string) => (value === '' ? Number.NaN : Number(value));
	return (
		<AutoModRuleSettings
			{...props}
			title={i18n._(COPY[props.id])}
			dataFlx={`application-settings.automod.${raid ? 'anti-raid' : 'anti-nuke'}`}
			showPermissions={false}
		>
			<AutoModCollapsibleSection title={i18n._(COPY.additional)}>
				<p id={`${prefix}-hint`} className={overviewStyles.sectionDescription}>
					{i18n._(raid ? COPY.raidHint : COPY.nukeHint)}
				</p>
				<Input
					type="number"
					label={i18n._(raid ? COPY.joinLimit : COPY.actionLimit)}
					min={1}
					max={1000}
					step={1}
					value={numberValue(props.rule.threshold)}
					disabled={props.busy}
					aria-describedby={`${prefix}-hint`}
					onChange={(event) => props.onChange({threshold: parse(event.target.value)})}
				/>
				<Input
					type="number"
					label={i18n._(COPY.window)}
					min={1}
					max={300}
					step={1}
					value={numberValue(props.rule.window_seconds)}
					disabled={props.busy}
					aria-describedby={`${prefix}-hint`}
					onChange={(event) => props.onChange({window_seconds: parse(event.target.value)})}
				/>
				{raid ? (
					<Input
						type="number"
						label={i18n._(COPY.newAccountDays)}
						min={0}
						max={365}
						step={1}
						value={numberValue(props.rule.new_account_days)}
						disabled={props.busy}
						aria-describedby={`${prefix}-hint`}
						onChange={(event) => props.onChange({new_account_days: parse(event.target.value)})}
					/>
				) : (
					<Switch
						label={i18n._(COPY.logOnly)}
						description={i18n._(COPY.logOnlyHint)}
						value={props.rule.log_only}
						disabled={props.busy}
						onChange={(log_only) => props.onChange({log_only})}
					/>
				)}
				<p className={overviewStyles.sectionDescription}>{i18n._(COPY.protectionHint)}</p>
			</AutoModCollapsibleSection>
		</AutoModRuleSettings>
	);
}
