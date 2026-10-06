// SPDX-License-Identifier: AGPL-3.0-or-later

import {AUTO_MOD_COPY as COPY} from '@app/features/application_settings/AutoModCopy';
import {AutoModEntryList} from '@app/features/application_settings/AutoModEntryList';
import {
	AutoModCollapsibleSection,
	AutoModRuleSettings,
	type AutoModRuleSettingsProps,
} from '@app/features/application_settings/AutoModRuleSettings';
import {Textarea} from '@app/features/ui/components/form/FormInput';
import {AutoModLinkWhitelist} from '@fluxer/schema/src/domains/guild/GuildAutoModSchemas';
import {useLingui} from '@lingui/react/macro';
import {useRef} from 'react';

export function AutoModLinkSettings({
	ruleId,
	pending,
	onPendingChange,
	onWhitelistChange,
	domainText,
	onDomainTextChange,
	...props
}: AutoModRuleSettingsProps & {
	ruleId: 'server_invites' | 'external_links';
	pending: string;
	onPendingChange: (text: string) => void;
	onWhitelistChange: (prefixes: Array<string>) => void;
	domainText: string;
	onDomainTextChange: (text: string) => void;
}) {
	const {i18n} = useLingui();
	const showLegacyDomains = useRef(props.rule.allowed_domains.length > 0);
	return (
		<AutoModRuleSettings
			{...props}
			title={i18n._(COPY[ruleId])}
			dataFlx={`application-settings.automod.${ruleId === 'server_invites' ? 'server-invites' : 'external-links'}`}
		>
			<AutoModEntryList
				label={i18n._(COPY.linkWhitelist)}
				value={props.available.settings.link_whitelist}
				pending={pending}
				onPendingChange={onPendingChange}
				onChange={onWhitelistChange}
				disabled={props.busy}
				maxEntries={100}
				maxEntryLength={2048}
				caseSensitive
				placeholder="https://example.com/allowed/"
				hint={i18n._(COPY.linkHint)}
				errorText={i18n._(COPY.linkInvalid)}
				validate={(entries) => AutoModLinkWhitelist.safeParse(entries).success}
				showCount
			/>
			{showLegacyDomains.current && (
				<AutoModCollapsibleSection title={i18n._(COPY.domains)} initiallyOpen={false}>
					<Textarea
						label={i18n._(COPY.domains)}
						value={domainText}
						disabled={props.busy}
						maxLength={25400}
						onChange={(event) => onDomainTextChange(event.target.value)}
					/>
				</AutoModCollapsibleSection>
			)}
		</AutoModRuleSettings>
	);
}
