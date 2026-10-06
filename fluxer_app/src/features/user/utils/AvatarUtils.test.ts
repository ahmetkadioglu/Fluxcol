// @vitest-environment happy-dom
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	getDefaultAvatarURL,
	getDefaultAvatarURLForIndex,
	getGuildMemberAvatarURL,
	getGuildMemberDisplayAvatarURL,
	getGuildMemberNotificationAvatarURL,
	getUserAvatarURL,
	getUserAvatarURLWithProxy,
	getUserNotificationAvatarURL,
	getWebhookAvatarURL,
} from '@app/features/user/utils/AvatarUtils';
import netrcolSystemLogo from '@app/media/images/netrcol-system-logo.jpg';
import {afterEach, describe, expect, it, vi} from 'vitest';

vi.mock('@app/features/app/state/RuntimeConfig', () => ({
	default: {mediaEndpoint: 'https://media.example', staticCdnEndpoint: 'https://static.example'},
}));
vi.mock('@app/features/devtools/state/DeveloperOptions', () => ({default: {forceRenderPlaceholders: false}}));
vi.mock('@app/features/messaging/utils/MediaProxyUtils', () => ({
	buildMediaProxyURL: (url: string) => url,
	LARGEST_MEDIA_PROXY_IMAGE_SIZE: 4096,
	MEDIA_PROXY_IMAGE_SIZE_LADDER: [32, 64, 128, 256, 512, 1024, 2048, 4096],
	snapMediaProxyImageSize: (size: number) => size,
}));

afterEach(() => vi.unstubAllGlobals());

describe('Netrcol system avatar', () => {
	const system = {id: '0', avatar: null};
	const logoURL = () => new URL(netrcolSystemLogo, window.location.origin).href;
	const avatarReaders = [
		['default and failed-image fallback', () => getDefaultAvatarURL(system.id)],
		['chat', () => getUserAvatarURL(system)],
		['animated chat', () => getUserAvatarURL(system, true)],
		['notification', () => getUserNotificationAvatarURL(system)],
		['proxied chat', () => getUserAvatarURLWithProxy(system, 'https://proxy.example')],
		['guild profile', () => getGuildMemberAvatarURL({guildId: '123', userId: system.id, avatar: null})],
		['guild display', () => getGuildMemberDisplayAvatarURL({guildId: '123', user: system})],
		[
			'guild notification',
			() => getGuildMemberNotificationAvatarURL({guildId: '123', userId: system.id, avatar: null}),
		],
	] as const;

	it.each(avatarReaders)('uses the bundled logo for %s', (_label, readAvatar) => {
		expect(readAvatar()).toBe(logoURL());
		expect(new URL(readAvatar()).origin).toBe(window.location.origin);
	});

	it('keeps the normal default avatar for other users sharing avatar index zero', () => {
		const normalUser = {id: '6', avatar: null};
		const normalAvatar = getDefaultAvatarURLForIndex(0);
		expect(getDefaultAvatarURL(normalUser.id)).toBe(normalAvatar);
		expect(getUserAvatarURL(normalUser)).toBe(normalAvatar);
		expect(getUserNotificationAvatarURL(normalUser)).toBe(normalAvatar);
		expect(getGuildMemberAvatarURL({guildId: '123', userId: normalUser.id, avatar: null})).toBe(normalAvatar);
		expect(getUserAvatarURLWithProxy(normalUser, 'https://proxy.example')).toBe(normalAvatar);
	});

	it('continues to resolve uploaded avatars through their configured media endpoint', () => {
		const normalUser = {id: '6', avatar: 'custom'};
		expect(getUserAvatarURL(normalUser)).toMatch(/^https:\/\/media\.example\/avatars\/6\/custom\.webp\?size=/);
		expect(getUserNotificationAvatarURL(normalUser)).toMatch(
			/^https:\/\/media\.example\/avatars\/6\/custom\.png\?size=/,
		);
		expect(getUserAvatarURLWithProxy(normalUser, 'https://proxy.example')).toMatch(
			/^https:\/\/proxy\.example\/avatars\/6\/custom\.webp\?size=/,
		);
	});

	it('does not treat webhook default avatars as the system account', () => {
		expect(getWebhookAvatarURL(system)).toBe(getDefaultAvatarURLForIndex(0));
	});

	it('can resolve the bundled logo without a browser window', () => {
		vi.stubGlobal('window', undefined);
		expect(getDefaultAvatarURL(system.id)).toBe(netrcolSystemLogo);
	});
});
