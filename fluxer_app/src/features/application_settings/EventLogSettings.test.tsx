// @vitest-environment happy-dom
// SPDX-License-Identifier: AGPL-3.0-or-later

import {EventLogSettings, eventLogTabId} from '@app/features/application_settings/EventLogSettings';
import UnsavedChanges from '@app/features/ui/state/UnsavedChanges';
import {act, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

const transport = vi.hoisted(() => ({get: vi.fn(), put: vi.fn(), post: vi.fn()}));
vi.mock('@app/features/platform/transport/RestTransport', () => ({http: transport}));
vi.mock('@lingui/core/macro', () => ({msg: (value: object) => value}));
vi.mock('@lingui/react/macro', () => ({
	useLingui: () => ({i18n: {_: (value: {message: string}) => value.message, locale: 'en-US'}}),
}));
vi.mock(
	'@app/features/guild/components/modals/guild_tabs/guild_overview_tab/components/GuildOverviewTabSettingsSection',
	() => ({
		SettingsSection: ({children, title, description}: {children: ReactNode; title: string; description: string}) => (
			<section>
				<h2>{title}</h2>
				<p>{description}</p>
				{children}
			</section>
		),
	}),
);
vi.mock('@app/features/ui/button/Button', () => ({
	Button: ({children, onClick, disabled}: {children: ReactNode; onClick: () => void; disabled: boolean}) => (
		<button type="button" onClick={onClick} disabled={disabled}>
			{children}
		</button>
	),
}));
vi.mock('@app/features/ui/components/Spinner', () => ({Spinner: () => <span>Loading</span>}));
vi.mock('@app/features/ui/components/Scroller', () => ({
	Scroller: ({children}: {children: ReactNode}) => <div>{children}</div>,
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
			onClick={() => onChange(!value)}
			disabled={disabled}
		/>
	),
}));
vi.mock('@app/features/ui/checkbox/Checkbox', () => ({
	Checkbox: ({
		children,
		checked,
		indeterminate,
		onChange,
		disabled,
	}: {
		children: ReactNode;
		checked: boolean;
		indeterminate?: boolean;
		onChange: (value: boolean) => void;
		disabled: boolean;
	}) => (
		<label>
			<input
				type="checkbox"
				aria-checked={indeterminate ? 'mixed' : checked}
				checked={checked}
				onChange={(event) => onChange(event.target.checked)}
				disabled={disabled}
			/>
			{children}
		</label>
	),
}));
vi.mock('@app/features/user/components/modals/tabs/components/CompactComboboxRow', () => ({
	CompactComboboxRow: ({
		label,
		value,
		options,
		onChange,
		disabled,
	}: {
		label: string;
		value: string | null;
		options: Array<{value: string | null; label: string}>;
		onChange: (value: string | null) => void;
		disabled: boolean;
	}) => (
		<label>
			{label}
			<select
				aria-label={label}
				value={value ?? ''}
				disabled={disabled}
				onChange={(event) => onChange(event.target.value || null)}
			>
				{options.map((option) => (
					<option key={option.value ?? ''} value={option.value ?? ''}>
						{option.label}
					</option>
				))}
			</select>
		</label>
	),
}));

const response = {
	settings: {enabled: false, channel_id: null, events: ['member_join', 'member_leave'], language: 'en-US'},
	revision: 0,
	status: 'disabled',
	channels: [{id: '400', name: 'general'}],
};
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
	vi.clearAllMocks();
	transport.get.mockResolvedValue({body: structuredClone(response)});
	transport.post.mockResolvedValue({body: {queued: true}});
	container = document.createElement('div');
	document.body.append(container);
	root = createRoot(container);
});
afterEach(async () => {
	await act(async () => root.unmount());
	container.remove();
});
async function render() {
	await act(async () => root.render(<EventLogSettings guildId="100" />));
}
function button(label: string) {
	return [...container.querySelectorAll<HTMLButtonElement>('button')].find((element) => element.textContent === label)!;
}
async function enable() {
	await act(async () => container.querySelector<HTMLButtonElement>('[role="switch"]')!.click());
}
async function selectChannel() {
	await act(async () => {
		const select = container.querySelector<HTMLSelectElement>('select')!;
		select.value = '400';
		select.dispatchEvent(new Event('change', {bubbles: true}));
	});
}

