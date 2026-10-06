// SPDX-License-Identifier: AGPL-3.0-or-later

import type {MessageDescriptor} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import type {Icon} from '@phosphor-icons/react';
import {
	ButterflyIcon,
	CakeIcon,
	ChartBarHorizontalIcon,
	ChartBarIcon,
	ChatsCircleIcon,
	CheckSquareIcon,
	ClipboardTextIcon,
	ClockIcon,
	GavelIcon,
	GearIcon,
	GiftIcon,
	HandWavingIcon,
	HashIcon,
	LinkIcon,
	ListBulletsIcon,
	PlayIcon,
	RankingIcon,
	RssIcon,
	ShieldCheckIcon,
	ShieldIcon,
	SmileyIcon,
	SmileyStickerIcon,
	StarIcon,
	TerminalWindowIcon,
	TicketIcon,
	TrendUpIcon,
	TrophyIcon,
	TwitchLogoIcon,
	UserPlusIcon,
	XLogoIcon,
	YoutubeLogoIcon,
} from '@phosphor-icons/react';

export const APPLICATION_SETTINGS_COPY = {
	overview: msg({id: 'netrcol.application_settings.copy.overview', message: 'Overview'}),
	previewNotice: msg({
		id: 'netrcol.application_settings.copy.previewNotice',
		message: 'Explore the planned module screens. Modules are not active yet and these settings are not saved.',
	}),
	configuration: msg({id: 'netrcol.application_settings.copy.configuration', message: 'Configuration'}),
	configurationDescription: msg({
		id: 'netrcol.application_settings.copy.configurationDescription',
		message: 'A preview of the options planned for this module.',
	}),
	enable: msg({id: 'netrcol.application_settings.copy.enable', message: 'Enable module'}),
	enableDescription: msg({
		id: 'netrcol.application_settings.copy.enableDescription',
		message: 'This module will be available after its implementation is complete.',
	}),
};

export const APPLICATION_SETTINGS_GROUPS = [
	{id: 'general', title: msg({id: 'netrcol.application_settings.group.general', message: 'General'})},
	{id: 'essentials', title: msg({id: 'netrcol.application_settings.group.essentials', message: 'Essentials'})},
	{id: 'management', title: msg({id: 'netrcol.application_settings.group.management', message: 'Server management'})},
	{id: 'games', title: msg({id: 'netrcol.application_settings.group.games', message: 'Games & fun'})},
	{id: 'utilities', title: msg({id: 'netrcol.application_settings.group.utilities', message: 'Utilities'})},
	{id: 'social', title: msg({id: 'netrcol.application_settings.group.social', message: 'Social alerts'})},
] as const;

