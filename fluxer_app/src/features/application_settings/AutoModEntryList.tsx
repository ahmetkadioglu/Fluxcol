// SPDX-License-Identifier: AGPL-3.0-or-later

import {AUTO_MOD_COPY as COPY} from '@app/features/application_settings/AutoModCopy';
import styles from '@app/features/application_settings/BadWordsSettings.module.css';
import {Button} from '@app/features/ui/button/Button';
import {Input} from '@app/features/ui/components/form/FormInput';
import {useLingui} from '@lingui/react/macro';
import {XIcon} from '@phosphor-icons/react';
import {useId, useRef} from 'react';

export function mergeAutoModWords(entries: Array<string>, pending: string): Array<string> {
	return mergeAutoModEntries(entries, pending);
}
export function mergeAutoModEntries(entries: Array<string>, pending: string, caseSensitive = false): Array<string> {
	const seen = new Set<string>();
	return [...entries, ...pending.split(/[,\r\n]/u)]
		.map((word) => word.trim())
		.filter((word) => {
			const key = caseSensitive ? word : word.normalize('NFKC').toLocaleLowerCase('und');
			if (!key || seen.has(key)) return false;
			seen.add(key);
			return true;
		});
}

export function AutoModEntryList({
	label,
	value,
	pending,
	onPendingChange,
	onChange,
	disabled,
	maxEntries = 200,
	maxEntryLength = 100,
	caseSensitive = false,
	placeholder,
	hint,
	errorText,
	validate,
	showCount = false,
}: {
	label: string;
	value: Array<string>;
	pending: string;
	onPendingChange: (text: string) => void;
	onChange: (value: Array<string>) => void;
	disabled: boolean;
	maxEntries?: number;
	maxEntryLength?: number;
	caseSensitive?: boolean;
	placeholder?: string;
	hint?: string;
	errorText?: string;
	validate?: (entries: Array<string>) => boolean;
	showCount?: boolean;
}) {
	const {i18n} = useLingui();
	const input = useRef<HTMLInputElement>(null);
	const hintId = useId();
	const combined = mergeAutoModEntries(value, pending, caseSensitive);
	const validEntries = (entries: Array<string>) =>
		entries.length <= maxEntries &&
		entries.every((entry) => entry.length <= maxEntryLength) &&
		(!validate || validate(entries));
	const invalid = !validEntries(combined);
	const commit = () => {
		if (invalid) return;
		onChange(combined);
		onPendingChange('');
	};
	return (
		<div className={styles.entryList}>
			<Input
				ref={input}
				label={label}
				placeholder={placeholder ?? i18n._(COPY.addWord)}
				value={pending}
				disabled={disabled}
				maxLength={(maxEntryLength + 1) * maxEntries}
				aria-invalid={invalid || undefined}
				aria-describedby={hint ? hintId : undefined}
				onChange={(event) => {
					const text = event.target.value;
					if (/[,\r\n]/u.test(text) && !(event.nativeEvent instanceof InputEvent && event.nativeEvent.isComposing)) {
						const parts = text.split(/[,\r\n]/u);
						const tail = parts.pop() ?? '';
						const next = mergeAutoModEntries(value, parts.join(','), caseSensitive);
						if (validEntries(next)) {
							onChange(next);
							onPendingChange(tail);
							return;
						}
					}
					onPendingChange(text);
				}}
				onBlur={commit}
				onKeyDown={(event) => {
					if ((event.key === 'Enter' || event.key === ',') && !event.nativeEvent.isComposing) {
						event.preventDefault();
						commit();
					}
				}}
			/>
			{hint && (
				<p id={hintId} className={styles.entryHint}>
					{hint}
				</p>
			)}
			{showCount && <p role="status" className={styles.entryCount}>{`${combined.length}/${maxEntries}`}</p>}
			{value.length > 0 && (
				<ul className={styles.entries} aria-label={label}>
					{value.map((word) => (
						<li key={word}>
							<Button
								variant="secondary"
								small
								disabled={disabled}
								aria-label={`${i18n._(COPY.remove)}: ${word}`}
								rightIcon={<XIcon size={12} aria-hidden="true" />}
								onClick={() => {
									onChange(value.filter((entry) => entry !== word));
									input.current?.focus();
								}}
							>
								{word}
							</Button>
						</li>
					))}
				</ul>
			)}
			{invalid && (
				<p className={styles.error} role="alert">
					{errorText ?? i18n._(COPY.wordHint)}
				</p>
			)}
		</div>
	);
}
