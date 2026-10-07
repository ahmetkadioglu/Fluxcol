// SPDX-License-Identifier: AGPL-3.0-or-later
import {msg} from '@lingui/core/macro';
export const AUTOMATIC_ROLE_COPY = {
	memberRoles: msg({id: 'netrcol.automatic_roles.memberRoles', message: 'Member roles'}),
	botRoles: msg({id: 'netrcol.automatic_roles.botRoles', message: 'Bot roles'}),
	delay: msg({id: 'netrcol.automatic_roles.delay', message: 'Assignment delay (seconds)'}),
	roleHelp: msg({
		id: 'netrcol.automatic_roles.roleHelp',
		message: 'Only ordinary starting roles can be assigned. Existing member roles are kept.',
	}),
	botHelp: msg({id: 'netrcol.automatic_roles.botHelp', message: 'Leave this empty to skip bots.'}),
	assigned: msg({id: 'netrcol.automatic_roles.assigned', message: 'Automatic role assignment'}),
	roleUnavailable: msg({
		id: 'netrcol.automatic_roles.roleUnavailable',
		message: 'A selected role is missing or has management permissions. Remove it before saving.',
	}),
	noRoles: msg({id: 'netrcol.automatic_roles.noRoles', message: 'No roles selected for this account type.'}),
	configUpdated: msg({id: 'netrcol.automatic_roles.configUpdated', message: 'Automatic role settings updated'}),
	loadError: msg({
		id: 'netrcol.automatic_roles.loadError',
		message: 'Could not load role settings. Check your access and try again.',
	}),
	saveError: msg({
		id: 'netrcol.automatic_roles.saveError',
		message: 'Could not save. Choose valid roles and a delay from 0 to 3600 seconds.',
	}),
};
