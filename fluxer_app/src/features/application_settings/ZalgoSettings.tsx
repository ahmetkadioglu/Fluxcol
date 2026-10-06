// SPDX-License-Identifier: AGPL-3.0-or-later

import {AUTO_MOD_COPY as COPY} from '@app/features/application_settings/AutoModCopy';
import {
	AutoModRuleSettings,
	type AutoModRuleSettingsProps,
} from '@app/features/application_settings/AutoModRuleSettings';
import {useLingui} from '@lingui/react/macro';

export function ZalgoSettings(props: AutoModRuleSettingsProps) {
	const {i18n} = useLingui();
	return (
		<AutoModRuleSettings {...props} title={i18n._(COPY.zalgo)} dataFlx="application-settings.automod.zalgo">
			{null}
		</AutoModRuleSettings>
	);
}
