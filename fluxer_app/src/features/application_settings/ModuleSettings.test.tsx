// @vitest-environment happy-dom
// SPDX-License-Identifier: AGPL-3.0-or-later

import {ModuleSettings} from '@app/features/application_settings/ModuleSettings';
import UnsavedChanges from '@app/features/ui/state/UnsavedChanges';
import {NETRCOL_MESSAGE_LANGUAGES} from '@fluxer/constants/src/ModuleSettingsConstants';
import {act, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

const transport = vi.hoisted(() => ({get: vi.fn(), put: vi.fn()}));
vi.mock('@app/features/platform/transport/RestTransport', () => ({http: transport}));
vi.mock('@lingui/core/macro', () => ({msg: (value: object) => value}));
vi.mock('@lingui/react/macro', () => ({useLingui: () => ({i18n: {_: (value: {message: string}) => value.message}})}));
vi.mock('@app/features/application_settings/EventLogSettings', () => ({
	eventLogTabId: (id: string) => `application-settings-event-logs:${id}`,
}));
vi.mock('@app/features/user/utils/LocaleUtils', () => ({
	getSortedLocales: () => NETRCOL_MESSAGE_LANGUAGES.map((code) => ({code, name: code, nativeName: code})),
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
vi.mock('@app/features/ui/components/Spinner', () => ({Spinner: () => <span>Loading</span>}));
vi.mock('@app/features/user/components/modals/tabs/components/CompactComboboxRow', () => ({
	CompactComboboxRow: ({
		label,
		value,
		options,
		onChange,
		disabled,
	}: {
		label: string;
		value: string;
		options: Array<{value: string; label: string}>;
		onChange: (value: string) => void;
		disabled: boolean;
	}) => (
		<label>
			{label}
			<select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		</label>
	),
}));

const saved = {settings: {message_language: 'tr'}, revision: 4};
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
	await act(async () => root.render(<ModuleSettings guildId={id} />));
}
async function select(value: string) {
	await act(async () => {
		const field = container.querySelector('select')!;
		field.value = value;
		field.dispatchEvent(new Event('change', {bubbles: true}));
	});
}
function button(label: string) {
	return [...container.querySelectorAll('button')].find((button) => button.textContent === label)!;
}

describe('Shared module settings panel', () => {
	it('loads the saved language with all 34 choices without writing', async () => {
		await render();
		expect(container.querySelector('select')!.value).toBe('tr');
		expect(container.querySelectorAll('option')).toHaveLength(34);
		expect(transport.put).not.toHaveBeenCalled();
		expect(button('Save changes').disabled).toBe(true);
	});
	it('saves the community language with its revision and clears the dirty guard', async () => {
		transport.put.mockResolvedValue({body: {settings: {message_language: 'ja'}, revision: 5}});
		await render();
		await select('ja');
		expect(UnsavedChanges.unsavedChanges['application-settings-event-logs:100']).toBe(true);
		await act(async () => button('Save changes').click());
		expect(transport.put).toHaveBeenCalledWith('/guilds/100/application-settings/modules', {
			body: {message_language: 'ja', revision: 4},
			mode: 'strict',
		});
		expect(container.textContent).toContain('Saved');
		expect(button('Save changes').disabled).toBe(true);
	});
	it('resets a changed language and removes the unload warning', async () => {
		await render();
		await select('de');
		const blocked = new Event('beforeunload', {cancelable: true});
		window.dispatchEvent(blocked);
		expect(blocked.defaultPrevented).toBe(true);
		await act(async () => button('Reset').click());
		expect(container.querySelector('select')!.value).toBe('tr');
		const allowed = new Event('beforeunload', {cancelable: true});
		window.dispatchEvent(allowed);
		expect(allowed.defaultPrevented).toBe(false);
	});
	it.each([409, 500])('keeps the draft when saving fails with %s', async (status) => {
		transport.put.mockRejectedValue({status});
		await render();
		await select('de');
		await act(async () => button('Save changes').click());
		expect(container.querySelector('select')!.value).toBe('de');
		expect(container.querySelector('[role="alert"]')).not.toBeNull();
		expect(button('Save changes').disabled).toBe(false);
	});
	it('does not expose a cached community value after access fails', async () => {
		await render();
		transport.get.mockRejectedValue({status: 403});
		await render('200');
		expect(container.querySelector('select')).toBeNull();
		expect(container.querySelector('[role="alert"]')).not.toBeNull();
	});
});