export const APPLICATION_SETTINGS_FIELDS = {
	channel: {
		label: msg({id: 'netrcol.application_settings.field.channel', message: 'Message channel'}),
		value: msg({id: 'netrcol.application_settings.example.channel', message: 'No channel selected'}),
		multiline: false,
	},
	role: {
		label: msg({id: 'netrcol.application_settings.field.role', message: 'Member role'}),
		value: msg({id: 'netrcol.application_settings.example.role', message: 'No role selected'}),
		multiline: false,
	},
	roles: {
		label: msg({id: 'netrcol.application_settings.field.roles', message: 'Allowed roles'}),
		value: msg({id: 'netrcol.application_settings.example.roles', message: 'No roles selected'}),
		multiline: false,
	},
	message: {
		label: msg({id: 'netrcol.application_settings.field.message', message: 'Message template'}),
		value: msg({id: 'netrcol.application_settings.example.message', message: 'Welcome, {member}!'}),
		multiline: true,
	},
	goodbye: {
		label: msg({id: 'netrcol.application_settings.field.goodbye', message: 'Goodbye message'}),
		value: msg({id: 'netrcol.application_settings.example.goodbye', message: 'See you again, {member}.'}),
		multiline: true,
	},
	response: {
		label: msg({id: 'netrcol.application_settings.field.response', message: 'Response template'}),
		value: msg({id: 'netrcol.application_settings.example.response', message: 'Your community message goes here.'}),
		multiline: true,
	},
	period: {
		label: msg({id: 'netrcol.application_settings.field.period', message: 'Ranking period'}),
		value: msg({id: 'netrcol.application_settings.example.period', message: 'Weekly'}),
		multiline: false,
	},
	members: {
		label: msg({id: 'netrcol.application_settings.field.members', message: 'Visible members'}),
		value: msg({id: 'netrcol.application_settings.example.members', message: '10'}),
		multiline: false,
	},
	scope: {
		label: msg({id: 'netrcol.application_settings.field.scope', message: 'Statistics scope'}),
		value: msg({id: 'netrcol.application_settings.example.scope', message: 'Messages and member activity'}),
		multiline: false,
	},
	frequency: {
		label: msg({id: 'netrcol.application_settings.field.frequency', message: 'Update interval'}),
		value: msg({id: 'netrcol.application_settings.example.frequency', message: 'Every 15 minutes'}),
		multiline: false,
	},
	limit: {
		label: msg({id: 'netrcol.application_settings.field.limit', message: 'Usage limit'}),
		value: msg({id: 'netrcol.application_settings.example.limit', message: '10'}),
		multiline: false,
	},
	language: {
		label: msg({id: 'netrcol.application_settings.field.language', message: 'Community language'}),
		value: msg({id: 'netrcol.application_settings.example.language', message: 'Turkish'}),
		multiline: false,
	},
	timezone: {
		label: msg({id: 'netrcol.application_settings.field.timezone', message: 'Time zone'}),
		value: msg({id: 'netrcol.application_settings.example.timezone', message: 'Europe/Istanbul'}),
		multiline: false,
	},
	reaction: {
		label: msg({id: 'netrcol.application_settings.field.reaction', message: 'Reaction role rules'}),
		value: msg({id: 'netrcol.application_settings.example.reaction', message: 'Emoji → role'}),
		multiline: false,
	},
	selection: {
		label: msg({id: 'netrcol.application_settings.field.selection', message: 'Role selection'}),
		value: msg({id: 'netrcol.application_settings.example.selection', message: 'Multiple roles'}),
		multiline: false,
	},
	xp: {
		label: msg({id: 'netrcol.application_settings.field.xp', message: 'XP per message'}),
		value: msg({id: 'netrcol.application_settings.example.xp', message: '15'}),
		multiline: false,
	},
	rewards: {
		label: msg({id: 'netrcol.application_settings.field.rewards', message: 'Role rewards'}),
		value: msg({id: 'netrcol.application_settings.example.rewards', message: 'No rewards configured'}),
		multiline: false,
	},
	rules: {
		label: msg({id: 'netrcol.application_settings.field.rules', message: 'Moderation rules'}),
		value: msg({id: 'netrcol.application_settings.example.rules', message: 'No rules configured'}),
		multiline: false,
	},
	exempt: {
		label: msg({id: 'netrcol.application_settings.field.exempt', message: 'Exempt roles'}),
		value: msg({id: 'netrcol.application_settings.example.exempt', message: 'No roles selected'}),
		multiline: false,
	},
	joinlimit: {
		label: msg({id: 'netrcol.application_settings.field.joinlimit', message: 'Join rate limit'}),
		value: msg({id: 'netrcol.application_settings.example.joinlimit', message: '10 members / minute'}),
		multiline: false,
	},
	delay: {
		label: msg({id: 'netrcol.application_settings.field.delay', message: 'Assignment delay'}),
		value: msg({id: 'netrcol.application_settings.example.delay', message: 'Immediately'}),
		multiline: false,
	},
	threshold: {
		label: msg({id: 'netrcol.application_settings.field.threshold', message: 'Reaction threshold'}),
		value: msg({id: 'netrcol.application_settings.example.threshold', message: '5'}),
		multiline: false,
	},
	emoji: {
		label: msg({id: 'netrcol.application_settings.field.emoji', message: 'Reaction emoji'}),
		value: msg({id: 'netrcol.application_settings.example.emoji', message: '⭐'}),
		multiline: false,
	},
	words: {
		label: msg({id: 'netrcol.application_settings.field.words', message: 'Blocked words'}),
		value: msg({id: 'netrcol.application_settings.example.words', message: 'No words configured'}),
		multiline: true,
	},
	links: {
		label: msg({id: 'netrcol.application_settings.field.links', message: 'Link policy'}),
		value: msg({id: 'netrcol.application_settings.example.links', message: 'Allow approved domains'}),
		multiline: false,
	},
	spam: {
		label: msg({id: 'netrcol.application_settings.field.spam', message: 'Spam threshold'}),
		value: msg({id: 'netrcol.application_settings.example.spam', message: '5 messages / 10 seconds'}),
		multiline: false,
	},
	events: {
		label: msg({id: 'netrcol.application_settings.field.events', message: 'Tracked events'}),
		value: msg({id: 'netrcol.application_settings.example.events', message: 'Member, message and role changes'}),
		multiline: false,
	},
	invites: {
		label: msg({id: 'netrcol.application_settings.field.invites', message: 'Existing invites'}),
		value: msg({id: 'netrcol.application_settings.example.invites', message: 'Include existing invites'}),
		multiline: false,
	},
	category: {
		label: msg({id: 'netrcol.application_settings.field.category', message: 'Channel category'}),
		value: msg({id: 'netrcol.application_settings.example.category', message: 'No category selected'}),
		multiline: false,
	},
	support: {
		label: msg({id: 'netrcol.application_settings.field.support', message: 'Support roles'}),
		value: msg({id: 'netrcol.application_settings.example.support', message: 'No roles selected'}),
		multiline: false,
	},
	questions: {
		label: msg({id: 'netrcol.application_settings.field.questions', message: 'Registration questions'}),
		value: msg({id: 'netrcol.application_settings.example.questions', message: 'Introduce yourself to the community.'}),
		multiline: true,
	},
	trigger: {
		label: msg({id: 'netrcol.application_settings.field.trigger', message: 'Command trigger'}),
		value: msg({id: 'netrcol.application_settings.example.trigger', message: '/community'}),
		multiline: false,
	},
	duration: {
		label: msg({id: 'netrcol.application_settings.field.duration', message: 'Duration'}),
		value: msg({id: 'netrcol.application_settings.example.duration', message: '24 hours'}),
		multiline: false,
	},
	winners: {
		label: msg({id: 'netrcol.application_settings.field.winners', message: 'Number of winners'}),
		value: msg({id: 'netrcol.application_settings.example.winners', message: '1'}),
		multiline: false,
	},
	wordlength: {
		label: msg({id: 'netrcol.application_settings.field.wordlength', message: 'Minimum word length'}),
		value: msg({id: 'netrcol.application_settings.example.wordlength', message: '3'}),
		multiline: false,
	},
	repeated: {
		label: msg({id: 'netrcol.application_settings.field.repeated', message: 'Repeated words'}),
		value: msg({id: 'netrcol.application_settings.example.repeated', message: 'Do not allow repeats'}),
		multiline: false,
	},
	start: {
		label: msg({id: 'netrcol.application_settings.field.start', message: 'Starting number'}),
		value: msg({id: 'netrcol.application_settings.example.start', message: '1'}),
		multiline: false,
	},
	mistake: {
		label: msg({id: 'netrcol.application_settings.field.mistake', message: 'On an incorrect number'}),
		value: msg({id: 'netrcol.application_settings.example.mistake', message: 'Restart the count'}),
		multiline: false,
	},
	statname: {
		label: msg({id: 'netrcol.application_settings.field.statname', message: 'Channel name template'}),
		value: msg({id: 'netrcol.application_settings.example.statname', message: 'Members: {count}'}),
		multiline: false,
	},
	feed: {
		label: msg({id: 'netrcol.application_settings.field.feed', message: 'Feed URL'}),
		value: msg({id: 'netrcol.application_settings.example.feed', message: 'https://example.com/feed.xml'}),
		multiline: false,
	},
	choices: {
		label: msg({id: 'netrcol.application_settings.field.choices', message: 'Poll choices'}),
		value: msg({id: 'netrcol.application_settings.example.choices', message: 'Option A / Option B'}),
		multiline: false,
	},
	voice: {
		label: msg({id: 'netrcol.application_settings.field.voice', message: 'Source voice channel'}),
		value: msg({id: 'netrcol.application_settings.example.voice', message: 'No voice channel selected'}),
		multiline: false,
	},
	birthday: {
		label: msg({id: 'netrcol.application_settings.field.birthday', message: 'Celebration time'}),
		value: msg({id: 'netrcol.application_settings.example.birthday', message: '09:00'}),
		multiline: false,
	},
	account: {
		label: msg({id: 'netrcol.application_settings.field.account', message: 'Account or channel URL'}),
		value: msg({id: 'netrcol.application_settings.example.account', message: 'No account connected'}),
		multiline: false,
	},
	announcement: {
		label: msg({id: 'netrcol.application_settings.field.announcement', message: 'Announcement template'}),
		value: msg({
			id: 'netrcol.application_settings.example.announcement',
			message: '{creator} shared a new update: {url}',
		}),
		multiline: true,
	},
	actor: {
		label: msg({id: 'netrcol.application_settings.field.actor', message: 'Action author'}),
		value: msg({id: 'netrcol.application_settings.example.actor', message: 'All members'}),
		multiline: false,
	},
	daterange: {
		label: msg({id: 'netrcol.application_settings.field.daterange', message: 'Date range'}),
		value: msg({id: 'netrcol.application_settings.example.daterange', message: 'Last 7 days'}),
		multiline: false,
	},
};

