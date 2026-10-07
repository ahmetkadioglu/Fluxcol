// SPDX-License-Identifier: AGPL-3.0-or-later

import {msg} from '@lingui/core/macro';

export const MODULE_SETTINGS_COPY = {
	language: msg({id: 'netrcol.module_settings.language', message: 'Netrcol message language'}),
	description: msg({
		id: 'netrcol.module_settings.description',
		message:
			'Choose the language Netrcol uses for event logs and AutoMod messages in this community. Your interface language stays the same.',
	}),
	loadError: msg({
		id: 'netrcol.module_settings.loadError',
		message: 'Could not load module settings. Check your access and try again.',
	}),
	saveError: msg({id: 'netrcol.module_settings.saveError', message: 'Could not save the message language. Try again.'}),
	updated: msg({id: 'netrcol.module_settings.updated', message: 'Netrcol message language updated'}),
};
