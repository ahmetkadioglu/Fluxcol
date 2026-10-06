// @vitest-environment happy-dom
// SPDX-License-Identifier: AGPL-3.0-or-later

import {Checkbox} from '@app/features/ui/checkbox/Checkbox';
import {act, type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {describe, expect, it, vi} from 'vitest';

vi.mock('@app/features/ui/focus_ring/FocusRing', () => ({default: ({children}: {children: ReactNode}) => children}));
vi.mock('@app/features/ui/state/KeyboardMode', () => ({default: {keyboardModeEnabled: false}}));
vi.mock('@lingui/core/macro', () => ({msg: (value: object) => value}));
(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

describe('partially selected checkbox accessibility', () => {
	it('announces mixed selection at both native keyboard stops and selects the category with Space', async () => {
		const container = document.createElement('div');
		document.body.append(container);
		const root = createRoot(container);
		const change = vi.fn();
		try {
			await act(async () =>
				root.render(
					<Checkbox indeterminate onChange={change}>
						Members
					</Checkbox>,
				),
			);
			const stops = container.querySelectorAll<HTMLElement>('[role="checkbox"]');
			expect(stops).toHaveLength(2);
			for (const stop of stops) expect(stop.getAttribute('aria-checked')).toBe('mixed');
			await act(async () => stops[1]!.dispatchEvent(new KeyboardEvent('keydown', {key: ' ', bubbles: true})));
			expect(change).toHaveBeenCalledWith(true);
			expect(document.activeElement).toBe(stops[0]);
		} finally {
			await act(async () => root.unmount());
			container.remove();
		}
	});
});