export interface ApplicationSettingsModule {
	id: string;
	group: (typeof APPLICATION_SETTINGS_GROUPS)[number]['id'];
	title: MessageDescriptor;
	description: MessageDescriptor;
	icon: Icon;
	fields: Array<keyof typeof APPLICATION_SETTINGS_FIELDS>;
}

export const APPLICATION_SETTINGS_MODULES: Array<ApplicationSettingsModule> = [
	{
		id: 'leaderboard',
		group: 'general',
		title: msg({id: 'netrcol.application_settings.module.leaderboard.title', message: 'Leaderboard'}),
		description: msg({
			id: 'netrcol.application_settings.module.leaderboard.description',
			message: 'Show the most active members and their community rankings.',
		}),
		icon: RankingIcon,
		fields: ['period', 'members', 'exempt'],
	},
	{
		id: 'statistics',
		group: 'general',
		title: msg({id: 'netrcol.application_settings.module.statistics.title', message: 'Statistics'}),
		description: msg({
			id: 'netrcol.application_settings.module.statistics.description',
			message: 'Follow message activity, member growth and community trends.',
		}),
		icon: ChartBarIcon,
		fields: ['scope', 'channel', 'frequency'],
	},
	{
		id: 'emoji',
		group: 'general',
		title: msg({id: 'netrcol.application_settings.module.emoji.title', message: 'Emoji'}),
		description: msg({
			id: 'netrcol.application_settings.module.emoji.description',
			message: 'Organize community emoji tools and their usage rules.',
		}),
		icon: SmileyIcon,
		fields: ['roles', 'limit', 'channel'],
	},
	{
		id: 'settings',
		group: 'general',
		title: msg({id: 'netrcol.application_settings.module.settings.title', message: 'Module settings'}),
		description: msg({
			id: 'netrcol.application_settings.module.settings.description',
			message: 'Set shared preferences for built-in community modules.',
		}),
		icon: GearIcon,
		fields: ['language', 'timezone', 'roles'],
	},
	{
		id: 'welcome',
		group: 'essentials',
		title: msg({id: 'netrcol.application_settings.module.welcome.title', message: 'Welcome & goodbye'}),
		description: msg({
			id: 'netrcol.application_settings.module.welcome.description',
			message: 'Greet new members and customize messages when someone leaves.',
		}),
		icon: HandWavingIcon,
		fields: ['channel', 'message', 'goodbye'],
	},
	{
		id: 'reaction-roles',
		group: 'essentials',
		title: msg({id: 'netrcol.application_settings.module.reaction-roles.title', message: 'Reaction roles'}),
		description: msg({
			id: 'netrcol.application_settings.module.reaction-roles.description',
			message: 'Let members choose roles through reactions and role menus.',
		}),
		icon: SmileyStickerIcon,
		fields: ['channel', 'reaction', 'selection'],
	},
	{
		id: 'levels',
		group: 'essentials',
		title: msg({id: 'netrcol.application_settings.module.levels.title', message: 'Levels'}),
		description: msg({
			id: 'netrcol.application_settings.module.levels.description',
			message: 'Reward community participation with XP, levels and roles.',
		}),
		icon: TrophyIcon,
		fields: ['xp', 'channel', 'rewards'],
	},
	{
		id: 'moderation',
		group: 'essentials',
		title: msg({id: 'netrcol.application_settings.module.moderation.title', message: 'Moderation'}),
		description: msg({
			id: 'netrcol.application_settings.module.moderation.description',
			message: 'Bring member warnings and moderation actions into one place.',
		}),
		icon: GavelIcon,
		fields: ['channel', 'rules', 'exempt'],
	},
	{
		id: 'security',
		group: 'essentials',
		title: msg({id: 'netrcol.application_settings.module.security.title', message: 'Security'}),
		description: msg({
			id: 'netrcol.application_settings.module.security.description',
			message: 'Plan protections against raids and unusual member activity.',
		}),
		icon: ShieldCheckIcon,
		fields: ['joinlimit', 'role', 'channel'],
	},
	{
		id: 'autorole',
		group: 'essentials',
		title: msg({id: 'netrcol.application_settings.module.autorole.title', message: 'Automatic roles'}),
		description: msg({
			id: 'netrcol.application_settings.module.autorole.description',
			message: 'Assign starting roles to new members automatically.',
		}),
		icon: UserPlusIcon,
		fields: ['role', 'roles', 'delay'],
	},
	{
		id: 'starboard',
		group: 'essentials',
		title: msg({id: 'netrcol.application_settings.module.starboard.title', message: 'Starboard'}),
		description: msg({
			id: 'netrcol.application_settings.module.starboard.description',
			message: 'Collect messages that receive community reactions in a dedicated channel.',
		}),
		icon: StarIcon,
		fields: ['channel', 'threshold', 'emoji'],
	},
	{
		id: 'automod',
		group: 'essentials',
		title: msg({id: 'netrcol.application_settings.module.automod.title', message: 'AutoMod'}),
		description: msg({
			id: 'netrcol.application_settings.module.automod.description',
			message: 'Manage automatic rules for spam, links and unwanted content.',
		}),
		icon: ShieldIcon,
		fields: ['words', 'links', 'spam'],
	},
	{
		id: 'logs',
		group: 'management',
		title: msg({id: 'netrcol.application_settings.module.logs.title', message: 'Event logs'}),
		description: msg({
			id: 'netrcol.application_settings.module.logs.description',
			message: 'Track important member, message and channel events.',
		}),
		icon: ListBulletsIcon,
		fields: ['channel', 'events', 'exempt'],
	},
	{
		id: 'invite-tracking',
		group: 'management',
		title: msg({id: 'netrcol.application_settings.module.invite-tracking.title', message: 'Invite tracking'}),
		description: msg({
			id: 'netrcol.application_settings.module.invite-tracking.description',
			message: 'Understand which invites bring new members to the community.',
		}),
		icon: LinkIcon,
		fields: ['channel', 'invites', 'rewards'],
	},
	{
		id: 'tickets',
		group: 'management',
		title: msg({id: 'netrcol.application_settings.module.tickets.title', message: 'Tickets'}),
		description: msg({
			id: 'netrcol.application_settings.module.tickets.description',
			message: 'Give members a private place to contact the support team.',
		}),
		icon: TicketIcon,
		fields: ['category', 'support', 'response'],
	},
	{
		id: 'register',
		group: 'management',
		title: msg({id: 'netrcol.application_settings.module.register.title', message: 'Registration'}),
		description: msg({
			id: 'netrcol.application_settings.module.register.description',
			message: 'Design the registration and verification flow for new members.',
		}),
		icon: CheckSquareIcon,
		fields: ['channel', 'role', 'questions'],
	},
	{
		id: 'custom-commands',
		group: 'management',
		title: msg({id: 'netrcol.application_settings.module.custom-commands.title', message: 'Custom commands'}),
		description: msg({
			id: 'netrcol.application_settings.module.custom-commands.description',
			message: 'Create community-specific commands and response templates.',
		}),
		icon: TerminalWindowIcon,
		fields: ['trigger', 'response', 'roles'],
	},
	{
		id: 'giveaways',
		group: 'games',
		title: msg({id: 'netrcol.application_settings.module.giveaways.title', message: 'Giveaways'}),
		description: msg({
			id: 'netrcol.application_settings.module.giveaways.description',
			message: 'Organize giveaways with entry rules and winner selection.',
		}),
		icon: GiftIcon,
		fields: ['channel', 'duration', 'winners'],
	},
	{
		id: 'word-game',
		group: 'games',
		title: msg({id: 'netrcol.application_settings.module.word-game.title', message: 'Word game'}),
		description: msg({
			id: 'netrcol.application_settings.module.word-game.description',
			message: 'Create a shared channel for community word games.',
		}),
		icon: ChatsCircleIcon,
		fields: ['channel', 'wordlength', 'repeated'],
	},
	{
		id: 'counting',
		group: 'games',
		title: msg({id: 'netrcol.application_settings.module.counting.title', message: 'Counting'}),
		description: msg({
			id: 'netrcol.application_settings.module.counting.description',
			message: 'Let members build a shared counting streak.',
		}),
		icon: HashIcon,
		fields: ['channel', 'start', 'mistake'],
	},
	{
		id: 'statistics-channels',
		group: 'utilities',
		title: msg({id: 'netrcol.application_settings.module.statistics-channels.title', message: 'Statistics channels'}),
		description: msg({
			id: 'netrcol.application_settings.module.statistics-channels.description',
			message: 'Display live community counts in channel names.',
		}),
		icon: TrendUpIcon,
		fields: ['category', 'statname', 'frequency'],
	},
	{
		id: 'rss',
		group: 'utilities',
		title: msg({id: 'netrcol.application_settings.module.rss.title', message: 'RSS feeds'}),
		description: msg({
			id: 'netrcol.application_settings.module.rss.description',
			message: 'Share updates from selected feeds in community channels.',
		}),
		icon: RssIcon,
		fields: ['feed', 'channel', 'frequency'],
	},
	{
		id: 'polls',
		group: 'utilities',
		title: msg({id: 'netrcol.application_settings.module.polls.title', message: 'Polls'}),
		description: msg({
			id: 'netrcol.application_settings.module.polls.description',
			message: 'Collect member opinions through community polls.',
		}),
		icon: ChartBarHorizontalIcon,
		fields: ['channel', 'duration', 'choices'],
	},
	{
		id: 'temporary-channels',
		group: 'utilities',
		title: msg({id: 'netrcol.application_settings.module.temporary-channels.title', message: 'Temporary channels'}),
		description: msg({
			id: 'netrcol.application_settings.module.temporary-channels.description',
			message: 'Create voice rooms on demand and remove them when empty.',
		}),
		icon: ClockIcon,
		fields: ['voice', 'category', 'limit'],
	},
	{
		id: 'birthdays',
		group: 'utilities',
		title: msg({id: 'netrcol.application_settings.module.birthdays.title', message: 'Birthdays'}),
		description: msg({
			id: 'netrcol.application_settings.module.birthdays.description',
			message: 'Celebrate members on their birthdays with messages and roles.',
		}),
		icon: CakeIcon,
		fields: ['channel', 'birthday', 'role'],
	},
	{
		id: 'youtube',
		group: 'social',
		title: msg({id: 'netrcol.application_settings.module.youtube.title', message: 'YouTube'}),
		description: msg({
			id: 'netrcol.application_settings.module.youtube.description',
			message: 'Share new videos and live streams from selected YouTube channels.',
		}),
		icon: YoutubeLogoIcon,
		fields: ['account', 'channel', 'announcement'],
	},
	{
		id: 'twitch',
		group: 'social',
		title: msg({id: 'netrcol.application_settings.module.twitch.title', message: 'Twitch'}),
		description: msg({
			id: 'netrcol.application_settings.module.twitch.description',
			message: 'Notify the community when selected Twitch creators go live.',
		}),
		icon: TwitchLogoIcon,
		fields: ['account', 'channel', 'announcement'],
	},
	{
		id: 'bluesky',
		group: 'social',
		title: msg({id: 'netrcol.application_settings.module.bluesky.title', message: 'Bluesky'}),
		description: msg({
			id: 'netrcol.application_settings.module.bluesky.description',
			message: 'Share updates from selected Bluesky accounts.',
		}),
		icon: ButterflyIcon,
		fields: ['account', 'channel', 'announcement'],
	},
	{
		id: 'kick',
		group: 'social',
		title: msg({id: 'netrcol.application_settings.module.kick.title', message: 'Kick'}),
		description: msg({
			id: 'netrcol.application_settings.module.kick.description',
			message: 'Notify members when selected Kick creators start streaming.',
		}),
		icon: PlayIcon,
		fields: ['account', 'channel', 'announcement'],
	},
	{
		id: 'x',
		group: 'social',
		title: msg({id: 'netrcol.application_settings.module.x.title', message: 'X'}),
		description: msg({
			id: 'netrcol.application_settings.module.x.description',
			message: 'Share updates from selected X accounts with the community.',
		}),
		icon: XLogoIcon,
		fields: ['account', 'channel', 'announcement'],
	},
	{
		id: 'audit',
		group: 'general',
		title: msg({id: 'netrcol.application_settings.module.audit.title', message: 'Action history'}),
		description: msg({
			id: 'netrcol.application_settings.module.audit.description',
			message: 'Review module configuration changes and automatic actions.',
		}),
		icon: ClipboardTextIcon,
		fields: ['events', 'actor', 'daterange'],
	},
];
