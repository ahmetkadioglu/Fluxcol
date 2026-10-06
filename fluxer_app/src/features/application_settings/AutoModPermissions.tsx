// SPDX-License-Identifier: AGPL-3.0-or-later

import {AUTO_MOD_COPY as COPY} from '@app/features/application_settings/AutoModCopy';
import styles from '@app/features/application_settings/BadWordsSettings.module.css';
import overviewStyles from '@app/features/guild/components/modals/guild_tabs/guild_overview_tab/GuildOverviewTab.module.css';
import {Button} from '@app/features/ui/button/Button';
import {Combobox} from '@app/features/ui/components/form/FormCombobox';
import {Input} from '@app/features/ui/components/form/FormInput';
import {RadioGroup} from '@app/features/ui/radio_group/RadioGroup';
import type {
	AutoModSettingsResponse,
	AutoModPermissions as Permissions,
} from '@fluxer/schema/src/domains/guild/GuildAutoModSchemas';
import {useLingui} from '@lingui/react/macro';
import {XIcon} from '@phosphor-icons/react';
import {useId, useRef, useState} from 'react';

const KINDS = ['users', 'roles', 'channels', 'categories'] as const;

export function AutoModPermissions({
	value,
	onChange,
	available,
	disabled,
}: {
	value: Permissions;
	onChange: (permissions: Permissions) => void;
	available: AutoModSettingsResponse;
	disabled: boolean;
}) {
	const {i18n} = useLingui();
	const prefix = useId();
	const [userId, setUserId] = useState('');
	const input = useRef<HTMLInputElement>(null);
	const add = () => {
		const id = userId.trim();
		if (!/^[1-9][0-9]{0,19}$/u.test(id) || value.users.ids.length >= 100) return;
		onChange({...value, users: {...value.users, ids: [...new Set([...value.users.ids, id])]}});
		setUserId('');
		input.current?.focus();
	};
	return (
		<div className={styles.permissions}>
			{KINDS.map((kind) => (
				<div key={kind} className={styles.permission} role="group" aria-labelledby={`${prefix}-${kind}`}>
					<h3 id={`${prefix}-${kind}`}>{i18n._(COPY[kind])}</h3>
					{kind === 'users' && <p className={overviewStyles.sectionDescription}>{i18n._(COPY.userPriority)}</p>}
					<RadioGroup
						aria-label={i18n._(COPY[kind])}
						value={value[kind].mode}
						disabled={disabled}
						options={[
							{value: 'exclude' as const, name: i18n._(COPY.allExcept)},
							{value: 'include' as const, name: i18n._(COPY.onlySelected)},
						]}
						onChange={(mode) => onChange({...value, [kind]: {...value[kind], mode}})}
					/>
					{kind === 'users' ? (
						<>
							<div className={styles.userInput}>
								<Input
									ref={input}
									label={i18n._(COPY.userId)}
									value={userId}
									maxLength={20}
									inputMode="numeric"
									disabled={disabled}
									onChange={(event) => setUserId(event.target.value)}
									onKeyDown={(event) => {
										if (event.key === 'Enter') {
											event.preventDefault();
											add();
										}
									}}
								/>
								<Button
									variant="secondary"
									disabled={disabled || !/^[1-9][0-9]{0,19}$/u.test(userId.trim()) || value.users.ids.length >= 100}
									onClick={add}
								>
									{i18n._(COPY.add)}
								</Button>
							</div>
							{value.users.ids.length > 0 && (
								<ul className={styles.entries} aria-label={i18n._(COPY.users)}>
									{value.users.ids.map((id) => (
										<li key={id}>
											<Button
												small
												variant="secondary"
												disabled={disabled}
												aria-label={`${i18n._(COPY.remove)}: ${id}`}
												rightIcon={<XIcon size={12} aria-hidden="true" />}
												onClick={() => {
													onChange({
														...value,
														users: {...value.users, ids: value.users.ids.filter((entry) => entry !== id)},
													});
													input.current?.focus();
												}}
											>
												{id}
											</Button>
										</li>
									))}
								</ul>
							)}
						</>
					) : (
						<Combobox<string, true>
							aria-label={i18n._(COPY[kind])}
							value={value[kind].ids}
							isMulti
							disabled={disabled}
							options={(kind === 'channels'
								? available.scope_channels.length
									? available.scope_channels
									: available.channels
								: available[kind]
							).map((entry) => ({value: entry.id, label: `${kind === 'channels' ? '#' : ''}${entry.name}`}))}
							onChange={(ids) => onChange({...value, [kind]: {...value[kind], ids}})}
						/>
					)}
				</div>
			))}
		</div>
	);
}
