// SPDX-License-Identifier: AGPL-3.0-or-later

import {ConfirmModal} from '@app/features/app/components/dialogs/ConfirmModal';
import RuntimeConfig from '@app/features/app/state/RuntimeConfig';
import * as ChannelGateCommands from '@app/features/channel/commands/ChannelGateCommands';
import * as LinkChannelCommands from '@app/features/channel/commands/LinkChannelCommands';
import styles from '@app/features/channel/components/embeds/ChannelEmbed.module.css';
import {
	type LinkComponentProps,
	logger,
} from '@app/features/channel/components/embeds/channel_embed/ChannelEmbedShared';
import Channels from '@app/features/channel/state/Channels';
import {SUPPRESS_EMBEDS_DESCRIPTOR} from '@app/features/i18n/utils/CommonMessageDescriptors';
import * as MessageCommands from '@app/features/messaging/commands/MessageCommands';
import type {Message} from '@app/features/messaging/models/MessagingMessage';
import {openExternalUrlWithWarning} from '@app/features/messaging/utils/ExternalLinkUtils';
import {goToMessage} from '@app/features/messaging/utils/MessageNavigator';
import * as NavigationCommands from '@app/features/navigation/commands/NavigationCommands';
import {
	type ChannelJumpLink,
	type MessageJumpLink,
	parseChannelJumpLink,
	parseMessageJumpLink,
} from '@app/features/navigation/utils/DeepLinkUtils';
import * as RouterUtils from '@app/features/navigation/utils/RouterUtils';
import TrustedDomain from '@app/features/trusted_domain/state/TrustedDomain';
import FocusRing from '@app/features/ui/focus_ring/FocusRing';
import {ME} from '@fluxer/constants/src/AppConstants';
import {Trans, useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import type {FC} from 'react';

function getInternalJumpLink(url: string): ChannelJumpLink | MessageJumpLink | null {
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
		const appOrigin = new URL(RuntimeConfig.webAppBaseUrl).origin;
		if (parsed.origin !== globalThis.location?.origin && parsed.origin !== appOrigin) return null;
		return parseMessageJumpLink(url) ?? parseChannelJumpLink(url);
	} catch {
		return null;
	}
}

export const EmbedLink: FC<LinkComponentProps> = observer(({url, children, className}) => {
	const internalJump = getInternalJumpLink(url);
	const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
		e.stopPropagation();
		if (internalJump) {
			if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
			e.preventDefault();
			const channel = Channels.getChannel(internalJump.channelId);
			const navigateToTarget = () => {
				if (!channel || (channel.guildId ?? ME) !== internalJump.scope) {
					RouterUtils.transitionTo(new URL(url).pathname);
					return;
				}
				if (LinkChannelCommands.openLinkChannel(channel, {skipGate: true})) return;
				if ('messageId' in internalJump) {
					goToMessage(internalJump.channelId, internalJump.messageId);
				} else {
					NavigationCommands.selectChannel(
						internalJump.scope === ME ? undefined : internalJump.scope,
						internalJump.channelId,
					);
				}
			};
			if (
				!ChannelGateCommands.promptForChannelGate({
					channel,
					channelId: internalJump.channelId,
					guildId: internalJump.scope === ME ? null : internalJump.scope,
					onConfirm: navigateToTarget,
				})
			) {
				navigateToTarget();
			}
			return;
		}
		try {
			const parsed = new URL(url);
			if (!TrustedDomain.isTrustedDomain(parsed.hostname)) {
				e.preventDefault();
				openExternalUrlWithWarning(url);
			}
		} catch (_error) {
			logger.warn('Invalid URL in embed link:', url);
		}
	};
	return (
		<FocusRing data-flx="channel.embeds.embed.link-component.focus-ring">
			<a
				className={clsx(styles.embedLink, className)}
				href={url}
				rel={internalJump ? undefined : 'noopener noreferrer'}
				target={internalJump ? undefined : '_blank'}
				onClick={handleClick}
				data-flx="channel.embeds.embed.link-component.a"
			>
				{children}
			</a>
		</FocusRing>
	);
});
export const SuppressEmbedsConfirmModal: FC<{message: Message}> = ({message}) => {
	const {i18n} = useLingui();
	return (
		<ConfirmModal
			title={i18n._(SUPPRESS_EMBEDS_DESCRIPTOR)}
			description={
				<Trans>
					Are you sure you want to suppress all link embeds on this message? This action will hide all embeds from this
					message.
				</Trans>
			}
			primaryText={i18n._(SUPPRESS_EMBEDS_DESCRIPTOR)}
			primaryVariant="danger"
			onPrimary={async () => {
				await MessageCommands.toggleSuppressEmbeds(message.channelId, message.id, message.flags);
			}}
			data-flx="channel.embeds.embed.suppress-embeds-confirm-modal.confirm-modal"
		/>
	);
};
