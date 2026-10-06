// @vitest-environment happy-dom
// SPDX-License-Identifier: AGPL-3.0-or-later

import 'urlpattern-polyfill';
import {ChannelRouteLayout} from '@app/app/router/components/ChannelRouteLayout';
import {createRootRoute, createRoute} from '@app/features/platform/components/router/RouterBuilder';
import {createRouter} from '@app/features/platform/components/router/RouterCore';
import {createMemoryHistory} from '@app/features/platform/components/router/RouterHistory';
import {RouterProvider} from '@app/features/platform/components/router/RouterReact';
import {observable, runInAction} from 'mobx';
import {act, type ReactNode, useEffect} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const state = vi.hoisted(() => ({
	selfHosted: true,
	owner: true,
	canView: true,
	selected: 'channel' as string | null,
	channel: {id: 'channel', guildId: 'guild'} as {id: string; guildId: string} | undefined,
	mounts: vi.fn(),
	unmounts: vi.fn(),
}));
vi.mock('@app/features/app/state/RuntimeConfig', () => ({default: {isSelfHosted: () => state.selfHosted}}));
vi.mock('@app/features/auth/state/Authentication', () => ({default: {currentUserId: 'owner'}}));
vi.mock('@app/features/guild/state/Guilds', () => ({
	default: {getGuild: () => ({id: 'guild', isOwner: () => state.owner})},
}));
vi.mock('@app/features/channel/state/Channels', () => ({default: {getChannel: () => state.channel}}));
vi.mock('@app/features/navigation/state/SelectedChannel', () => ({
	default: {getNavigableSelectedChannelId: () => state.selected},
}));
vi.mock('@app/features/permissions/state/Permission', () => ({default: {can: () => state.canView}}));
vi.mock('@app/features/navigation/utils/ChannelNavigationGuard', () => ({
	tryInterceptChannelNavigationPath: () => false,
}));
vi.mock('@app/features/channel/components/ChannelLayout', () => ({
	ChannelLayout: ({children}: {children: ReactNode}) => <main>{children}</main>,
}));
vi.mock('@app/features/channel/components/ChannelIndexPage', () => ({
	ChannelIndexPage: ({channelId}: {channelId: string}) => {
		useEffect(() => {
			state.mounts();
			return () => state.unmounts();
		}, []);
		return <textarea data-channel={channelId} defaultValue="draft message" />;
	},
}));

let container: HTMLDivElement;
let root: Root;
let permissions: {canView: boolean};
beforeEach(() => {
	Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
	permissions = observable({canView: true});
	Object.defineProperty(state, 'canView', {configurable: true, get: () => permissions.canView});
	state.selfHosted = true;
	state.owner = true;
	state.selected = 'channel';
	state.channel = {id: 'channel', guildId: 'guild'};
	state.mounts.mockClear();
	state.unmounts.mockClear();
	container = document.createElement('div');
	document.body.append(container);
	root = createRoot(container);
});
afterEach(async () => {
	await act(async () => root.unmount());
	container.remove();
});

async function renderRoute(path = '/channels/guild/channel') {
	const rootRoute = createRootRoute();
	const channelsRoute = createRoute({path: '/channels/:guildId'});
	const contentRoute = createRoute({layout: ChannelRouteLayout});
	const settingsRoute = createRoute({
		path: '/channels/:guildId/application-settings',
		component: () => <div role="dialog">Application settings</div>,
	});
	const channelRoute = createRoute({path: '/channels/:guildId/:channelId'});
	const messageRoute = createRoute({path: '/channels/:guildId/:channelId/:messageId'});
	const history = createMemoryHistory(`http://localhost${path}`);
	const router = createRouter({
		routes: rootRoute
			.addChildren([
				channelsRoute.addChildren([
					contentRoute.addChildren([settingsRoute, channelRoute.addChildren([messageRoute])]),
				]),
			])
			.build(),
		history,
	});
	await act(async () => root.render(<RouterProvider router={router} />));
	return {router, history};
}

describe('channel background beneath application settings', () => {
	it('keeps the channel mounted with its draft across opening, module selection and browser back/forward', async () => {
		const {router, history} = await renderRoute();
		const channel = container.querySelector('textarea')!;
		channel.value = 'unfinished message';
		await act(async () => router.navigate('/channels/guild/application-settings'));
		expect(router.getState().matches.at(-1)?.params.channelId).toBeUndefined();
		expect(container.querySelector('textarea')).toBe(channel);
		expect(channel.value).toBe('unfinished message');
		expect(container.querySelector('[role="dialog"]')).not.toBeNull();
		await act(async () => router.navigate('/channels/guild/application-settings?module=tickets'));
		await act(async () => history.go(-2));
		expect(container.querySelector('[role="dialog"]')).toBeNull();
		await act(async () => history.go(2));
		expect(container.querySelector('[role="dialog"]')).not.toBeNull();
		expect(container.querySelector('textarea')).toBe(channel);
		expect(state.mounts).toHaveBeenCalledTimes(1);
		expect(state.unmounts).not.toHaveBeenCalled();
	});
	it('uses the last accessible channel for a direct settings link', async () => {
		await renderRoute('/channels/guild/application-settings?module=tickets');
		expect(container.querySelector('textarea')?.dataset.channel).toBe('channel');
	});
	it.each(['missing-selection', 'deleted-channel', 'other-community', 'lost-permission', 'non-owner', 'hosted'])(
		'does not expose a channel background for %s',
		async (scenario) => {
			if (scenario === 'missing-selection') state.selected = null;
			if (scenario === 'deleted-channel') state.channel = undefined;
			if (scenario === 'other-community') state.channel = {id: 'channel', guildId: 'other'};
			if (scenario === 'lost-permission')
				runInAction(() => {
					permissions.canView = false;
				});
			if (scenario === 'non-owner') state.owner = false;
			if (scenario === 'hosted') state.selfHosted = false;
			await renderRoute('/channels/guild/application-settings');
			expect(container.querySelector('textarea')).toBeNull();
		},
	);
	it('removes the background reactively if channel access is lost', async () => {
		await renderRoute('/channels/guild/application-settings');
		await act(async () => {
			runInAction(() => {
				permissions.canView = false;
			});
		});
		expect(container.querySelector('textarea')).toBeNull();
	});
	it('preserves channel and message route parameters', async () => {
		const {router} = await renderRoute('/channels/guild/channel/message');
		expect(router.getState().matches.at(-1)?.params).toMatchObject({
			guildId: 'guild',
			channelId: 'channel',
			messageId: 'message',
		});
		expect(container.querySelector('textarea')?.dataset.channel).toBe('channel');
	});
});