describe('functional event log settings', () => {
	it('loads without writing settings and disables a test until saved', async () => {
		await render();
		expect(transport.get).toHaveBeenCalledWith('/guilds/100/application-settings/event-logs');
		expect(transport.put).not.toHaveBeenCalled();
		expect(transport.post).not.toHaveBeenCalled();
		expect(button('Send test message').disabled).toBe(true);
		expect(container.querySelectorAll('[role="tab"]')).toHaveLength(11);
		expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(6);
		expect(container.querySelectorAll('input[type="checkbox"][disabled]')).toHaveLength(0);
		expect(container.querySelector('select[aria-label="Community language"]')).toBeNull();
	});
	it('tracks dirty state, resets, and saves the expected revision', async () => {
		await render();
		await enable();
		expect(UnsavedChanges.hasUnsavedChanges(eventLogTabId('100'))).toBe(true);
		await act(async () => button('Reset').click());
		expect(UnsavedChanges.hasUnsavedChanges(eventLogTabId('100'))).toBe(false);
		await enable();
		await selectChannel();
		transport.put.mockResolvedValue({
			body: {
				...response,
				settings: {...response.settings, enabled: true, channel_id: '400'},
				revision: 1,
				status: 'enabled',
			},
		});
		await act(async () => button('Save changes').click());
		expect(transport.put).toHaveBeenCalledWith('/guilds/100/application-settings/event-logs', {
			body: {...response.settings, enabled: true, channel_id: '400', revision: 0},
			mode: 'strict',
		});
		expect(UnsavedChanges.hasUnsavedChanges(eventLogTabId('100'))).toBe(false);
		await act(async () => button('Send test message').click());
		expect(transport.post).toHaveBeenCalledWith('/guilds/100/application-settings/event-logs/test', {
			body: {event_type: 'member_join'},
			mode: 'strict',
		});
		expect(container.textContent).toContain('Test queued');
	});
	it('keeps draft on a revision conflict and allows explicit reload', async () => {
		await render();
		await enable();
		transport.put.mockRejectedValue({status: 409});
		await act(async () => button('Save changes').click());
		expect(container.querySelector('[role="alert"]')!.textContent).toContain('changed elsewhere');
		expect(UnsavedChanges.hasUnsavedChanges(eventLogTabId('100'))).toBe(true);
		expect(button('Send test message').disabled).toBe(true);
		await act(async () => button('Refresh').click());
		expect(UnsavedChanges.hasUnsavedChanges(eventLogTabId('100'))).toBe(false);
	});
	it('selects only supported events, shows mixed categories, and clears selections', async () => {
		await render();
		expect(container.querySelector('input[aria-checked="mixed"]')).not.toBeNull();
		await act(async () => button('Select all').click());
		expect(container.querySelectorAll('input[type="checkbox"]:checked')).toHaveLength(6);
		expect(container.querySelectorAll('input[aria-checked="mixed"]')).toHaveLength(0);
		await act(async () => button('Moderation').click());
		expect(container.querySelectorAll('input[type="checkbox"][disabled]')).toHaveLength(1);
		expect(container.querySelectorAll('input[type="checkbox"]:checked')).toHaveLength(9);
		await act(async () => button('Invites').click());
		expect(container.querySelectorAll('input[type="checkbox"][disabled]')).toHaveLength(1);
		expect(container.querySelectorAll('input[disabled]:checked')).toHaveLength(0);
		await act(async () => button('Clear selection').click());
		expect(container.querySelectorAll('input[type="checkbox"]:checked')).toHaveLength(0);
		expect(transport.put).not.toHaveBeenCalled();
	});
	it('changes categories with arrow keys and retains draft selections across tabs', async () => {
		await render();
		const members = container.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')!;
		await act(async () => members.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true})));
		const moderation = container.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')!;
		expect(moderation.textContent).toBe('Moderation');
		expect(document.activeElement).toBe(moderation);
		const panel = document.getElementById(moderation.getAttribute('aria-controls')!)!;
		expect(panel.getAttribute('aria-labelledby')).toBe(moderation.id);
		expect(panel.hidden).toBe(false);
		const banned = [...container.querySelectorAll<HTMLLabelElement>('label')]
			.find((el) => el.textContent === 'Member banned')!
			.querySelector<HTMLInputElement>('input')!;
		await act(async () => banned.click());
		expect(UnsavedChanges.hasUnsavedChanges(eventLogTabId('100'))).toBe(true);
		await act(async () => button('Roles').click());
		expect(container.textContent).toContain('Role created');
		expect(container.textContent).not.toContain('Member banned');
		await act(async () => button('Moderation').click());
		expect(
			[...container.querySelectorAll<HTMLLabelElement>('label')]
				.find((el) => el.textContent === 'Member banned')!
				.querySelector<HTMLInputElement>('input')!.checked,
		).toBe(true);
		expect(transport.put).not.toHaveBeenCalled();
	});
	it('searches across categories, shows an empty state, and restores tabs when cleared', async () => {
		await render();
		const search = container.querySelector<HTMLInputElement>('input[type="search"]')!;
		const searchFor = async (value: string) =>
			act(async () => {
				const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
				setter.call(search, value);
				search.dispatchEvent(new Event('input', {bubbles: true}));
			});
		await searchFor('Role created');
		expect(container.querySelectorAll('[role="tab"]')).toHaveLength(1);
		expect(container.querySelector('[role="tab"][aria-selected="true"]')!.textContent).toBe('Roles');
		expect(container.textContent).toContain('Role created');
		expect(container.querySelector('[role="tabpanel"]:not([hidden])')!.textContent).not.toContain('Member joined');
		await searchFor('no-such-log-event');
		expect(container.textContent).toContain('No results found');
		expect(container.querySelector('[role="tab"]')).toBeNull();
		await searchFor('');
		expect(container.querySelectorAll('[role="tab"]')).toHaveLength(11);
		expect(container.querySelector('[role="tab"][aria-selected="true"]')!.textContent).toBe('Membership and profile');
		expect(transport.put).not.toHaveBeenCalled();
	});
	it('preserves the stored language when saving other settings after removing the language field', async () => {
		const turkish = {...response, settings: {...response.settings, language: 'tr'}};
		transport.get.mockResolvedValue({body: turkish});
		transport.put.mockResolvedValue({body: {...turkish, settings: {...turkish.settings, enabled: true}, revision: 1}});
		await render();
		expect(container.querySelector('select[aria-label="Community language"]')).toBeNull();
		await enable();
		await act(async () => button('Save changes').click());
		expect(transport.put.mock.calls[0]?.[1].body.language).toBe('tr');
	});
	it('previews draft routing and text capture without sending or saving', async () => {
		await render();
		await selectChannel();
		await act(async () => container.querySelectorAll<HTMLButtonElement>('[role="switch"]')[1]!.click());
		await act(async () => button('Preview').click());
		expect(container.textContent).toContain('Log channel: #general');
		expect(container.textContent).toContain('Log message text: Enabled');
		expect(transport.put).not.toHaveBeenCalled();
		expect(transport.post).not.toHaveBeenCalled();
		expect(button('Send test message').disabled).toBe(true);
	});
	it('shows access failures without exposing cached controls', async () => {
		transport.get.mockRejectedValue({status: 403});
		await render();
		expect(container.querySelector('[role="alert"]')!.textContent).toContain('Check your access');
		expect(container.querySelector('[role="switch"]')).toBeNull();
		expect(transport.put).not.toHaveBeenCalled();
	});
	it('removes loaded controls when a reload loses access', async () => {
		await render();
		await enable();
		transport.put.mockRejectedValue({status: 409});
		await act(async () => button('Save changes').click());
		transport.get.mockRejectedValue({status: 403});
		await act(async () => button('Refresh').click());
		expect(container.querySelector('[role="switch"]')).toBeNull();
		expect(container.querySelector('[role="alert"]')!.textContent).toContain('Check your access');
		expect(UnsavedChanges.hasUnsavedChanges(eventLogTabId('100'))).toBe(false);
	});
	it('clears dirty state when unmounted and ignores late responses', async () => {
		await render();
		await enable();
		await act(async () => root.render(null));
		expect(UnsavedChanges.hasUnsavedChanges(eventLogTabId('100'))).toBe(false);
		let complete!: (value: unknown) => void;
		transport.get.mockReturnValue(
			new Promise((resolve) => {
				complete = resolve;
			}),
		);
		await render();
		await act(async () => root.render(null));
		await act(async () => complete({body: response}));
		expect(container.textContent).toBe('');
	});
});
