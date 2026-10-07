// SPDX-License-Identifier: AGPL-3.0-or-later
import type {GuildID} from '@app/api/BrandedTypes';
import type {GuildRole} from '@app/api/models/GuildRole';
import {ElevatedPermissions} from '@fluxer/constants/src/ChannelConstants';

// The community owner approves the policy. System authority is restricted to
// ordinary starting roles, never @everyone, managed roles or staff privileges.
export function automaticRoleEligible(role: GuildRole, guildId: GuildID) {
	return (
		role.guildId === guildId &&
		String(role.id) !== String(guildId) &&
		!(('managed' in role && role.managed) || ('isManaged' in role && role.isManaged)) &&
		(role.permissions & ElevatedPermissions) === 0n
	);
}
