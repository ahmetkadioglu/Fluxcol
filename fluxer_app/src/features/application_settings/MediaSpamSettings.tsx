// SPDX-License-Identifier: AGPL-3.0-or-later

import {AutoModRateSettings} from '@app/features/application_settings/AutoModRateSettings';
import type {AutoModRuleSettingsProps} from '@app/features/application_settings/AutoModRuleSettings';

export function MediaSpamSettings(props: AutoModRuleSettingsProps) {
	return <AutoModRateSettings {...props} id="media_spam" />;
}
