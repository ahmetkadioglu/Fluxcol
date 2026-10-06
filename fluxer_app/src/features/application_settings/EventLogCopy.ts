// SPDX-License-Identifier: AGPL-3.0-or-later

import {msg} from '@lingui/core/macro';

export const EVENT_LOG_COPY = {
	available: msg({
		id: 'netrcol.application_settings.logs.available',
		message: 'Event logs are available. Other modules are design previews.',
	}),
	scope: msg({
		id: 'netrcol.application_settings.logs.scope',
		message: 'Log member joins and departures in the selected text channel. Bots and message contents are excluded.',
	}),
	memberJoin: msg({id: 'netrcol.application_settings.logs.memberJoin', message: 'Member joined'}),
	memberLeave: msg({id: 'netrcol.application_settings.logs.memberLeave', message: 'Member left'}),
	test: msg({id: 'netrcol.application_settings.logs.test', message: 'Send test message'}),
	testQueued: msg({
		id: 'netrcol.application_settings.logs.testQueued',
		message: 'Test queued. Check the selected channel and action history.',
	}),
	loadError: msg({
		id: 'netrcol.application_settings.logs.loadError',
		message: 'Could not load event logs. Check your access and try again.',
	}),
	saveError: msg({
		id: 'netrcol.application_settings.logs.saveError',
		message: 'Could not save. Choose a valid channel and at least one event, then try again.',
	}),
	conflict: msg({
		id: 'netrcol.application_settings.logs.conflict',
		message: 'Settings changed elsewhere. Reload before saving.',
	}),
	ownerChanged: msg({
		id: 'netrcol.application_settings.logs.ownerChanged',
		message: 'Paused after ownership changed. Save to approve these settings.',
	}),
	channelMissing: msg({
		id: 'netrcol.application_settings.logs.channelMissing',
		message: 'The saved channel is unavailable. Choose another channel and save.',
	}),
	stopped: msg({
		id: 'netrcol.application_settings.logs.stopped',
		message: 'Automations are stopped by the instance operator.',
	}),
	emptyHistory: msg({id: 'netrcol.application_settings.logs.emptyHistory', message: 'No module actions yet.'}),
	historyInfo: msg({
		id: 'netrcol.application_settings.logs.historyInfo',
		message: 'Latest 50 actions. Delivery records are kept for 30 days and settings changes for 90 days.',
	}),
	policyChanged: msg({
		id: 'netrcol.application_settings.logs.policyChanged',
		message: 'Skipped because the module settings or owner changed.',
	}),
	deliveryFailed: msg({
		id: 'netrcol.application_settings.logs.deliveryFailed',
		message: 'Delivery failed. Check the channel and worker, then send a test.',
	}),
	botSkipped: msg({id: 'netrcol.application_settings.logs.botSkipped', message: 'Bot or system account excluded.'}),
	enabled: msg({id: 'netrcol.application_settings.logs.enabled', message: 'Enabled'}),
	disabled: msg({id: 'netrcol.application_settings.logs.disabled', message: 'Disabled'}),
	pending: msg({id: 'netrcol.application_settings.logs.pending', message: 'Pending'}),
	running: msg({id: 'netrcol.application_settings.logs.running', message: 'Running'}),
	sent: msg({id: 'netrcol.application_settings.logs.sent', message: 'Sent'}),
	skipped: msg({id: 'netrcol.application_settings.logs.skipped', message: 'Skipped'}),
	failed: msg({id: 'netrcol.application_settings.logs.failed', message: 'Failed'}),
	saved: msg({id: 'netrcol.application_settings.logs.saved', message: 'Saved'}),
	configUpdated: msg({id: 'netrcol.application_settings.logs.configUpdated', message: 'Event log settings updated'}),
	save: msg({id: 'netrcol.application_settings.logs.save', message: 'Save changes'}),
	reset: msg({id: 'netrcol.application_settings.logs.reset', message: 'Reset'}),
	refresh: msg({id: 'netrcol.application_settings.logs.refresh', message: 'Refresh'}),
	system: msg({id: 'netrcol.application_settings.logs.system', message: 'System'}),
	user: msg({id: 'netrcol.application_settings.logs.user', message: 'User'}),
	ready: msg({id: 'netrcol.application_settings.logs.ready', message: 'Available'}),
};
