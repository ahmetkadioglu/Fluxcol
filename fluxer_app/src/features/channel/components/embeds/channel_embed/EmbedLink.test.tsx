// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"navigation":{"disableMainFrameNavigation":true,"disableChildPageNavigation":true,"disableFallbackToSetURL":true}}}
// SPDX-License-Identifier: AGPL-3.0-or-later

import {EmbedLink} from '@app/features/channel/components/embeds/channel_embed/EmbedLink';
import {act, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const state = vi.hoisted(() => ({
	appUrl: 'http://localhost:8088',
	scope: '1556486939786346496',
	channelId: '1556486939786346499',
	messageId: '1556712848741105664',
	channel: undefined as {id: string; guildId: string | null} | undefined,
	goToMessage: vi.fn(),
	selectChannel: vi.fn(),
	transitionTo: vi.fn(),
	promptForChannelGate: vi.fn(),
	openLinkChannel: vi.fn(),
	openExternalUrlWithWarning: vi.fn(),
	trusted: true,
}));
vi.mock('@app/features/app/components/dialogs/ConfirmModal', () => ({
	ConfirmModal: () => null,
}));
vi.mock('@app/features/app/state/RuntimeConfig', () => ({
	default: {
		get webAppBaseUrl() {
			return state.appUrl;
		},
	},
}));
vi.mock('@app/features/channel/commands/ChannelGateCommands', () => ({
	promptForChannelGate: state.promptForChannelGate,
}));
vi.mock('@app/features/channel/commands/LinkChannelCommands', () => ({
	openLinkChannel: state.openLinkChannel,
}));
vi.mock('@app/features/channel/state/Channels', () => ({
	default: {getChannel: () => state.channel},
}));
vi.mock('@app/features/channel/components/embeds/channel_embed/ChannelEmbedShared', () => ({
	logger: {warn: vi.fn()},
}));
vi.mock('@app/features/i18n/utils/CommonMessageDescriptors', () => ({
	SUPPRESS_EMBEDS_DESCRIPTOR: {message: 'Suppress'},
}));
vi.mock('@app/features/messaging/commands/MessageCommands', () => ({
	toggleSuppressEmbeds: vi.fn(),
}));
vi.mock('@app/features/messaging/utils/ExternalLinkUtils', () => ({
	openExternalUrlWithWarning: state.openExternalUrlWithWarning,
}));
vi.mock('@app/features/messaging/utils/MessageNavigator', () => ({
	goToMessage: state.goToMessage,
}));
vi.mock('@app/features/navigation/commands/NavigationCommands', () => ({
	selectChannel: state.selectChannel,
}));
// Keep this component's tests focused on routing and browser interaction; route validation belongs to DeepLinkUtils.
vi.mock('@app/features/navigation/utils/DeepLinkUtils', () => ({
	parseChannelJumpLink: (url: string) => {
		const path = new URL(url).pathname;
		const channelPath = `/channels/${state.scope}/${state.channelId}`;
		return path === channelPath || path === `${channelPath}/${state.messageId}`
			? {scope: state.scope, channelId: state.channelId}
			: null;
	},
	parseMessageJumpLink: (url: string) =>
		new URL(url).pathname === `/channels/${state.scope}/${state.channelId}/${state.messageId}`
			? {
					scope: state.scope,
					channelId: state.channelId,
					messageId: state.messageId,
				}
			: null,
}));
vi.mock('@app/features/navigation/utils/RouterUtils', () => ({
	transitionTo: state.transitionTo,
}));
vi.mock('@app/features/trusted_domain/state/TrustedDomain', () => ({
	default: {isTrustedDomain: () => state.trusted},
}));
vi.mock('@app/features/ui/focus_ring/FocusRing', () => ({
	default: ({children}: {children: ReactNode}) => children,
}));
vi.mock('@lingui/react/macro', () => ({
	Trans: ({children}: {children: ReactNode}) => children,
	useLingui: vi.fn(),
}));

let container: HTMLDivElement;
let root: Root;
const messagePath = () => `/channels/${state.scope}/${state.channelId}/${state.messageId}`;

async function renderLink(url = `${state.appUrl}${messagePath()}`): Promise<HTMLAnchorElement> {
	await act(async () => root.render(<EmbedLink url={url}>Mesaj düzenlendi</EmbedLink>));
	const link = container.querySelector('a');
	if (!link) throw new Error('Embed link did not render');
	return link;
}

async function click(link: HTMLAnchorElement, init: MouseEventInit = {}): Promise<MouseEvent> {
	const event = new MouseEvent('click', {
		bubbles: true,
		cancelable: true,
		button: 0,
		...init,
	});
	await act(async () => {
		link.dispatchEvent(event);
	});
	return event;
}

beforeEach(() => {
	vi.clearAllMocks();
	state.appUrl = 'http://localhost:8088';
	state.scope = '1556486939786346496';
	state.channel = {id: state.channelId, guildId: state.scope};
	state.trusted = true;
	state.promptForChannelGate.mockReturnValue(false);
	state.openLinkChannel.mockReturnValue(false);
	vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
	container = document.createElement('div');
	document.body.append(container);
	root = createRoot(container);
});

afterEach(async () => {
	await act(async () => root.unmount());
	container.remove();
	vi.unstubAllGlobals();
});

describe('internal embed links', () => {
	it('uses the native highlighted message jump in the current tab', async () => {
		const link = await renderLink();
		expect(link.getAttribute('target')).toBeNull();
		expect(link.getAttribute('rel')).toBeNull();
		expect((await click(link)).defaultPrevented).toBe(true);
		expect(state.goToMessage).toHaveBeenCalledWith(state.channelId, state.messageId);
		expect(state.transitionTo).not.toHaveBeenCalled();
		expect(state.openExternalUrlWithWarning).not.toHaveBeenCalled();
	});

	it('handles native keyboard activation on the same focusable anchor', async () => {
		const link = await renderLink();
		link.focus();
		expect(document.activeElement).toBe(link);
		expect((await click(link, {detail: 0})).defaultPrevented).toBe(true);
		expect(state.goToMessage).toHaveBeenCalledWith(state.channelId, state.messageId);
	});

	it.each([{ctrlKey: true}, {metaKey: true}, {shiftKey: true}, {altKey: true}, {button: 1}])(
		'leaves modified clicks to the browser: %j',
		async (init) => {
			const link = await renderLink();
			expect((await click(link, init)).defaultPrevented).toBe(false);
			expect(state.goToMessage).not.toHaveBeenCalled();
			expect(state.promptForChannelGate).not.toHaveBeenCalled();
		},
	);

	it('waits for the existing channel gate before navigating', async () => {
		state.promptForChannelGate.mockReturnValue(true);
		await click(await renderLink());
		expect(state.goToMessage).not.toHaveBeenCalled();
		const target = state.promptForChannelGate.mock.calls[0][0];
		expect(target).toMatchObject({
			channelId: state.channelId,
			guildId: state.scope,
		});
		target.onConfirm();
		expect(state.goToMessage).toHaveBeenCalledWith(state.channelId, state.messageId);
	});

	it('lets native link channels handle their destination after the gate', async () => {
		state.openLinkChannel.mockReturnValue(true);
		await click(await renderLink());
		expect(state.openLinkChannel).toHaveBeenCalledWith(state.channel, {
			skipGate: true,
		});
		expect(state.goToMessage).not.toHaveBeenCalled();
	});

	it('opens a channel without a message through native channel navigation', async () => {
		await click(await renderLink(`${state.appUrl}/channels/${state.scope}/${state.channelId}`));
		expect(state.selectChannel).toHaveBeenCalledWith(state.scope, state.channelId);
		expect(state.goToMessage).not.toHaveBeenCalled();
	});

	it('preserves the requested guild route when the channel has not loaded', async () => {
		state.channel = undefined;
		await click(await renderLink());
		expect(state.transitionTo).toHaveBeenCalledWith(messagePath());
		expect(state.goToMessage).not.toHaveBeenCalled();
	});

	it('does not resolve a mismatched guild path as the known channel', async () => {
		state.channel = {id: state.channelId, guildId: '1556486939786346497'};
		await click(await renderLink());
		expect(state.transitionTo).toHaveBeenCalledWith(messagePath());
		expect(state.goToMessage).not.toHaveBeenCalled();
	});

	it('uses native DM navigation for a private channel', async () => {
		state.scope = '@me';
		state.channel = {id: state.channelId, guildId: null};
		await click(await renderLink(`http://localhost:8088/channels/@me/${state.channelId}`));
		expect(state.selectChannel).toHaveBeenCalledWith(undefined, state.channelId);
	});
});

describe('external embed links', () => {
	it.each(['http://localhost:8089', 'https://localhost:8088', 'https://fluxer.app', 'https://example.org'])(
		'keeps a different instance/origin external: %s',
		async (origin) => {
			const link = await renderLink(`${origin}${messagePath()}`);
			expect(link.target).toBe('_blank');
			expect(link.rel).toBe('noopener noreferrer');
			expect((await click(link)).defaultPrevented).toBe(false);
			expect(state.goToMessage).not.toHaveBeenCalled();
		},
	);

	it('preserves the warning for untrusted external destinations', async () => {
		state.trusted = false;
		const url = 'https://example.org/details';
		expect((await click(await renderLink(url))).defaultPrevented).toBe(true);
		expect(state.openExternalUrlWithWarning).toHaveBeenCalledWith(url);
		expect(state.goToMessage).not.toHaveBeenCalled();
	});

	it('leaves other same-instance pages outside channel/message routing', async () => {
		const link = await renderLink(`${state.appUrl}/channels/${state.scope}/application-settings`);
		expect(link.target).toBe('_blank');
		await click(link);
		expect(state.goToMessage).not.toHaveBeenCalled();
		expect(state.selectChannel).not.toHaveBeenCalled();
	});
});
