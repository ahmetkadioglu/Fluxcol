// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	type ApplicationSettingsModule,
	APPLICATION_SETTINGS_COPY as COPY,
	APPLICATION_SETTINGS_FIELDS as FIELDS,
	APPLICATION_SETTINGS_GROUPS as GROUPS,
	APPLICATION_SETTINGS_MODULES as MODULES,
} from '@app/features/application_settings/ApplicationSettingsCatalog';
import {APPLICATION_SETTINGS_DESCRIPTOR} from '@app/features/application_settings/ApplicationSettingsMessages';
import styles from '@app/features/application_settings/ApplicationSettingsPage.module.css';
import {AutoModHistory} from '@app/features/application_settings/AutoModHistory';
import {AutoModSettings} from '@app/features/application_settings/AutoModSettings';
import {EVENT_LOG_COPY} from '@app/features/application_settings/EventLogCopy';
import {EventLogHistory} from '@app/features/application_settings/EventLogHistory';
import {EventLogSettings} from '@app/features/application_settings/EventLogSettings';
import {SettingsSection} from '@app/features/guild/components/modals/guild_tabs/guild_overview_tab/components/GuildOverviewTabSettingsSection';
import overviewStyles from '@app/features/guild/components/modals/guild_tabs/guild_overview_tab/GuildOverviewTab.module.css';
import {remFromPx} from '@app/features/theme/layout/RemFromPx';
import {Input, Textarea} from '@app/features/ui/components/form/FormInput';
import {Switch} from '@app/features/ui/components/form/FormSwitch';
import FocusRing from '@app/features/ui/focus_ring/FocusRing';
import {CompactComboboxRow} from '@app/features/user/components/modals/tabs/components/CompactComboboxRow';
import {useLingui} from '@lingui/react/macro';
import {CaretRightIcon} from '@phosphor-icons/react';

const TEMPLATE_VALUES = {member: '{member}', count: '{count}', creator: '{creator}', url: '{url}'};
const NOOP = () => {};
const SELECT_FIELDS = new Set<keyof typeof FIELDS>([
	'channel',
	'voice',
	'category',
	'role',
	'roles',
	'exempt',
	'support',
	'period',
	'language',
	'timezone',
	'selection',
	'links',
	'invites',
	'repeated',
	'mistake',
	'actor',
	'daterange',
]);

export function ApplicationSettingsContent({
	module,
	communityName,
	onModuleSelect,
	guildId,
}: {
	module?: ApplicationSettingsModule;
	communityName: string;
	onModuleSelect: (moduleId: string) => void;
	guildId: string;
}) {
	const {i18n, t} = useLingui();
	if (module?.id === 'logs' || module?.id === 'audit' || module?.id === 'automod') {
		return (
			<div className={overviewStyles.container} data-flx="application-settings.content">
				{module.id === 'logs' ? (
					<EventLogSettings guildId={guildId} />
				) : module.id === 'automod' ? (
					<AutoModSettings guildId={guildId} />
				) : (
					<>
						<EventLogHistory guildId={guildId} />
						<AutoModHistory guildId={guildId} />
					</>
				)}
			</div>
		);
	}
	return (
		<div className={overviewStyles.container} data-flx="application-settings.content">
			{module ? (
				<>
					<div data-flx={`application-settings.module.${module.id}`}>
						<SettingsSection title={i18n._(module.title)} description={i18n._(module.description)}>
							<p className={overviewStyles.sectionDescription} data-flx="application-settings.preview-notice">
								<span data-flx="application-settings.module-status">{t`Not available yet`}</span>
								{'. '}
								{i18n._(COPY.previewNotice)}
							</p>
						</SettingsSection>
					</div>
					<SettingsSection title={i18n._(COPY.configuration)} description={i18n._(COPY.configurationDescription)}>
						<div className={overviewStyles.brandingContent} data-flx="application-settings.preview-fields">
							<Switch
								label={i18n._(COPY.enable)}
								description={i18n._(COPY.enableDescription)}
								value={false}
								onChange={NOOP}
								disabled
							/>
							{module.fields.map((fieldId) => {
								const field = FIELDS[fieldId];
								if (SELECT_FIELDS.has(fieldId)) {
									return (
										<CompactComboboxRow
											key={fieldId}
											label={i18n._(field.label)}
											value="preview"
											options={[{value: 'preview', label: i18n._(field.value, TEMPLATE_VALUES)}]}
											onChange={NOOP}
											disabled
											controlWidth="wide"
											className={styles.previewSelectRow}
											dataFlx={`application-settings.field.${fieldId}`}
										/>
									);
								}
								const Control = field.multiline ? Textarea : Input;
								return (
									<Control
										key={fieldId}
										label={i18n._(field.label)}
										value={i18n._(field.value, TEMPLATE_VALUES)}
										disabled
									/>
								);
							})}
						</div>
					</SettingsSection>
				</>
			) : (
				<>
					<SettingsSection
						title={i18n._(APPLICATION_SETTINGS_DESCRIPTOR)}
						description={t`Built-in community features for ${communityName}.`}
					>
						<p className={overviewStyles.sectionDescription} data-flx="application-settings.preview-notice">
							{i18n._(MODULES.find((item) => item.id === 'logs')!.title)} · AutoMod: {i18n._(EVENT_LOG_COPY.ready)}
						</p>
					</SettingsSection>
					{GROUPS.map((group) => (
						<SettingsSection key={group.id} id={`application-settings-group-${group.id}`} title={i18n._(group.title)}>
							<div className={styles.moduleList} data-flx={`application-settings.group.${group.id}`}>
								{MODULES.filter((item) => item.group === group.id).map((item) => (
									<FocusRing key={item.id} offset={-2}>
										<button
											type="button"
											className={styles.moduleRow}
											onClick={() => onModuleSelect(item.id)}
											data-flx={`application-settings.module-row.${item.id}`}
										>
											<span className={styles.moduleText} data-flx="application-settings.module-text">
												<span className={styles.moduleName} data-flx="application-settings.module-name">
													{i18n._(item.title)}
												</span>
												<span
													className={overviewStyles.sectionDescription}
													data-flx="application-settings.module-description"
												>
													{i18n._(item.description)}
												</span>
											</span>
											<span className={styles.moduleStatus} data-flx="application-settings.module-status">
												{item.id === 'logs' || item.id === 'audit' || item.id === 'automod'
													? i18n._(EVENT_LOG_COPY.ready)
													: t`Not available yet`}
											</span>
											<CaretRightIcon
												size={remFromPx(16)}
												weight="bold"
												className={styles.chevron}
												aria-hidden="true"
												data-flx="application-settings.module-arrow"
											/>
										</button>
									</FocusRing>
								))}
							</div>
						</SettingsSection>
					))}
				</>
			)}
		</div>
	);
}
