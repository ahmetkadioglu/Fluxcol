// SPDX-License-Identifier: AGPL-3.0-or-later

import {Routes} from '@app/app/Routes';
import Channels from '@app/features/channel/state/Channels';
import SelectedChannel from '@app/features/navigation/state/SelectedChannel';
import Permission from '@app/features/permissions/state/Permission';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';

export function getApplicationSettingsChannelId(guildId: string): string | undefined {
	const channelId = SelectedChannel.getNavigableSelectedChannelId(guildId);
	const channel = channelId ? Channels.getChannel(channelId) : undefined;
	if (channel && channel.guildId === guildId && Permission.can(Permissions.VIEW_CHANNEL, {channelId: channel.id})) {
		return channel.id;
	}
	return undefined;
}

export function getApplicationSettingsReturnPath(guildId: string): string {
	return Routes.guildChannel(guildId, getApplicationSettingsChannelId(guildId));
}
