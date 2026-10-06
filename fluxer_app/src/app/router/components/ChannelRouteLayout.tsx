// SPDX-License-Identifier: AGPL-3.0-or-later

import {Routes} from '@app/app/Routes';
import {canAccessApplicationSettings} from '@app/features/application_settings/ApplicationSettingsAccess';
import {getApplicationSettingsChannelId} from '@app/features/application_settings/ApplicationSettingsNavigation';
import {ChannelIndexPage} from '@app/features/channel/components/ChannelIndexPage';
import {ChannelLayout} from '@app/features/channel/components/ChannelLayout';
import Guilds from '@app/features/guild/state/Guilds';
import {useLocation, useParams} from '@app/features/platform/components/router/RouterReact';
import {observer} from 'mobx-react-lite';
import type {ReactNode} from 'react';

export const ChannelRouteLayout = observer(({children}: {children: ReactNode}) => {
	const {guildId, channelId: routeChannelId} = useParams() as {guildId: string; channelId?: string};
	const location = useLocation();
	const isApplicationSettings = location.pathname === Routes.guildApplicationSettings(guildId);
	const channelId = isApplicationSettings
		? canAccessApplicationSettings(Guilds.getGuild(guildId))
			? getApplicationSettingsChannelId(guildId)
			: undefined
		: routeChannelId;
	return (
		<>
			{(!isApplicationSettings || channelId) && (
				<ChannelLayout channelId={channelId}>
					<ChannelIndexPage channelId={channelId} />
				</ChannelLayout>
			)}
			{children}
		</>
	);
});
