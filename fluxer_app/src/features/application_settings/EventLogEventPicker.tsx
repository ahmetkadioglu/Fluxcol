// SPDX-License-Identifier: AGPL-3.0-or-later

import {APPLICATION_SETTINGS_MODULES} from '@app/features/application_settings/ApplicationSettingsCatalog';
import styles from '@app/features/application_settings/ApplicationSettingsPage.module.css';
import {EVENT_LOG_LABELS as LABELS} from '@app/features/application_settings/EventLogCatalogCopy';
import {SettingsSection} from '@app/features/guild/components/modals/guild_tabs/guild_overview_tab/components/GuildOverviewTabSettingsSection';
import overviewStyles from '@app/features/guild/components/modals/guild_tabs/guild_overview_tab/GuildOverviewTab.module.css';
import {Button} from '@app/features/ui/button/Button';
import {Checkbox} from '@app/features/ui/checkbox/Checkbox';
import {Input} from '@app/features/ui/components/form/FormInput';
import {Tabs} from '@app/features/ui/tabs/Tabs';
import {CompactComboboxRow} from '@app/features/user/components/modals/tabs/components/CompactComboboxRow';
import {
	EVENT_LOG_CATALOG,
	EVENT_LOG_CATEGORIES,
	type EventLogCategory,
	eventLogAvailable,
	eventLogChannel,
} from '@fluxer/constants/src/EventLogConstants';
import type {EventLogSettings, EventLogSettingsResponse} from '@fluxer/schema/src/domains/guild/GuildEventLogSchemas';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {useId, useMemo, useState} from 'react';

const NO_RESULTS = msg({message: 'No results found'});
const EVENT_LOGS_TITLE = APPLICATION_SETTINGS_MODULES.find((module) => module.id === 'logs')!.title;

export function EventLogEventPicker({
	draft,
	channels,
	busy,
	onChange,
}: {
	draft: EventLogSettings;
	channels: EventLogSettingsResponse['channels'];
	busy: boolean;
	onChange: (draft: EventLogSettings) => void;
}) {
	const {i18n} = useLingui();
	const [search, setSearch] = useState('');
	const [selectedCategory, setSelectedCategory] = useState<EventLogCategory>('members');
	const tabsId = useId();
	const available = useMemo(() => EVENT_LOG_CATALOG.filter((event) => eventLogAvailable(event.id)), []);
	const query = search.trim().toLocaleLowerCase(i18n.locale);
	const visibleCategories = EVENT_LOG_CATEGORIES.filter((category) => {
		const categoryLabel = i18n._(LABELS[`category_${category}`]);
		return EVENT_LOG_CATALOG.some(
			(event) =>
				event.category === category &&
				`${categoryLabel} ${i18n._(LABELS[event.id])}`.toLocaleLowerCase(i18n.locale).includes(query),
		);
	});
	const activeCategory = visibleCategories.includes(selectedCategory) ? selectedCategory : visibleCategories[0];
	const options = [
		{value: null, label: i18n._(LABELS.inherit)},
		...channels.map((channel) => ({value: channel.id, label: `#${channel.name}`})),
	];
	return (
		<div className={styles.logCatalog}>
			<Input
				label={i18n._(LABELS.search)}
				type="search"
				value={search}
				onChange={(event) => setSearch(event.target.value)}
				disabled={busy}
			/>
			<div className={styles.liveActions}>
				<Button
					variant="secondary"
					disabled={busy}
					onClick={() => onChange({...draft, events: available.map((event) => event.id)})}
				>
					{i18n._(LABELS.selectAll)}
				</Button>
				<Button variant="secondary" disabled={busy} onClick={() => onChange({...draft, events: []})}>
					{i18n._(LABELS.clear)}
				</Button>
			</div>
			{activeCategory ? (
				<Tabs
					tabs={visibleCategories.map((category) => ({key: category, label: i18n._(LABELS[`category_${category}`])}))}
					activeTab={activeCategory}
					onTabChange={setSelectedCategory}
					ariaLabel={i18n._(EVENT_LOGS_TITLE)}
					idPrefix={tabsId}
					className={styles.logCategoryTabs}
				/>
			) : (
				<p role="status" className={overviewStyles.sectionDescription}>
					{i18n._(NO_RESULTS)}
				</p>
			)}
			{visibleCategories.map((category) => {
				if (category !== activeCategory)
					return (
						<div
							key={category}
							role="tabpanel"
							id={`${tabsId}-panel-${category}`}
							aria-labelledby={`${tabsId}-tab-${category}`}
							hidden
						/>
					);
				const all = available.filter((event) => event.category === category);
				const selected = all.filter((event) => draft.events.includes(event.id)).length;
				const categoryLabel = i18n._(LABELS[`category_${category}`]);
				const events = EVENT_LOG_CATALOG.filter(
					(event) =>
						event.category === category &&
						`${categoryLabel} ${i18n._(LABELS[event.id])}`.toLocaleLowerCase(i18n.locale).includes(query),
				);
				if (!events.length) return null;
				return (
					<div
						key={category}
						role="tabpanel"
						id={`${tabsId}-panel-${category}`}
						aria-labelledby={`${tabsId}-tab-${category}`}
					>
						<SettingsSection title={categoryLabel}>
							<div className={styles.logCategoryControls}>
								<Checkbox
									checked={selected === all.length}
									indeterminate={selected > 0 && selected < all.length}
									disabled={busy}
									onChange={(checked) =>
										onChange({
											...draft,
											events: checked
												? [...new Set([...draft.events, ...all.map((event) => event.id)])]
												: draft.events.filter((id) => !all.some((event) => event.id === id)),
										})
									}
								>
									{categoryLabel}
								</Checkbox>
								<CompactComboboxRow
									dataFlx="application-settings.event-logs.target"
									label={`${categoryLabel} · ${i18n._(LABELS.destination)}`}
									value={draft.category_channels?.[category] ?? null}
									options={options}
									onChange={(channel) =>
										onChange({...draft, category_channels: {...draft.category_channels, [category]: channel}})
									}
									disabled={busy}
									controlWidth="wide"
									className={styles.previewSelectRow}
								/>
							</div>
							{events.map((event) => {
								const unsupported = !eventLogAvailable(event.id);
								const target = eventLogChannel(draft, event.id);
								const targetName = channels.find((channel) => channel.id === target)?.name;
								return (
									<div key={event.id} className={styles.logEventRow}>
										<Checkbox
											checked={draft.events.includes(event.id)}
											disabled={busy || unsupported}
											onChange={(checked) =>
												onChange({
													...draft,
													events: checked ? [...draft.events, event.id] : draft.events.filter((id) => id !== event.id),
												})
											}
										>
											{i18n._(LABELS[event.id])}
										</Checkbox>
										{unsupported ? (
											<p className={overviewStyles.sectionDescription}>{i18n._(LABELS.unavailable)}</p>
										) : (
											<CompactComboboxRow
												dataFlx="application-settings.event-logs.target"
												label={`${i18n._(LABELS[event.id])} · ${i18n._(LABELS.destination)}`}
												value={draft.event_channels?.[event.id] ?? null}
												options={[
													{value: null, label: `${i18n._(LABELS.inherit)}${targetName ? ` · #${targetName}` : ''}`},
													...options.slice(1),
												]}
												disabled={busy}
												onChange={(channel) =>
													onChange({...draft, event_channels: {...draft.event_channels, [event.id]: channel}})
												}
												controlWidth="wide"
												className={styles.previewSelectRow}
											/>
										)}
									</div>
								);
							})}
						</SettingsSection>
					</div>
				);
			})}
		</div>
	);
}
