// @vitest-environment happy-dom
// SPDX-License-Identifier: AGPL-3.0-or-later

import {AutomaticRoleSettings} from '@app/features/application_settings/AutomaticRoleSettings';
import UnsavedChanges from '@app/features/ui/state/UnsavedChanges';
import {act, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

const transport = vi.hoisted(() => ({get: vi.fn(), put: vi.fn()}));
const roleModal = vi.hoisted(() => ({
	pushWithKey: vi.fn(),
	popWithKey: vi.fn(),
}));
vi.mock('@app/features/ui/commands/ModalCommands', () => ({
	...roleModal,
	modal: (render: unknown) => render,
}));
vi.mock('@app/features/guild/components/modals/GuildSettingsModal', () => ({
	GuildSettingsModal: () => null,
}));
vi.mock('@app/features/platform/transport/RestTransport', () => ({
	http: transport,
}));
vi.mock('@lingui/core/macro', () => ({msg: (value: object) => value}));
vi.mock('@lingui/react/macro', () => ({
	useLingui: () => ({
		i18n: {_: (value: {message: string}) => value.message},
	}),
}));
vi.mock('@app/features/application_settings/EventLogSettings', () => ({
	eventLogTabId: (id: string) => `application-settings-event-logs:${id}`,
}));
vi.mock('@app/features/application_settings/AutomaticRoleHistory', () => ({
	AutomaticRoleHistory: () => <div>History</div>,
}));
vi.mock('@app/features/ui/components/form/FormCombobox', () => ({
	Combobox: ({
		label,
		value,
		options,
		onChange,
		disabled,
		popupAction,
	}: {
		label: string;
		value: Array<string>;
		options: Array<{value: string; label: string; isDisabled?: boolean}>;
		onChange: (value: Array<string>) => void;
		disabled: boolean;
		popupAction?: {label: string; onClick: () => void};
	}) => (
		<label>
			{label}
			<select
				multiple
				aria-label={label}
				value={value}
				disabled={disabled}
				onChange={(event) => onChange([...event.target.selectedOptions].map((o) => o.value))}
			>
				{options.map((option) => (
					<option key={option.value} value={option.value} disabled={option.isDisabled}>
						{option.label}
					</option>
				))}
			</select>
			{popupAction && (
				<button type="button" onClick={popupAction.onClick}>
					{popupAction.label}
				</button>
			)}
		</label>
	),
}));
vi.mock('@app/features/ui/components/form/FormInput', () => ({
	Input: ({label, ...props}: {label: string}) => (
		<label>
			{label}
			<input aria-label={label} {...props} />
		</label>
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
		onChange: (v: boolean) => void;
		disabled: boolean;
	}) => (
		<label>
			{label}
			<input type="checkbox" checked={value} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
		</label>
	),
}));
vi.mock(
	'@app/features/guild/components/modals/guild_tabs/guild_overview_tab/components/GuildOverviewTabSettingsSection',
	() => ({
		SettingsSection: ({children, description}: {children: ReactNode; description: string}) => (
			<section>
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
vi.mock('@app/features/ui/components/Spinner', () => ({
	Spinner: () => <span>Loading</span>,
}));
const saved = {
	settings: {
		enabled: false,
		member_role_ids: ['201'],
		bot_role_ids: [],
		delay_seconds: 0,
	},
	revision: 4,
	status: 'disabled',
	roles: [
		{id: '201', name: 'Member', eligible: true},
		{id: '202', name: 'Bot', eligible: true},
		{id: '203', name: 'Admin', eligible: false},
	],
};
let container: HTMLDivElement, root: Root;
beforeEach(() => {
	vi.clearAllMocks();
	transport.get.mockResolvedValue({body: structuredClone(saved)});
	container = document.createElement('div');
	document.body.append(container);
	root = createRoot(container);
});
afterEach(async () => {
	await act(async () => root.unmount());
	container.remove();
});
async function render(id = '100') {
	await act(async () => root.render(<AutomaticRoleSettings guildId={id} />));
}
async function select(value: string, index = 0) {
	await act(async () => {
		const field = container.querySelectorAll('select')[index]!;
		for (const option of field.options) option.selected = option.value === value;
		field.dispatchEvent(new Event('change', {bubbles: true}));
	});
}
function button(label: string) {
	return [...container.querySelectorAll('button')].find((button) => button.textContent === label)!;
}

describe('Automatic roles panel', () => {
	it('loads separate member and bot roles, omits staff roles and does not write before saving', async () => {
		await render();
		expect(container.querySelectorAll('select')).toHaveLength(2);
		expect(container.textContent).not.toContain('Admin');
		expect(transport.put).not.toHaveBeenCalled();
		expect(button('Save changes').disabled).toBe(true);
	});
	it('saves both role selections with the configuration revision', async () => {
		transport.put.mockResolvedValue({
			body: {
				...saved,
				settings: {...saved.settings, bot_role_ids: ['202']},
				revision: 5,
			},
		});
		await render();
		await select('202', 1);
		expect(UnsavedChanges.unsavedChanges['application-settings-event-logs:100']).toBe(true);
		await act(async () => button('Save changes').click());
		expect(transport.put).toHaveBeenCalledWith('/guilds/100/application-settings/automatic-roles', {
			body: {...saved.settings, bot_role_ids: ['202'], revision: 4},
			mode: 'strict',
		});
		expect(button('Save changes').disabled).toBe(true);
	});
	it('resets the draft and removes the unload warning', async () => {
		await render();
		await select('202');
		const event = new Event('beforeunload', {cancelable: true});
		window.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
		await act(async () => button('Reset').click());
		expect(container.querySelector('select')!.value).toBe('201');
	});
	it.each([409, 500])('keeps unsaved selections after save failure %s', async (status) => {
		transport.put.mockRejectedValue({status});
		await render();
		await select('202');
		await act(async () => button('Save changes').click());
		expect(container.querySelector('select')!.value).toBe('202');
		expect(container.querySelector('[role="alert"]')).not.toBeNull();
	});
	it('clears cached values when another community denies access', async () => {
		await render();
		transport.get.mockRejectedValue({status: 403});
		await render('200');
		expect(container.querySelector('select')).toBeNull();
		expect(container.querySelector('[role="alert"]')).not.toBeNull();
	});
	it('keeps deleted selections visible and flags them for removal', async () => {
		transport.get.mockResolvedValue({
			body: {
				...saved,
				settings: {...saved.settings, member_role_ids: ['999']},
			},
		});
		await render();
		expect(container.querySelector('select')!.value).toBe('999');
		expect(container.querySelector('[role="alert"]')?.textContent).toContain('selected role');
	});
	it.each([0, 1])('opens native role settings from selector %s without losing the draft', async (index) => {
		await render();
		await select('202', 1);
		await act(async () =>
			[...container.querySelectorAll('button')].filter((b) => b.textContent === 'Create role')[index]!.click(),
		);
		const [renderModal, key] = roleModal.pushWithKey.mock.calls[0]!;
		expect(key).toBe('automatic-roles-create-100');
		expect(renderModal().props).toMatchObject({
			guildId: '100',
			initialTab: 'roles',
			initialMobileTab: 'roles',
		});
		expect(container.querySelectorAll('select')[1]!.value).toBe('202');
		expect(transport.put).not.toHaveBeenCalled();
	});
	it('returns after creation, refreshes both lists and keeps the draft and original revision', async () => {
		await render();
		await select('202', 1);
		await act(async () => button('Create role').click());
		const [renderModal] = roleModal.pushWithKey.mock.calls[0]!;
		const newRoles = [...saved.roles, {id: '204', name: 'New role', eligible: true}];
		transport.get.mockResolvedValue({
			body: {
				...saved,
				revision: 99,
				settings: {...saved.settings, delay_seconds: 90},
				roles: newRoles,
			},
		});
		await act(async () => renderModal().props.onRoleCreated('204'));
		expect(roleModal.popWithKey).toHaveBeenCalledWith('automatic-roles-create-100');
		expect(container.querySelectorAll('option[value="204"]')).toHaveLength(2);
		expect(container.querySelectorAll('select')[1]!.value).toBe('202');
		expect(container.querySelector('input[type="number"]')?.getAttribute('value')).toBe('0');
		expect(transport.put).not.toHaveBeenCalled();
		transport.put.mockResolvedValue({
			body: {
				...saved,
				settings: {...saved.settings, bot_role_ids: ['202']},
				revision: 5,
				roles: newRoles,
			},
		});
		await act(async () => button('Save changes').click());
		expect(transport.put.mock.calls[0]![1].body.revision).toBe(4);
	});
	it('keeps the draft when the role-list refresh fails after returning', async () => {
		await render();
		await select('202', 1);
		await act(async () => button('Create role').click());
		const [renderModal] = roleModal.pushWithKey.mock.calls[0]!;
		transport.get.mockRejectedValue({status: 500});
		await act(async () => renderModal().props.onRoleCreated('204'));
		expect(container.querySelectorAll('select')[1]!.value).toBe('202');
		expect(container.querySelector('[role="alert"]')).not.toBeNull();
		expect(transport.put).not.toHaveBeenCalled();
	});
});
