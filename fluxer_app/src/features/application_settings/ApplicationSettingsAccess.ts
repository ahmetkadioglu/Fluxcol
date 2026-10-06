// SPDX-License-Identifier: AGPL-3.0-or-later

import RuntimeConfig from '@app/features/app/state/RuntimeConfig';
import Authentication from '@app/features/auth/state/Authentication';
import type {Guild} from '@app/features/guild/models/Guild';

// UI access only. Future configuration endpoints must authorize independently.
export function canAccessApplicationSettings(guild: Pick<Guild, 'isOwner'> | undefined): boolean {
	return RuntimeConfig.isSelfHosted() && !!guild?.isOwner(Authentication.currentUserId);
}
