// @vitest-environment happy-dom
// SPDX-License-Identifier: AGPL-3.0-or-later

import {AutoModSettings} from '@app/features/application_settings/AutoModSettings';
import UnsavedChanges from '@app/features/ui/state/UnsavedChanges';
import {defaultAutoModPermissions, defaultAutoModSettings} from '@fluxer/schema/src/domains/guild/GuildAutoModSchemas';
import {act, type ButtonHTMLAttributes, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
const transport = vi.hoisted(() => ({
	get: vi.fn(),
	put: vi.fn(),
	post: vi.fn(),
}));
vi.mock('@app/features/platform/transport/RestTransport', () => ({
	http: transport,
}));
vi.mock('@lingui/core/macro', () => ({msg: (value: object) => value}));
vi.mock('@lingui/react/macro', () => ({
	useLingui: () => ({
		i18n: {_: (value: {message: string}) => value.message, number: (value: number) => String(value), locale: 'en-US'},
	}),
}));
vi.mock('@app/features/application_settings/EventLogSettings', () => ({
	eventLogTabId: (id: string) => `application-settings-event-logs:${id}`,
}));
vi.mock(
	'@app/features/guild/components/modals/guild_tabs/guild_overview_tab/components/GuildOverviewTabSettingsSection',
	() => ({
		SettingsSection: ({children, title}: {children: ReactNode; title: string}) => (
			<section>
				<h2>{title}</h2>
				{children}
			</section>
		),
	}),
);
vi.mock('@app/features/ui/components/Spinner', () => ({
	Spinner: () => <span>Loading</span>,
}));
vi.mock('@app/features/ui/components/Slider', () => ({
	Slider: ({
		value,
		minValue,
		maxValue,
		step,
		disabled,
		ariaLabelledBy,
		onValueChange,
	}: {
		value: number;
		minValue: number;
		maxValue: number;
		step: number;
		disabled: boolean;
		ariaLabelledBy: string;
		onValueChange: (value: number) => void;
	}) => (
		<input
			type="range"
			value={value}
			min={minValue}
			max={maxValue}
			step={step}
			disabled={disabled}
			aria-labelledby={ariaLabelledBy}
			onChange={(event) => onValueChange(Number(event.target.value))}
		/>
	),
}));
vi.mock('@app/features/ui/radio_group/RadioGroup', () => ({
	RadioGroup: ({
		options,
		value,
		onChange,
		disabled,
		'aria-label': label,
	}: {
		options: Array<{value: string; name: string}>;
		value: string;
		onChange: (value: string) => void;
		disabled: boolean;
		'aria-label': string;
	}) => (
		<div role="radiogroup" aria-label={label}>
			{options.map((option) => (
				<button
					type="button"
					role="radio"
					key={option.value}
					aria-checked={value === option.value}
					disabled={disabled}
					onClick={() => onChange(option.value)}
				>
					{option.name}
				</button>
			))}
		</div>
	),
}));
vi.mock('@app/features/ui/button/Button', () => ({
	Button: ({
		children,
		variant: _variant,
		leftIcon: _icon,
		rightIcon: _right,
		small: _small,
		square: _square,
		icon: _squareIcon,
		submitting: _submitting,
		...props
	}: ButtonHTMLAttributes<HTMLButtonElement> & {
		variant?: string;
		leftIcon?: ReactNode;
		rightIcon?: ReactNode;
		icon?: ReactNode;
		small?: boolean;
		square?: boolean;
		submitting?: boolean;
	}) => (
		<button type="button" {...props}>
			{children}
		</button>
	),
}));
vi.mock('@app/features/ui/components/form/FormSwitch', () => ({
	Switch: ({
		label,
		value,
		onChange,
		disabled,
	}: {
		label: string;
		value: boolean;
		onChange: (value: boolean) => void;
		disabled: boolean;
	}) => (
		<button
			type="button"
			role="switch"
			aria-label={label}
			aria-checked={value}
			disabled={disabled}
			onClick={() => onChange(!value)}
		/>
	),
}));
vi.mock('@app/features/ui/components/form/FormCombobox', () => ({
	Combobox: ({
		label,
		value,
		options,
		onChange,
		disabled,
		isMulti,
		'aria-label': ariaLabel,
	}: {
		label?: string;
		value: string | Array<string>;
		options: Array<{value: string; label: string}>;
		onChange: (value: string | Array<string>) => void;
		disabled: boolean;
		isMulti?: boolean;
		'aria-label'?: string;
	}) => (
		<select
			aria-label={ariaLabel ?? label}
			value={value}
			multiple={isMulti}
			disabled={disabled}
			onChange={(event) =>
				onChange(isMulti ? Array.from(event.target.selectedOptions, (option) => option.value) : event.target.value)
			}
		>
			{options.map((option) => (
				<option key={option.value} value={option.value}>
					{option.label}
				</option>
			))}
		</select>
	),
}));
vi.mock('@app/features/user/components/modals/tabs/components/CompactComboboxRow', () => ({
	CompactComboboxRow: ({
		label,
		value,
		options,
		onChange,
	}: {
		label: string;
		value: string | null;
		options: Array<{value: string | null; label: string}>;
		onChange: (value: string | null) => void;
	}) => (
		<select aria-label={label} value={value ?? ''} onChange={(event) => onChange(event.target.value || null)}>
			{options.map((option) => (
				<option key={option.value ?? ''} value={option.value ?? ''}>
					{option.label}
				</option>
			))}
		</select>
	),
}));
vi.mock('@app/features/ui/components/form/FormInput', () => ({
	Input: ({label, ...props}: {label: string}) => (
		<label>
			{label}
			<input {...props} />
		</label>
	),
	Textarea: ({label, ...props}: {label: string}) => (
		<label>
			{label}
			<textarea {...props} />
		</label>
	),
}));
const response = {
	settings: defaultAutoModSettings(),
	revision: 0,
	status: 'disabled',
	channels: [{id: '400', name: 'general'}],
	roles: [{id: '500', name: 'trusted'}],
	categories: [{id: '600', name: 'Category'}],
	lockdown_until: 0,
};
let root: Root, container: HTMLDivElement;
beforeEach(() => {
	vi.clearAllMocks();
	transport.get.mockResolvedValue({body: structuredClone(response)});
	container = document.createElement('div');
	document.body.append(container);
	root = createRoot(container);
});
afterEach(async () => {
	await act(async () => root.unmount());
	container.remove();
});
async function render() {
	await act(async () => root.render(<AutoModSettings guildId="100" />));
}
function button(text: string) {
	return [...container.querySelectorAll<HTMLButtonElement>('button')].find((node) => node.textContent === text)!;
}
async function select(label: string, value: string) {
	await act(async () => {
		const node = container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
		node.value = value;
		node.dispatchEvent(new Event('change', {bubbles: true}));
	});
}
async function enter(label: string, value: string) {
	await act(async () => {
		const input = [...container.querySelectorAll<HTMLLabelElement>('label')]
			.find((node) => node.textContent === label)!
			.querySelector('input')!;
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
		input.dispatchEvent(new Event('input', {bubbles: true}));
		input.dispatchEvent(new Event('change', {bubbles: true}));
	});
}
async function openBadWords() {
	await act(async () =>
		container.querySelector<HTMLButtonElement>('button[aria-label="Bad words · Settings"]')!.click(),
	);
}
async function openRepeatedText() {
	await act(async () =>
		container.querySelector<HTMLButtonElement>('button[aria-label="Repeated text · Settings"]')!.click(),
	);
}
async function openServerInvites() {
	await act(async () =>
		container.querySelector<HTMLButtonElement>('button[aria-label="Server invites · Settings"]')!.click(),
	);
}
async function openExternalLinks() {
	await act(async () =>
		container.querySelector<HTMLButtonElement>('button[aria-label="External links · Settings"]')!.click(),
	);
}
async function openExcessiveCaps() {
	await act(async () =>
		container.querySelector<HTMLButtonElement>('button[aria-label="Excessive caps · Settings"]')!.click(),
	);
}
async function openCountRule(title: string) {
	await act(async () =>
		container.querySelector<HTMLButtonElement>(`button[aria-label="${title} · Settings"]`)!.click(),
	);
}
async function moveSpamSlider(index: number, value: number) {
	await act(async () => {
		const node = container.querySelectorAll<HTMLInputElement>('input[type="range"]')[index]!;
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, String(value));
		node.dispatchEvent(new Event('input', {bubbles: true}));
		node.dispatchEvent(new Event('change', {bubbles: true}));
	});
}
const countRules = [
	{
		id: 'character_limit',
		title: 'Character limit',
		slug: 'character-limit',
		label: 'Maximum characters',
		limit: 500,
		defaultLimit: 2000,
		hint: 'including spaces and line breaks',
	},
	{
		id: 'excessive_emojis',
		title: 'Excessive emojis',
		slug: 'excessive-emojis',
		label: 'Emoji limit',
		limit: 12,
		defaultLimit: 10,
		hint: 'joined emoji sequences count as one',
	},
	{
		id: 'excessive_spoilers',
		title: 'Excessive spoilers',
		slug: 'excessive-spoilers',
		label: 'Spoiler tags limit',
		limit: 7,
		defaultLimit: 5,
		hint: 'including multiline sections',
	},
	{
		id: 'excessive_mentions',
		title: 'Excessive mentions',
		slug: 'excessive-mentions',
		label: 'Mentions limit',
		limit: 7,
		defaultLimit: 5,
		hint: 'Repeating the same tag counts once',
	},
] as const;
const rateRules = [
	{id: 'anti_spam', title: 'Anti-spam', legacyWindow: 456, windowMin: 1, defaultWindowMin: 1},
	{id: 'media_spam', title: 'Media spam', legacyWindow: 2, windowMin: 2, defaultWindowMin: 5},
] as const;
const protectionRules = [
	{id: 'anti_raid', title: 'Anti Raid', label: 'Join limit', limit: 10, window: 60},
	{id: 'anti_nuke', title: 'Anti Nuke', label: 'Action limit', limit: 3, window: 30},
] as const;
describe('AutoMod configuration panel', () => {
	it('loads all fourteen controls without saving or performing moderation', async () => {
		await render();
		expect(container.querySelectorAll('[data-flx^="application-settings.automod.rule."]')).toHaveLength(14);
		expect(transport.get).toHaveBeenCalledWith('/guilds/100/application-settings/automod');
		expect(transport.put).not.toHaveBeenCalled();
		expect(transport.post).not.toHaveBeenCalled();
		expect(button('Save changes').disabled).toBe(true);
	});
	it('limits raid and nuke actions to observation or lockdown', async () => {
		await render();
		for (const label of ['Anti Raid', 'Anti Nuke']) {
			const node = container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
			expect([...node.options].map((option) => option.value)).toEqual(['disabled', 'observe', 'lockdown']);
		}
	});
	it('keeps invite and external-link domain exceptions separate', async () => {
		const configured = structuredClone(response);
		configured.settings.rules.server_invites.allowed_domains = ['fluxer.app'];
		configured.settings.rules.external_links.allowed_domains = ['example.org'];
		transport.get.mockResolvedValue({body: configured});
		await render();
		for (const [label, expected] of [
			['Server invites', 'fluxer.app'],
			['External links', 'example.org'],
		]) {
			const trigger = container.querySelector<HTMLButtonElement>(`button[aria-label="${label} · Settings"]`)!;
			await act(async () => trigger.click());
			const panel = container.querySelector(
				`[data-flx="application-settings.automod.${label === 'Server invites' ? 'server-invites' : 'external-links'}"]`,
			)!;
			expect(panel.querySelector('textarea')!.value).toBe(expected);
			await act(async () => button('Discard').click());
		}
	});
	it.each(protectionRules)(
		'$title opens a focused settings page without permission controls or writes',
		async ({id, title, label, limit, window}) => {
			const configured = structuredClone(response);
			configured.settings.rules[id].threshold = limit;
			configured.settings.rules[id].window_seconds = window;
			configured.settings.rules[id].permissions = defaultAutoModPermissions();
			configured.settings.rules[id].permissions!.users.ids = ['300'];
			transport.get.mockResolvedValue({body: configured});
			await render();
			await openCountRule(title);
			expect(document.activeElement?.textContent).toBe(title);
			expect(container.querySelectorAll('[role="radiogroup"]')).toHaveLength(0);
			const inputs = [...container.querySelectorAll<HTMLInputElement>('input[type="number"]')];
			expect(inputs.slice(0, 2).map((node) => [node.value, node.min, node.max, node.step])).toEqual([
				[String(limit), '1', '1000', '1'],
				[String(window), '1', '300', '1'],
			]);
			expect(container.textContent).toContain(label);
			if (id === 'anti_raid') expect(inputs[2]!.value).toBe('7');
			else expect(container.querySelector('[role="switch"]')!.getAttribute('aria-checked')).toBe('true');
			await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Back"]')!.click());
			expect(document.activeElement?.getAttribute('aria-label')).toBe(`${title} · Settings`);
			expect(transport.put).not.toHaveBeenCalled();
			expect(transport.post).not.toHaveBeenCalled();
		},
	);
	it.each(protectionRules)(
		'$title rejects invalid numbers, guards drafts and discards only detail edits',
		async ({id, title, label}) => {
			await render();
			await select(title, 'observe');
			await openCountRule(title);
			for (const value of ['', '0', '1.5', '1001']) {
				await enter(label, value);
				expect(button('Save & Close').disabled).toBe(true);
			}
			await enter(label, '1');
			for (const value of ['', '0', '1.5', '301']) {
				await enter('Time window (s)', value);
				expect(button('Save & Close').disabled).toBe(true);
			}
			await enter('Time window (s)', '1');
			expect(button('Save & Close').disabled).toBe(false);
			if (id === 'anti_raid') {
				for (const value of ['', '-1', '0.5', '366']) {
					await enter('New account days', value);
					expect(button('Save & Close').disabled).toBe(true);
				}
				await enter('New account days', '0');
				expect(button('Save & Close').disabled).toBe(false);
				await enter('New account days', '365');
			} else await act(async () => container.querySelector<HTMLButtonElement>('[role="switch"]')!.click());
			await enter(label, '1000');
			await enter('Time window (s)', '300');
			expect(button('Save & Close').disabled).toBe(false);
			const flash = UnsavedChanges.getFlashTrigger('application-settings-event-logs:100');
			await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Back"]')!.click());
			expect(UnsavedChanges.getFlashTrigger('application-settings-event-logs:100')).toBe(flash + 1);
			const event = new Event('beforeunload', {cancelable: true});
			window.dispatchEvent(event);
			expect(event.defaultPrevented).toBe(true);
			await act(async () => button('Discard').click());
			expect(container.querySelector<HTMLSelectElement>(`select[aria-label="${title}"]`)!.value).toBe('observe');
			await openCountRule(title);
			expect(container.querySelector<HTMLInputElement>('input[type="number"]')!.value).toBe(
				String(response.settings.rules[id].threshold),
			);
			expect(transport.put).not.toHaveBeenCalled();
		},
	);
	it.each(protectionRules)(
		'$title saves fields after conflict without enabling disabled rules or changing other settings',
		async ({id, title, label, limit, window}) => {
			const configured = structuredClone(response);
			configured.settings.rules[id].permissions = defaultAutoModPermissions();
			configured.settings.rules[id].permissions!.roles.ids = ['500'];
			transport.get.mockResolvedValue({body: configured});
			await render();
			await openCountRule(title);
			await enter(label, String(limit));
			await enter('Time window (s)', String(window));
			if (id === 'anti_raid') await enter('New account days', '0');
			else await act(async () => container.querySelector<HTMLButtonElement>('[role="switch"]')!.click());
			transport.put.mockRejectedValue({status: 409});
			await act(async () => button('Save & Close').click());
			expect(container.querySelector('[role="alert"]')!.textContent).toContain('changed elsewhere');
			expect(container.querySelector<HTMLInputElement>('input[type="number"]')!.value).toBe(String(limit));
			transport.put.mockImplementation(async (_url, {body}) => {
				const {revision, ...settings} = body;
				return {body: {...configured, settings, revision: revision + 1}};
			});
			await act(async () => button('Save & Close').click());
			const body = transport.put.mock.calls.at(-1)![1].body;
			expect(body.revision).toBe(0);
			expect(body.rules[id]).toEqual({
				...configured.settings.rules[id],
				threshold: limit,
				window_seconds: window,
				...(id === 'anti_raid' ? {new_account_days: 0} : {log_only: false}),
			});
			expect(body.rules[id].action).toBe('disabled');
			for (const [otherId, rule] of Object.entries(configured.settings.rules))
				if (otherId !== id) expect(body.rules[otherId]).toEqual(rule);
			expect(body.permissions).toEqual(configured.settings.permissions);
			expect(body.link_whitelist).toEqual(configured.settings.link_whitelist);
			expect(UnsavedChanges.hasUnsavedChanges('application-settings-event-logs:100')).toBe(false);
			expect(document.activeElement?.getAttribute('aria-label')).toBe(`${title} · Settings`);
		},
	);
	it('opens excessive caps with saved limits, explanatory labels and inherited scope without saving', async () => {
		const configured = structuredClone(response);
		configured.settings.rules.excessive_caps.minimum_length = 30;
		configured.settings.rules.excessive_caps.threshold = 85;
		configured.settings.permissions = defaultAutoModPermissions();
		configured.settings.permissions.roles.ids = ['500'];
		transport.get.mockResolvedValue({body: configured});
		await render();
		await openExcessiveCaps();
		expect(container.querySelector('[data-flx="application-settings.automod.excessive-caps"]')).not.toBeNull();
		expect(document.activeElement?.textContent).toBe('Excessive caps');
		const inputs = [...container.querySelectorAll<HTMLInputElement>('input[type="number"]')];
		expect(inputs.map((node) => node.value)).toEqual(['30', '85']);
		for (const input of inputs) {
			expect(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent).toContain(
				'percentage exceeds the limit',
			);
		}
		expect(container.querySelectorAll('[role="radiogroup"]')).toHaveLength(4);
		expect([...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')].every((node) => node.disabled)).toBe(
			true,
		);
		expect(container.querySelector<HTMLOptionElement>('select[aria-label="Roles"] option[value="500"]')!.selected).toBe(
			true,
		);
		expect(transport.put).not.toHaveBeenCalled();
		expect(transport.post).not.toHaveBeenCalled();
		await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Back"]')!.click());
		expect(document.activeElement?.getAttribute('aria-label')).toBe('Excessive caps · Settings');
	});
	it('guards excessive-caps drafts and discards only this rule while retaining earlier changes', async () => {
		await render();
		await select('Anti-spam', 'observe');
		await openExcessiveCaps();
		await enter('Minimum characters', '15');
		await enter('Maximum uppercase (%)', '80');
		await act(async () => container.querySelector<HTMLButtonElement>('button[role="switch"]')!.click());
		await select('Categories', '600');
		const flash = UnsavedChanges.getFlashTrigger('application-settings-event-logs:100');
		await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Back"]')!.click());
		expect(UnsavedChanges.getFlashTrigger('application-settings-event-logs:100')).toBe(flash + 1);
		const event = new Event('beforeunload', {cancelable: true});
		window.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
		await act(async () => button('Discard').click());
		expect(document.activeElement?.getAttribute('aria-label')).toBe('Excessive caps · Settings');
		expect(container.querySelector<HTMLSelectElement>('select[aria-label="Anti-spam"]')!.value).toBe('observe');
		await openExcessiveCaps();
		expect([...container.querySelectorAll<HTMLInputElement>('input[type="number"]')].map((node) => node.value)).toEqual(
			['10', '70'],
		);
		expect(container.querySelector('button[role="switch"]')!.getAttribute('aria-checked')).toBe('false');
		expect(transport.put).not.toHaveBeenCalled();
	});
	it('validates caps limits, keeps conflicting values, and persists the correct rule fields with its revision', async () => {
		await render();
		await openExcessiveCaps();
		for (const [label, value] of [
			['Minimum characters', ''],
			['Minimum characters', '-1'],
			['Minimum characters', '10001'],
			['Minimum characters', '1.5'],
			['Maximum uppercase (%)', '0'],
			['Maximum uppercase (%)', '101'],
			['Maximum uppercase (%)', '70.5'],
		]) {
			await enter(label!, value!);
			expect(button('Save & Close').disabled).toBe(true);
			await act(async () => button('Save & Close').click());
			expect(transport.put).not.toHaveBeenCalled();
			await enter('Minimum characters', '15');
			await enter('Maximum uppercase (%)', '70');
		}
		transport.put.mockRejectedValue({status: 409});
		await act(async () => button('Save & Close').click());
		expect(container.querySelector('[role="alert"]')!.textContent).toContain('changed elsewhere');
		expect(container.querySelector('[data-flx="application-settings.automod.excessive-caps"]')).not.toBeNull();
		expect([...container.querySelectorAll<HTMLInputElement>('input[type="number"]')].map((node) => node.value)).toEqual(
			['15', '70'],
		);
		transport.put.mockImplementation(async (_url, {body}) => {
			const {revision, ...settings} = body;
			return {body: {...response, settings, revision: revision + 1}};
		});
		await act(async () => button('Save & Close').click());
		const body = transport.put.mock.calls.at(-1)![1].body;
		expect(body.revision).toBe(0);
		expect(body.rules.excessive_caps).toEqual({
			...response.settings.rules.excessive_caps,
			minimum_length: 15,
		});
		expect(body.rules.repeated_text).toEqual(response.settings.rules.repeated_text);
		expect(body.link_whitelist).toEqual([]);
		expect(document.activeElement?.getAttribute('aria-label')).toBe('Excessive caps · Settings');
		expect(UnsavedChanges.hasUnsavedChanges('application-settings-event-logs:100')).toBe(false);
	});
	it('persists separate caps scope without changing other rules and can restore shared permissions', async () => {
		await render();
		await openExcessiveCaps();
		await act(async () => container.querySelector<HTMLButtonElement>('button[role="switch"]')!.click());
		await enter('User ID', '300');
		await act(async () => button('Add').click());
		const users = container.querySelector('[role="radiogroup"][aria-label="Users"]')!;
		await act(async () => (users.querySelectorAll('button')[1] as HTMLButtonElement).click());
		await select('Roles', '500');
		await select('Channels', '400');
		await select('Categories', '600');
		transport.put.mockImplementation(async (_url, {body}) => {
			const {revision, ...settings} = body;
			return {body: {...response, settings, revision: revision + 1}};
		});
		await act(async () => button('Save & Close').click());
		const body = transport.put.mock.calls[0]![1].body;
		expect(body.rules.excessive_caps.permissions).toEqual({
			users: {mode: 'include', ids: ['300']},
			roles: {mode: 'exclude', ids: ['500']},
			channels: {mode: 'exclude', ids: ['400']},
			categories: {mode: 'exclude', ids: ['600']},
		});
		expect(body.rules.bad_words).toEqual(response.settings.rules.bad_words);
		await openExcessiveCaps();
		await act(async () => container.querySelector<HTMLButtonElement>('button[role="switch"]')!.click());
		await act(async () => button('Save & Close').click());
		expect(transport.put.mock.calls.at(-1)![1].body.rules.excessive_caps.permissions).toBeNull();
		expect(transport.put.mock.calls.at(-1)![1].body.revision).toBe(1);
	});
	it('opens the permissions-only Zalgo screen with inherited scopes and returns focus without writing', async () => {
		const configured = structuredClone(response);
		configured.settings.rules.zalgo.threshold = 7;
		configured.settings.permissions = defaultAutoModPermissions();
		configured.settings.permissions.roles.ids = ['500'];
		transport.get.mockResolvedValue({body: configured});
		await render();
		await openCountRule('Zalgo text');
		const panel = container.querySelector('[data-flx="application-settings.automod.zalgo"]')!;
		expect(panel).not.toBeNull();
		expect(document.activeElement?.textContent).toBe('Zalgo text');
		expect(panel.querySelectorAll('input[type="number"]')).toHaveLength(0);
		expect(panel.textContent).not.toContain('Additional settings');
		expect(panel.querySelectorAll('[role="radiogroup"]')).toHaveLength(4);
		expect([...panel.querySelectorAll<HTMLButtonElement>('[role="radio"]')].every((node) => node.disabled)).toBe(true);
		expect(panel.querySelector<HTMLOptionElement>('select[aria-label="Roles"] option[value="500"]')!.selected).toBe(
			true,
		);
		expect(transport.put).not.toHaveBeenCalled();
		expect(transport.post).not.toHaveBeenCalled();
		await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Back"]')!.click());
		expect(document.activeElement?.getAttribute('aria-label')).toBe('Zalgo text · Settings');
	});
	it('protects and discards Zalgo scope changes while preserving earlier module drafts', async () => {
		await render();
		await select('Anti-spam', 'observe');
		await openCountRule('Zalgo text');
		await act(async () => container.querySelector<HTMLButtonElement>('button[role="switch"]')!.click());
		await select('Categories', '600');
		const flash = UnsavedChanges.getFlashTrigger('application-settings-event-logs:100');
		await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Back"]')!.click());
		expect(UnsavedChanges.getFlashTrigger('application-settings-event-logs:100')).toBe(flash + 1);
		const event = new Event('beforeunload', {cancelable: true});
		window.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
		await act(async () => button('Discard').click());
		expect(document.activeElement?.getAttribute('aria-label')).toBe('Zalgo text · Settings');
		expect(container.querySelector<HTMLSelectElement>('select[aria-label="Anti-spam"]')!.value).toBe('observe');
		await openCountRule('Zalgo text');
		expect(container.querySelector('button[role="switch"]')!.getAttribute('aria-checked')).toBe('false');
		expect(transport.put).not.toHaveBeenCalled();
	});
	it('saves Zalgo scopes with revisions, retains conflicts and its saved sensitivity, and restores inheritance', async () => {
		const configured = structuredClone(response);
		configured.settings.rules.zalgo.threshold = 7;
		transport.get.mockResolvedValue({body: configured});
		await render();
		await openCountRule('Zalgo text');
		await act(async () => container.querySelector<HTMLButtonElement>('button[role="switch"]')!.click());
		await enter('User ID', '300');
		await act(async () => button('Add').click());
		const users = container.querySelector('[role="radiogroup"][aria-label="Users"]')!;
		await act(async () => (users.querySelectorAll('button')[1] as HTMLButtonElement).click());
		await select('Roles', '500');
		await select('Channels', '400');
		await select('Categories', '600');
		transport.put.mockRejectedValue({status: 409});
		await act(async () => button('Save & Close').click());
		expect(container.querySelector('[role="alert"]')!.textContent).toContain('changed elsewhere');
		expect(container.querySelector('[data-flx="application-settings.automod.zalgo"]')).not.toBeNull();
		transport.put.mockImplementation(async (_url, {body}) => {
			const {revision, ...settings} = body;
			return {body: {...response, settings, revision: revision + 1}};
		});
		await act(async () => button('Save & Close').click());
		const body = transport.put.mock.calls.at(-1)![1].body;
		expect(body.revision).toBe(0);
		expect(body.rules.zalgo).toEqual({
			...configured.settings.rules.zalgo,
			permissions: {
				users: {mode: 'include', ids: ['300']},
				roles: {mode: 'exclude', ids: ['500']},
				channels: {mode: 'exclude', ids: ['400']},
				categories: {mode: 'exclude', ids: ['600']},
			},
		});
		for (const id of Object.keys(response.settings.rules).filter((id) => id !== 'zalgo')) {
			expect(body.rules[id]).toEqual(response.settings.rules[id as keyof typeof response.settings.rules]);
		}
		expect(body.link_whitelist).toEqual([]);
		expect(document.activeElement?.getAttribute('aria-label')).toBe('Zalgo text · Settings');
		expect(UnsavedChanges.hasUnsavedChanges('application-settings-event-logs:100')).toBe(false);
		await openCountRule('Zalgo text');
		await act(async () => container.querySelector<HTMLButtonElement>('button[role="switch"]')!.click());
		await act(async () => button('Save & Close').click());
		expect(transport.put.mock.calls.at(-1)![1].body.rules.zalgo.permissions).toBeNull();
		expect(transport.put.mock.calls.at(-1)![1].body.rules.zalgo.threshold).toBe(7);
		expect(transport.put.mock.calls.at(-1)![1].body.revision).toBe(1);
	});
	it.each(countRules)(
		'opens $title with the saved limit, accessible help and inherited scopes without writing',
		async ({id, title, slug, limit, hint}) => {
			const configured = structuredClone(response);
			configured.settings.rules[id].threshold = limit;
			configured.settings.permissions = defaultAutoModPermissions();
			configured.settings.permissions.roles.ids = ['500'];
			transport.get.mockResolvedValue({body: configured});
			await render();
			await openCountRule(title);
			expect(container.querySelector(`[data-flx="application-settings.automod.${slug}"]`)).not.toBeNull();
			expect(document.activeElement?.textContent).toBe(title);
			const input = container.querySelector<HTMLInputElement>('input[type="number"]')!;
			expect(input.value).toBe(String(limit));
			expect(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent).toContain(hint);
			expect(container.querySelectorAll('[role="radiogroup"]')).toHaveLength(4);
			expect([...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')].every((node) => node.disabled)).toBe(
				true,
			);
			expect(
				container.querySelector<HTMLOptionElement>('select[aria-label="Roles"] option[value="500"]')!.selected,
			).toBe(true);
			expect(transport.put).not.toHaveBeenCalled();
			expect(transport.post).not.toHaveBeenCalled();
			await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Back"]')!.click());
			expect(document.activeElement?.getAttribute('aria-label')).toBe(`${title} · Settings`);
		},
	);
	it.each(countRules)(
		'protects $title drafts and discards only this rule, retaining earlier changes and its existing default',
		async ({title, label, limit, defaultLimit}) => {
			await render();
			await select('Anti-spam', 'observe');
			await openCountRule(title);
			await enter(label, String(limit));
			await act(async () => container.querySelector<HTMLButtonElement>('button[role="switch"]')!.click());
			await select('Categories', '600');
			const flash = UnsavedChanges.getFlashTrigger('application-settings-event-logs:100');
			await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Back"]')!.click());
			expect(UnsavedChanges.getFlashTrigger('application-settings-event-logs:100')).toBe(flash + 1);
			const event = new Event('beforeunload', {cancelable: true});
			window.dispatchEvent(event);
			expect(event.defaultPrevented).toBe(true);
			await act(async () => button('Discard').click());
			expect(document.activeElement?.getAttribute('aria-label')).toBe(`${title} · Settings`);
			expect(container.querySelector<HTMLSelectElement>('select[aria-label="Anti-spam"]')!.value).toBe('observe');
			await openCountRule(title);
			expect(container.querySelector<HTMLInputElement>('input[type="number"]')!.value).toBe(String(defaultLimit));
			expect(container.querySelector('button[role="switch"]')!.getAttribute('aria-checked')).toBe('false');
			expect(transport.put).not.toHaveBeenCalled();
		},
	);
	it.each(countRules)(
		'validates $title limits, retains conflicts, saves separate scope with revisions and restores inheritance',
		async ({id, title, label, limit}) => {
			await render();
			await openCountRule(title);
			for (const value of ['', '0', '-1', '1.5', '10001']) {
				await enter(label, value);
				expect(button('Save & Close').disabled).toBe(true);
				await act(async () => button('Save & Close').click());
				expect(transport.put).not.toHaveBeenCalled();
			}
			for (const value of ['1', '10000', String(limit)]) {
				await enter(label, value);
				expect(button('Save & Close').disabled).toBe(false);
			}
			await act(async () => container.querySelector<HTMLButtonElement>('button[role="switch"]')!.click());
			await enter('User ID', '300');
			await act(async () => button('Add').click());
			const users = container.querySelector('[role="radiogroup"][aria-label="Users"]')!;
			await act(async () => (users.querySelectorAll('button')[1] as HTMLButtonElement).click());
			await select('Roles', '500');
			await select('Channels', '400');
			await select('Categories', '600');
			transport.put.mockRejectedValue({status: 409});
			await act(async () => button('Save & Close').click());
			expect(container.querySelector('[role="alert"]')!.textContent).toContain('changed elsewhere');
			expect(container.querySelector<HTMLInputElement>('input[type="number"]')!.value).toBe(String(limit));
			transport.put.mockImplementation(async (_url, {body}) => {
				const {revision, ...settings} = body;
				return {body: {...response, settings, revision: revision + 1}};
			});
			await act(async () => button('Save & Close').click());
			const body = transport.put.mock.calls.at(-1)![1].body;
			expect(body.revision).toBe(0);
			expect(body.rules[id]).toEqual({
				...response.settings.rules[id],
				threshold: limit,
				permissions: {
					users: {mode: 'include', ids: ['300']},
					roles: {mode: 'exclude', ids: ['500']},
					channels: {mode: 'exclude', ids: ['400']},
					categories: {mode: 'exclude', ids: ['600']},
				},
			});
			expect(body.rules.excessive_caps).toEqual(response.settings.rules.excessive_caps);
			expect(body.rules.bad_words).toEqual(response.settings.rules.bad_words);
			for (const other of countRules.filter((rule) => rule.id !== id)) {
				expect(body.rules[other.id]).toEqual(response.settings.rules[other.id]);
			}
			expect(body.link_whitelist).toEqual([]);
			expect(document.activeElement?.getAttribute('aria-label')).toBe(`${title} · Settings`);
			expect(UnsavedChanges.hasUnsavedChanges('application-settings-event-logs:100')).toBe(false);
			await openCountRule(title);
			await act(async () => container.querySelector<HTMLButtonElement>('button[role="switch"]')!.click());
			await act(async () => button('Save & Close').click());
			expect(transport.put.mock.calls.at(-1)![1].body.rules[id].permissions).toBeNull();
			expect(transport.put.mock.calls.at(-1)![1].body.rules[id].threshold).toBe(limit);
			expect(transport.put.mock.calls.at(-1)![1].body.revision).toBe(1);
		},
	);
	it.each(rateRules)(
		'$title preserves inherited permissions and legacy limits without saving',
		async ({id, title, legacyWindow, windowMin}) => {
			const configured = structuredClone(response);
			configured.settings.rules[id].threshold = 250;
			configured.settings.rules[id].window_seconds = legacyWindow;
			transport.get.mockResolvedValue({body: configured});
			await render();
			await openCountRule(title);
			expect(document.activeElement?.textContent).toBe(title);
			expect(
				container.querySelector(
					`[data-flx="application-settings.automod.${id === 'media_spam' ? 'media-spam' : 'anti-spam'}"]`,
				),
			).not.toBeNull();
			const sliders = container.querySelectorAll<HTMLInputElement>('input[type="range"]');
			expect([...sliders].map((node) => [node.value, node.min, node.max, node.step])).toEqual([
				['250', '1', '250', '1'],
				[String(legacyWindow), String(windowMin), '600', '1'],
			]);
			expect(container.querySelectorAll('[role="radiogroup"]')).toHaveLength(4);
			expect([...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')].every((node) => node.disabled)).toBe(
				true,
			);
			expect(container.textContent).toContain(
				id === 'media_spam' ? 'edits, links and emoji do not count' : 'edits do not count',
			);
			await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Back"]')!.click());
			expect(document.activeElement?.getAttribute('aria-label')).toBe(`${title} · Settings`);
			expect(transport.put).not.toHaveBeenCalled();
			expect(transport.post).not.toHaveBeenCalled();
		},
	);
	it.each(rateRules)('$title guards slider drafts and discards only changes made on this screen', async ({title}) => {
		await render();
		await select(title, 'observe');
		await openCountRule(title);
		await moveSpamSlider(0, 100);
		await moveSpamSlider(1, 600);
		await act(async () => container.querySelector<HTMLButtonElement>('button[role="switch"]')!.click());
		await select('Categories', '600');
		const flash = UnsavedChanges.getFlashTrigger('application-settings-event-logs:100');
		await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Back"]')!.click());
		expect(UnsavedChanges.getFlashTrigger('application-settings-event-logs:100')).toBe(flash + 1);
		const event = new Event('beforeunload', {cancelable: true});
		window.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
		await act(async () => button('Discard').click());
		expect(container.querySelector<HTMLSelectElement>(`select[aria-label="${title}"]`)!.value).toBe('observe');
		expect(document.activeElement?.getAttribute('aria-label')).toBe(`${title} · Settings`);
		await openCountRule(title);
		expect([...container.querySelectorAll<HTMLInputElement>('input[type="range"]')].map((node) => node.value)).toEqual([
			'5',
			'10',
		]);
		expect(container.querySelector<HTMLButtonElement>('button[role="switch"]')!.getAttribute('aria-checked')).toBe(
			'false',
		);
		expect(transport.put).not.toHaveBeenCalled();
	});
	it.each(rateRules)(
		'$title saves boundaries and four scopes with conflict recovery, then restores inheritance',
		async ({id, title, defaultWindowMin}) => {
			await render();
			await openCountRule(title);
			await moveSpamSlider(0, 1);
			await moveSpamSlider(1, defaultWindowMin);
			expect(button('Save & Close').disabled).toBe(false);
			await moveSpamSlider(0, 100);
			await moveSpamSlider(1, 600);
			await act(async () => container.querySelector<HTMLButtonElement>('button[role="switch"]')!.click());
			await enter('User ID', '300');
			await act(async () => button('Add').click());
			const users = container.querySelector('[role="radiogroup"][aria-label="Users"]')!;
			await act(async () => (users.querySelectorAll('button')[1] as HTMLButtonElement).click());
			await select('Roles', '500');
			await select('Channels', '400');
			await select('Categories', '600');
			transport.put.mockRejectedValue({status: 409});
			await act(async () => button('Save & Close').click());
			expect(container.querySelector('[role="alert"]')!.textContent).toContain('changed elsewhere');
			expect(
				[...container.querySelectorAll<HTMLInputElement>('input[type="range"]')].map((node) => node.value),
			).toEqual(['100', '600']);
			transport.put.mockImplementation(async (_url, {body}) => {
				const {revision, ...settings} = body;
				return {body: {...response, settings, revision: revision + 1}};
			});
			await act(async () => button('Save & Close').click());
			const body = transport.put.mock.calls.at(-1)![1].body;
			expect(body.revision).toBe(0);
			expect(body.rules[id]).toEqual({
				...response.settings.rules[id],
				threshold: 100,
				window_seconds: 600,
				permissions: {
					users: {mode: 'include', ids: ['300']},
					roles: {mode: 'exclude', ids: ['500']},
					channels: {mode: 'exclude', ids: ['400']},
					categories: {mode: 'exclude', ids: ['600']},
				},
			});
			for (const [otherId, rule] of Object.entries(response.settings.rules)) {
				if (otherId !== id) expect(body.rules[otherId]).toEqual(rule);
			}
			expect(body.link_whitelist).toEqual([]);
			expect(document.activeElement?.getAttribute('aria-label')).toBe(`${title} · Settings`);
			await openCountRule(title);
			await act(async () => container.querySelector<HTMLButtonElement>('button[role="switch"]')!.click());
			await act(async () => button('Save & Close').click());
			expect(transport.put.mock.calls.at(-1)![1].body.rules[id]).toEqual({
				...body.rules[id],
				permissions: null,
			});
			expect(transport.put.mock.calls.at(-1)![1].body.revision).toBe(1);
		},
	);
	it('saves revisions, clears dirty state, and resets unsaved rules', async () => {
		await render();
		await select('Anti-spam', 'observe');
		const settings = {
			...response.settings,
			rules: {
				...response.settings.rules,
				anti_spam: {...response.settings.rules.anti_spam, action: 'observe'},
			},
		};
		transport.put.mockResolvedValue({
			body: {...response, settings, revision: 1},
		});
		await act(async () => button('Save changes').click());
		expect(transport.put).toHaveBeenCalledWith('/guilds/100/application-settings/automod', {
			body: {...settings, revision: 0},
			mode: 'strict',
		});
		expect(UnsavedChanges.hasUnsavedChanges('application-settings-event-logs:100')).toBe(false);
		await select('Anti-spam', 'delete');
		await act(async () => button('Reset').click());
		expect(container.querySelector<HTMLSelectElement>('select[aria-label="Anti-spam"]')!.value).toBe('observe');
	});
	it('keeps a conflicting draft and protects it from navigation', async () => {
		await render();
		await select('Anti-spam', 'observe');
		transport.put.mockRejectedValue({status: 409});
		await act(async () => button('Save changes').click());
		expect(container.querySelector('[role="alert"]')!.textContent).toContain('changed elsewhere');
		const event = new Event('beforeunload', {cancelable: true});
		window.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
		expect(UnsavedChanges.hasUnsavedChanges('application-settings-event-logs:100')).toBe(true);
	});
	it('rejects an enabled word rule until a list has been provided', async () => {
		await render();
		await select('Bad words', 'delete');
		expect(button('Save changes').disabled).toBe(true);
		expect(container.querySelector('[role="alert"]')).not.toBeNull();
	});
	it('opens the dedicated screen, focuses its heading, and disables inherited scope editing', async () => {
		await render();
		await openBadWords();
		expect(container.querySelector('[data-flx="application-settings.automod.bad-words"]')).not.toBeNull();
		expect(document.activeElement?.textContent).toBe('Bad words');
		expect(container.querySelectorAll('[role="radiogroup"]')).toHaveLength(4);
		expect([...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')].every((node) => node.disabled)).toBe(
			true,
		);
		await act(async () => button('Discard').click());
		expect(document.activeElement?.getAttribute('aria-label')).toBe('Bad words · Settings');
	});
	it('commits comma-separated and Enter words, removes entries, and discards only this rule', async () => {
		await render();
		await select('Anti-spam', 'observe');
		await openBadWords();
		await enter('Bad words (exact match)', 'first,SECOND,');
		await enter('Bad words (match any part)', 'how');
		await act(async () => {
			const input = [...container.querySelectorAll('label')]
				.find((node) => node.textContent === 'Bad words (match any part)')!
				.querySelector('input')!;
			input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
		});
		expect(container.querySelector('button[aria-label="Remove: first"]')).not.toBeNull();
		expect(container.querySelector('button[aria-label="Remove: how"]')).not.toBeNull();
		await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Remove: first"]')!.click());
		expect(container.querySelector('button[aria-label="Remove: first"]')).toBeNull();
		await act(async () => button('Discard').click());
		expect(container.querySelector<HTMLSelectElement>('select[aria-label="Anti-spam"]')!.value).toBe('observe');
		await openBadWords();
		expect(container.querySelector('button[aria-label="Remove: SECOND"]')).toBeNull();
		expect(transport.put).not.toHaveBeenCalled();
	});
	it('saves pending text without losing it and closes only after a successful revision update', async () => {
		await render();
		await openBadWords();
		await enter('Bad words (match any part)', 'show');
		expect(UnsavedChanges.hasUnsavedChanges('application-settings-event-logs:100')).toBe(true);
		transport.put.mockRejectedValue({status: 409});
		await act(async () => button('Save & Close').click());
		expect(container.querySelector('[data-flx="application-settings.automod.bad-words"]')).not.toBeNull();
		expect(container.querySelector('[role="alert"]')!.textContent).toContain('changed elsewhere');
		transport.put.mockImplementation(async (_url, {body}) => {
			const {revision, ...settings} = body;
			return {body: {...response, settings, revision: revision + 1}};
		});
		await act(async () => button('Save & Close').click());
		expect(transport.put.mock.calls.at(-1)![1].body.rules.bad_words.partial_words).toEqual(['show']);
		expect(container.querySelector('[data-flx="application-settings.automod.bad-words"]')).toBeNull();
		expect(UnsavedChanges.hasUnsavedChanges('application-settings-event-logs:100')).toBe(false);
	});
	it('enables separate user and category permissions and guards back navigation', async () => {
		await render();
		await openBadWords();
		await act(async () => container.querySelector<HTMLButtonElement>('button[role="switch"]')!.click());
		await enter('User ID', '300');
		await act(async () => button('Add').click());
		const users = container.querySelector('[role="radiogroup"][aria-label="Users"]')!;
		await act(async () => (users.querySelectorAll('button')[1] as HTMLButtonElement).click());
		await select('Categories', '600');
		const flash = UnsavedChanges.getFlashTrigger('application-settings-event-logs:100');
		await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Back"]')!.click());
		expect(UnsavedChanges.getFlashTrigger('application-settings-event-logs:100')).toBe(flash + 1);
		transport.put.mockImplementation(async (_url, {body}) => {
			const {revision, ...settings} = body;
			return {body: {...response, settings, revision: revision + 1}};
		});
		await act(async () => button('Save & Close').click());
		const permissions = transport.put.mock.calls[0]![1].body.rules.bad_words.permissions;
		expect(permissions.users).toEqual({mode: 'include', ids: ['300']});
		expect(permissions.categories.ids).toEqual(['600']);
	});
	it('opens repeated text with its configured limits and inherited scope without writing settings', async () => {
		const configured = structuredClone(response);
		configured.settings.rules.repeated_text.threshold = 5;
		configured.settings.rules.repeated_text.window_seconds = 45;
		transport.get.mockResolvedValue({body: configured});
		await render();
		await openRepeatedText();
		expect(container.querySelector('[data-flx="application-settings.automod.repeated-text"]')).not.toBeNull();
		expect(document.activeElement?.textContent).toBe('Repeated text');
		const inputs = [...container.querySelectorAll<HTMLInputElement>('input[type="number"]')];
		expect(inputs.map((node) => node.value)).toEqual(['5', '45']);
		expect(container.querySelectorAll('[role="radiogroup"]')).toHaveLength(4);
		expect([...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')].every((node) => node.disabled)).toBe(
			true,
		);
		expect(transport.put).not.toHaveBeenCalled();
		await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Back"]')!.click());
		expect(document.activeElement?.getAttribute('aria-label')).toBe('Repeated text · Settings');
	});
	it('discards only repeated-text changes, guards back, and preserves an earlier module draft', async () => {
		await render();
		await select('Anti-spam', 'observe');
		await openRepeatedText();
		await enter('Repeated messages', '7');
		await enter('Time window (s)', '30');
		const flash = UnsavedChanges.getFlashTrigger('application-settings-event-logs:100');
		await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Back"]')!.click());
		expect(UnsavedChanges.getFlashTrigger('application-settings-event-logs:100')).toBe(flash + 1);
		await act(async () => button('Discard').click());
		expect(document.activeElement?.getAttribute('aria-label')).toBe('Repeated text · Settings');
		expect(container.querySelector<HTMLSelectElement>('select[aria-label="Anti-spam"]')!.value).toBe('observe');
		await openRepeatedText();
		expect([...container.querySelectorAll<HTMLInputElement>('input[type="number"]')].map((node) => node.value)).toEqual(
			['3', '10'],
		);
		expect(transport.put).not.toHaveBeenCalled();
	});
	it('validates repeated-text limits and retains a conflicting draft until save succeeds', async () => {
		await render();
		await openRepeatedText();
		for (const [label, value] of [
			['Repeated messages', '0'],
			['Repeated messages', '1001'],
			['Time window (s)', '301'],
		]) {
			await enter(label!, value!);
			expect(button('Save & Close').disabled).toBe(true);
			await enter('Repeated messages', '4');
			await enter('Time window (s)', '20');
		}
		transport.put.mockRejectedValue({status: 409});
		await act(async () => button('Save & Close').click());
		expect(container.querySelector('[role="alert"]')!.textContent).toContain('changed elsewhere');
		expect(container.querySelector('[data-flx="application-settings.automod.repeated-text"]')).not.toBeNull();
		transport.put.mockImplementation(async (_url, {body}) => {
			const {revision, ...settings} = body;
			return {body: {...response, settings, revision: revision + 1}};
		});
		await act(async () => button('Save & Close').click());
		const body = transport.put.mock.calls.at(-1)![1].body;
		expect(body.revision).toBe(0);
		expect(body.rules.repeated_text.threshold).toBe(4);
		expect(body.rules.repeated_text.window_seconds).toBe(20);
		expect(body.rules.bad_words).toEqual(response.settings.rules.bad_words);
		expect(document.activeElement?.getAttribute('aria-label')).toBe('Repeated text · Settings');
		expect(UnsavedChanges.hasUnsavedChanges('application-settings-event-logs:100')).toBe(false);
	});
	it('saves separate repeated-text permissions independently of bad words and can restore inheritance', async () => {
		await render();
		await openRepeatedText();
		await act(async () => container.querySelector<HTMLButtonElement>('button[role="switch"]')!.click());
		await enter('User ID', '300');
		await act(async () => button('Add').click());
		await select('Roles', '500');
		await select('Channels', '400');
		await select('Categories', '600');
		transport.put.mockImplementation(async (_url, {body}) => {
			const {revision, ...settings} = body;
			return {body: {...response, settings, revision: revision + 1}};
		});
		await act(async () => button('Save & Close').click());
		const permissions = transport.put.mock.calls[0]![1].body.rules.repeated_text.permissions;
		expect(permissions.users.ids).toEqual(['300']);
		expect(permissions.roles.ids).toEqual(['500']);
		expect(permissions.channels.ids).toEqual(['400']);
		expect(permissions.categories.ids).toEqual(['600']);
		expect(transport.put.mock.calls[0]![1].body.rules.bad_words.permissions).toBeNull();
		await openRepeatedText();
		await act(async () => container.querySelector<HTMLButtonElement>('button[role="switch"]')!.click());
		expect([...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')].every((node) => node.disabled)).toBe(
			true,
		);
		await act(async () => button('Save & Close').click());
		expect(transport.put.mock.calls.at(-1)![1].body.rules.repeated_text.permissions).toBeNull();
	});
	it('opens server invites with inherited permissions and a shared case-sensitive link list', async () => {
		await render();
		await openServerInvites();
		expect(document.activeElement?.textContent).toBe('Server invites');
		expect(container.querySelectorAll('[role="radiogroup"]')).toHaveLength(4);
		expect([...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')].every((node) => node.disabled)).toBe(
			true,
		);
		await enter(
			'Link whitelist',
			'https://discord.gg/Allowed/,https://discord.gg/allowed/,https://discord.gg/Allowed/,',
		);
		expect(container.querySelectorAll('button[aria-label^="Remove:"]')).toHaveLength(2);
		expect(container.textContent).toContain('2/100');
		await act(async () =>
			container.querySelector<HTMLButtonElement>('button[aria-label="Remove: https://discord.gg/Allowed/"]')!.click(),
		);
		expect((document.activeElement as HTMLInputElement).value).toBe('');
		await act(async () => button('Discard').click());
		expect(document.activeElement?.getAttribute('aria-label')).toBe('Server invites · Settings');
		expect(transport.put).not.toHaveBeenCalled();
	});
	it('saves pending URL prefixes and separate invite scope while preserving existing domains and other rules', async () => {
		const configured = structuredClone(response);
		configured.settings.rules.server_invites.allowed_domains = ['legacy.org'];
		configured.settings.rules.external_links.allowed_domains = ['external.org'];
		transport.get.mockResolvedValue({body: configured});
		await render();
		await openServerInvites();
		await act(async () => container.querySelector<HTMLButtonElement>('button[role="switch"]')!.click());
		await enter('User ID', '300');
		await act(async () => button('Add').click());
		await select('Categories', '600');
		await enter('Link whitelist', 'https://fluxer.app/invite/Allowed');
		transport.put.mockRejectedValue({status: 409});
		await act(async () => button('Save & Close').click());
		expect(container.querySelector('[role="alert"]')!.textContent).toContain('changed elsewhere');
		expect(container.querySelector('[data-flx="application-settings.automod.server-invites"]')).not.toBeNull();
		transport.put.mockImplementation(async (_url, {body}) => {
			const {revision, ...settings} = body;
			return {body: {...response, settings, revision: revision + 1}};
		});
		await act(async () => button('Save & Close').click());
		const settings = transport.put.mock.calls.at(-1)![1].body;
		expect(settings.link_whitelist).toEqual(['https://fluxer.app/invite/Allowed']);
		expect(settings.rules.server_invites.allowed_domains).toEqual(['legacy.org']);
		expect(settings.rules.external_links.allowed_domains).toEqual(['external.org']);
		expect(settings.rules.server_invites.permissions.users.ids).toEqual(['300']);
		expect(settings.rules.server_invites.permissions.categories.ids).toEqual(['600']);
		expect(settings.rules.external_links.permissions).toBeNull();
		expect(document.activeElement?.getAttribute('aria-label')).toBe('Server invites · Settings');
	});
	it('validates URL entries, guards pending changes, and discards only this screen’s shared-list draft', async () => {
		await render();
		await select('Anti-spam', 'observe');
		await openServerInvites();
		for (const value of [
			'example.org',
			'javascript:alert(1)',
			'https://a.org/a b',
			'https://user:pass@a.org/',
			`https://a.org/${'x'.repeat(2048)}`,
		]) {
			await enter('Link whitelist', value);
			expect(button('Save & Close').disabled).toBe(true);
		}
		await enter('Link whitelist', 'https://example.org/allowed/');
		const flash = UnsavedChanges.getFlashTrigger('application-settings-event-logs:100');
		await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Back"]')!.click());
		expect(UnsavedChanges.getFlashTrigger('application-settings-event-logs:100')).toBe(flash + 1);
		await act(async () => button('Discard').click());
		expect(container.querySelector<HTMLSelectElement>('select[aria-label="Anti-spam"]')!.value).toBe('observe');
		await openServerInvites();
		expect(container.querySelectorAll('button[aria-label^="Remove:"]')).toHaveLength(0);
		expect(container.textContent).toContain('0/100');
		expect(transport.put).not.toHaveBeenCalled();
	});
	it('opens external links with inherited scope and the same whitelist, then restores inheritance', async () => {
		const configured = structuredClone(response);
		configured.settings.link_whitelist = ['https://example.org/Allowed/'];
		configured.settings.permissions = defaultAutoModPermissions();
		configured.settings.permissions.roles.ids = ['500'];
		configured.settings.permissions.categories.ids = ['600'];
		transport.get.mockResolvedValue({body: configured});
		await render();
		await openExternalLinks();
		expect(document.activeElement?.textContent).toBe('External links');
		expect(container.querySelector('[data-flx="application-settings.automod.external-links"]')).not.toBeNull();
		expect(container.querySelectorAll('[role="radiogroup"]')).toHaveLength(4);
		expect([...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')].every((node) => node.disabled)).toBe(
			true,
		);
		expect(container.querySelector('button[aria-label="Remove: https://example.org/Allowed/"]')).not.toBeNull();
		expect(container.textContent).toContain('1/100');
		await act(async () => container.querySelector<HTMLButtonElement>('button[role="switch"]')!.click());
		expect(container.querySelector<HTMLOptionElement>('select[aria-label="Roles"] option[value="500"]')!.selected).toBe(
			true,
		);
		expect(
			container.querySelector<HTMLOptionElement>('select[aria-label="Categories"] option[value="600"]')!.selected,
		).toBe(true);
		await act(async () => container.querySelector<HTMLButtonElement>('button[role="switch"]')!.click());
		expect([...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')].every((node) => node.disabled)).toBe(
			true,
		);
		await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Back"]')!.click());
		expect(document.activeElement?.getAttribute('aria-label')).toBe('External links · Settings');
		expect(transport.put).not.toHaveBeenCalled();
	});
	it('saves pending prefixes and external-link scope independently, with conflict recovery and cross-screen visibility', async () => {
		const configured = structuredClone(response);
		configured.settings.link_whitelist = ['https://example.org/Original/'];
		configured.settings.rules.external_links.allowed_domains = ['external.org'];
		configured.settings.rules.server_invites.allowed_domains = ['invite.org'];
		configured.settings.rules.server_invites.permissions = defaultAutoModPermissions();
		configured.settings.rules.server_invites.permissions.roles.ids = ['500'];
		transport.get.mockResolvedValue({body: configured});
		await render();
		await openExternalLinks();
		await act(async () => container.querySelector<HTMLButtonElement>('button[role="switch"]')!.click());
		await enter('User ID', '300');
		await act(async () => button('Add').click());
		await select('Roles', '500');
		await select('Channels', '400');
		await select('Categories', '600');
		await enter('Link whitelist', 'https://example.org/New/');
		transport.put.mockRejectedValue({status: 409});
		await act(async () => button('Save & Close').click());
		expect(container.querySelector('[role="alert"]')!.textContent).toContain('changed elsewhere');
		expect(container.querySelector('[data-flx="application-settings.automod.external-links"]')).not.toBeNull();
		transport.put.mockImplementation(async (_url, {body}) => {
			const {revision, ...settings} = body;
			return {body: {...configured, settings, revision: revision + 1}};
		});
		await act(async () => button('Save & Close').click());
		const settings = transport.put.mock.calls.at(-1)![1].body;
		expect(settings.link_whitelist).toEqual(['https://example.org/Original/', 'https://example.org/New/']);
		expect(settings.rules.external_links.allowed_domains).toEqual(['external.org']);
		expect(settings.rules.external_links.permissions).toEqual({
			users: {mode: 'exclude', ids: ['300']},
			roles: {mode: 'exclude', ids: ['500']},
			channels: {mode: 'exclude', ids: ['400']},
			categories: {mode: 'exclude', ids: ['600']},
		});
		expect(settings.rules.server_invites).toEqual(configured.settings.rules.server_invites);
		expect(document.activeElement?.getAttribute('aria-label')).toBe('External links · Settings');
		await openServerInvites();
		expect(container.querySelectorAll('ul[aria-label="Link whitelist"] button')).toHaveLength(2);
		expect(container.querySelector('button[aria-label="Remove: https://example.org/New/"]')).not.toBeNull();
		expect(container.textContent).toContain('2/100');
	});
	it('guards invalid external-link drafts and discards their list and legacy edits while retaining earlier changes', async () => {
		const configured = structuredClone(response);
		configured.settings.link_whitelist = ['https://example.org/Original/'];
		configured.settings.rules.external_links.allowed_domains = ['legacy.org'];
		transport.get.mockResolvedValue({body: configured});
		await render();
		await select('Anti-spam', 'observe');
		await openExternalLinks();
		await enter('Link whitelist', 'example.org');
		expect(button('Save & Close').disabled).toBe(true);
		await enter('Link whitelist', 'https://example.org/New/');
		await act(async () => {
			const area = container.querySelector('textarea')!;
			Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(area, 'changed.org');
			area.dispatchEvent(new Event('input', {bubbles: true}));
		});
		const flash = UnsavedChanges.getFlashTrigger('application-settings-event-logs:100');
		await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Back"]')!.click());
		expect(UnsavedChanges.getFlashTrigger('application-settings-event-logs:100')).toBe(flash + 1);
		await act(async () => button('Discard').click());
		expect(document.activeElement?.getAttribute('aria-label')).toBe('External links · Settings');
		expect(container.querySelector<HTMLSelectElement>('select[aria-label="Anti-spam"]')!.value).toBe('observe');
		await openExternalLinks();
		expect(container.querySelector('textarea')!.value).toBe('legacy.org');
		expect(container.textContent).toContain('1/100');
		expect(container.querySelector('button[aria-label="Remove: https://example.org/New/"]')).toBeNull();
		await act(async () => button('Discard').click());
		await openServerInvites();
		expect(container.textContent).toContain('1/100');
		expect(transport.put).not.toHaveBeenCalled();
	});
});
