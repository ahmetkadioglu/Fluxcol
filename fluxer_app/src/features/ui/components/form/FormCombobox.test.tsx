// @vitest-environment happy-dom
// SPDX-License-Identifier: AGPL-3.0-or-later
import {Combobox} from '@app/features/ui/components/form/FormCombobox';
import LayerManager from '@app/features/ui/state/LayerManager';
import {useModalLogic, useScreenReaderLabelLogic} from '@app/features/ui/utils/ModalUtils';
import {act, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('@lingui/core/macro', () => ({msg: (value: object) => value}));
vi.mock('@lingui/react/macro', () => ({
	useLingui: () => ({
		i18n: {locale: 'en-US', _: (v: {message: string}) => v.message},
	}),
}));
vi.mock('@app/features/ui/overlay/PortalHostContext', () => ({
	usePortalHost: () => null,
}));
vi.mock('@app/features/ui/focus_ring/FocusRing', () => ({
	default: ({children}: {children: ReactNode}) => children,
}));
vi.mock('@app/features/ui/components/Scroller', () => ({
	Scroller: ({children}: {children: ReactNode}) => <div>{children}</div>,
}));
vi.mock('@app/features/ui/commands/PopoutCommands', () => ({close: vi.fn()}));
vi.mock('@app/features/ui/commands/ModalCommands', () => ({popAll: vi.fn()}));
vi.mock('@app/features/accessibility/state/Accessibility', () => ({default: {useReducedMotion: false}}));
vi.mock('@app/features/ui/state/MobileLayout', () => ({default: {enabled: false}}));
vi.mock('@app/features/ui/state/Modal', () => ({default: {getKeyAtStackIndex: vi.fn()}}));

describe('Native combobox in the modal escape stack', () => {
	let host: HTMLDivElement, root: Root;
	const closeModal = vi.fn();
	beforeEach(async () => {
		closeModal.mockReset();
		LayerManager.init();
		LayerManager.addLayer('modal', 'test-dialog', closeModal);
		host = document.createElement('div');
		document.body.append(host);
		root = createRoot(host);
		await act(async () =>
			root.render(
				<Combobox label="Roles" value={[]} isMulti options={[{value: 'member', label: 'Member'}]} onChange={vi.fn()} />,
			),
		);
	});
	afterEach(async () => {
		await act(async () => root.unmount());
		host.remove();
		LayerManager.destroy();
	});
	async function open() {
		const input = host.querySelector<HTMLInputElement>('[role="combobox"]')!;
		await act(async () => {
			input.focus();
			input.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true}));
		});
		expect(input.getAttribute('aria-expanded')).toBe('true');
		expect(LayerManager.isTopType('popout')).toBe(true);
		return input;
	}
	it('Escape closes the role list first and restores focus without closing its modal', async () => {
		const input = await open();
		await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})));
		expect(input.getAttribute('aria-expanded')).toBe('false');
		expect(document.activeElement).toBe(input);
		expect(closeModal).not.toHaveBeenCalled();
		expect(LayerManager.isTopType('modal')).toBe(true);
		await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})));
		expect(closeModal).toHaveBeenCalledOnce();
	});
	it('removes its layer when an open selector unmounts', async () => {
		await open();
		await act(async () => root.render(null));
		expect(LayerManager.isTopType('modal')).toBe(true);
	});
	it('keeps an open list above a modal when its unsaved-changes close guard updates', async () => {
		const oldClose = vi.fn(),
			updatedClose = vi.fn();
		function TestModal({onClose}: {onClose: () => void}) {
			const {modalContextValue} = useModalLogic({onClose});
			useScreenReaderLabelLogic({text: 'Settings', modalContextValue});
			return (
				<Combobox label="Roles" value={[]} isMulti options={[{value: 'member', label: 'Member'}]} onChange={vi.fn()} />
			);
		}
		await act(async () => root.render(<TestModal onClose={oldClose} />));
		const input = await open();
		await act(async () => root.render(<TestModal onClose={updatedClose} />));
		expect(LayerManager.isTopType('popout')).toBe(true);
		await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})));
		expect(input.getAttribute('aria-expanded')).toBe('false');
		expect(updatedClose).not.toHaveBeenCalled();
		await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})));
		expect(updatedClose).toHaveBeenCalledOnce();
		expect(oldClose).not.toHaveBeenCalled();
	});
	it('shows an action even when no roles exist, closing the popup before opening settings', async () => {
		const onAction = vi.fn();
		await act(async () =>
			root.render(
				<Combobox
					label="Roles"
					value={[]}
					isMulti
					options={[]}
					onChange={vi.fn()}
					popupAction={{label: 'Create role', onClick: onAction}}
				/>,
			),
		);
		const input = await open();
		const action = [...document.querySelectorAll('button')].find((button) => button.textContent === 'Create role')!;
		expect(action).toBeDefined();
		await act(async () => {
			action.focus();
			action.click();
		});
		expect(onAction).toHaveBeenCalledOnce();
		expect(input.getAttribute('aria-expanded')).toBe('false');
		expect(document.activeElement).toBe(input);
		expect(LayerManager.isTopType('modal')).toBe(true);
		expect(closeModal).not.toHaveBeenCalled();
	});
});
