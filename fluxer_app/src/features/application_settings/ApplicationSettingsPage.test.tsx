// @vitest-environment happy-dom
// SPDX-License-Identifier: AGPL-3.0-or-later

import {getApplicationSettingsReturnPath} from '@app/features/application_settings/ApplicationSettingsNavigation';
import {ApplicationSettingsPage} from '@app/features/application_settings/ApplicationSettingsPage';
import {observable, runInAction} from 'mobx';
import {act, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

interface TestGuild {
	id: string;
	name: string;
	ownerId: string;
	isOwner: (userId: string) => boolean;
}
const state = vi.hoisted(() => ({
	selfHosted: true,
	guild: undefined as TestGuild | undefined,
	selected: 'channel' as string | null,
	channel: undefined as {id: string; guildId: string} | undefined,
	canView: true,
	mobile: false,
	location: new URL('http://localhost/channels/guild/application-settings'),
	routerLocation: undefined as {current: URL} | undefined,
	navigate: vi.fn(),
	restoreScroll: vi.fn(),
}));
vi.mock('@app/features/accessibility/state/Accessibility', () => ({default: {useReducedMotion: true}}));
vi.mock('@app/features/application_settings/EventLogSettings', () => ({
	EventLogSettings: () => <div>Event log settings</div>,
	eventLogTabId: (guildId: string) => `application-settings-event-logs:${guildId}`,
}));
vi.mock('@app/features/application_settings/EventLogHistory', () => ({
	EventLogHistory: () => <div>Event log history</div>,
}));
vi.mock('@app/features/application_settings/AutoModSettings', () => ({
	AutoModSettings: () => <div>AutoMod settings</div>,
}));
vi.mock('@app/features/application_settings/ModuleSettings', () => ({
	ModuleSettings: () => <div>Shared module settings</div>,
}));
vi.mock('@app/features/application_settings/AutomaticRoleSettings', () => ({
	AutomaticRoleSettings: () => <div>Automatic role settings</div>,
}));
vi.mock('@app/features/application_settings/AutomaticRoleHistory', () => ({
	AutomaticRoleHistory: () => <div>Automatic role history</div>,
}));
vi.mock('@app/features/application_settings/AutoModHistory', () => ({
	AutoModHistory: () => <div>AutoMod history</div>,
}));
vi.mock('@app/features/ui/focus_ring/FocusRing', () => ({default: ({children}: {children: ReactNode}) => children}));
vi.mock('@app/features/app/state/RuntimeConfig', () => ({default: {isSelfHosted: () => state.selfHosted}}));
vi.mock('@app/features/auth/state/Authentication', () => ({default: {currentUserId: 'owner'}}));
vi.mock('@app/features/guild/state/Guilds', () => ({default: {getGuild: () => state.guild}}));
vi.mock('@app/features/channel/state/Channels', () => ({default: {getChannel: () => state.channel}}));
vi.mock('@app/features/navigation/state/SelectedChannel', () => ({
	default: {getNavigableSelectedChannelId: () => state.selected},
}));
vi.mock('@app/features/permissions/state/Permission', () => ({default: {can: () => state.canView}}));
vi.mock('@app/features/navigation/utils/RouterUtils', () => ({transitionTo: state.navigate}));
vi.mock('@app/features/platform/components/router/RouterReact', () => ({
	useLocation: () => state.routerLocation!.current,
}));
vi.mock('@app/features/ui/state/MobileLayout', () => ({
	default: {
		get enabled() {
			return state.mobile;
		},
	},
}));
vi.mock('@app/features/messaging/utils/MessagingUrlUtils', () => ({marketingUrl: (path: string) => path}));
vi.mock('@app/features/window/hooks/useFluxerDocumentTitle', () => ({useFluxerDocumentTitle: () => {}}));
vi.mock('@lingui/core/macro', () => ({
	msg: (value: {message: string} | TemplateStringsArray) => ('message' in value ? value : {message: value.join('')}),
}));
vi.mock('@lingui/react/macro', () => ({
	useLingui: () => ({
		i18n: {_: (message: string | {message: string}) => (typeof message === 'string' ? message : message.message)},
		t: (parts: TemplateStringsArray, ...values: Array<string>) =>
			parts.reduce((text, part, i) => text + part + (values[i] ?? ''), ''),
	}),
}));
vi.mock('@app/features/channel/components/channel_view/ChannelViewScaffold', () => ({
	ChannelViewScaffold: ({header, chatArea}: {header: ReactNode; chatArea: ReactNode}) => (
		<>
			{header}
			{chatArea}
		</>
	),
}));
vi.mock('@app/features/ui/components/Scroller', () => ({
	Scroller: ({children}: {children: ReactNode}) => <div>{children}</div>,
}));
vi.mock('@app/features/ui/button/Button', () => ({
	Button: ({children, onClick}: {children: ReactNode; onClick: () => void}) => (
		<button type="button" onClick={onClick}>
			{children}
		</button>
	),
}));
vi.mock('@app/features/app/components/dialogs/Modal', () => ({
	Root: ({children, disableHistoryManagement}: {children: ReactNode; disableHistoryManagement: boolean}) => (
		<div role="dialog" data-history-disabled={String(disableHistoryManagement)}>
			{children}
		</div>
	),
	ScreenReaderLabel: () => null,
}));
vi.mock('@app/features/app/components/dialogs/components/SettingsModalHeader', () => ({
	SettingsModalHeader: ({title, onClose}: {title: string; onClose: () => void}) => (
		<header>
			<h1>{title}</h1>
			<button type="button" aria-label="Close" onClick={onClose} />
		</header>
	),
}));
vi.mock('@app/features/app/components/dialogs/shared/SettingsModalLayout', async () => {
	const {forwardRef} = await import('react');
	const Wrapper = ({children}: {children: ReactNode}) => <div>{children}</div>;
	return {
		SettingsModalContainer: Wrapper,
		SettingsModalDesktopSidebar: Wrapper,
		SettingsModalDesktopContent: forwardRef<
			HTMLDivElement,
			{children: ReactNode; tabpanelId?: string; labelledBy?: string}
		>(({children, tabpanelId, labelledBy}, ref) => (
			<div ref={ref} id={tabpanelId} role="region" aria-labelledby={labelledBy} tabIndex={-1}>
				{children}
			</div>
		)),
		SettingsModalDesktopScroll: Wrapper,
		SettingsModalSidebarCategory: Wrapper,
		SettingsModalSidebarFooter: Wrapper,
		SettingsModalSidebarCategoryTitle: Wrapper,
		SettingsModalSidebarNav: ({children, header}: {children: ReactNode; header: ReactNode}) => (
			<nav>
				{header}
				{children}
			</nav>
		),
		SettingsModalSidebarItem: ({
			id,
			label,
			onClick,
			selected,
		}: {
			id: string;
			label: string;
			onClick: () => void;
			selected: boolean;
		}) => (
			<button type="button" id={id} onClick={onClick} aria-pressed={selected}>
				{label}
			</button>
		),
		settingsModalStyles: {},
	};
});
vi.mock('@app/features/app/components/dialogs/shared/SettingsTabLayout', () => ({
	SettingsTabContainer: ({children}: {children: ReactNode}) => <div>{children}</div>,
}));
vi.mock('@app/features/app/components/dialogs/shared/SettingsSection', () => ({
	SettingsSection: ({children, title}: {children: ReactNode; title: string}) => (
		<section>
			<h3>{title}</h3>
			{children}
		</section>
	),
}));
vi.mock('@app/features/ui/components/form/FormInput', () => ({
	Input: ({label, value, disabled}: {label: string; value: string; disabled: boolean}) => (
		<input aria-label={label} value={value} disabled={disabled} readOnly />
	),
	Textarea: ({label, value, disabled}: {label: string; value: string; disabled: boolean}) => (
		<textarea aria-label={label} value={value} disabled={disabled} readOnly />
	),
}));
vi.mock('@app/features/ui/components/form/FormSwitch', () => ({
	Switch: ({label, disabled}: {label: string; disabled: boolean}) => (
		<button type="button" role="switch" aria-checked="false" disabled={disabled}>
			{label}
		</button>
	),
}));
vi.mock('@app/features/ui/components/form/FormCombobox', () => ({
	Combobox: ({
		id,
		value,
		options,
		disabled,
	}: {
		id: string;
		value: string;
		options: Array<{value: string; label: string}>;
		disabled: boolean;
	}) => (
		<input
			id={id}
			role="combobox"
			aria-expanded="false"
			value={options.find((option) => option.value === value)?.label ?? ''}
			disabled={disabled}
			readOnly
		/>
	),
}));
vi.mock('@app/features/app/components/dialogs/shared/MobileSettingsComponents', async () => {
	const {useLayoutEffect} = await import('react');
	const Header = ({title, onBack}: {title: string; onBack: () => void}) => (
		<header>
			<button type="button" aria-label="Go back" onClick={onBack} />
			<h1>{title}</h1>
		</header>
	);
	return {
		MobileHeader: Header,
		MobileHeaderWithBanner: Header,
		MobileSettingsList: ({
			groupedTabs,
			onTabSelect,
			footer,
			scrollRef,
			onScroll,
		}: {
			groupedTabs: Record<string, Array<{type: string; label: string}>>;
			onTabSelect: (id: string) => void;
			footer: ReactNode;
			scrollRef: (handle: {scrollTo: typeof state.restoreScroll} | null) => void;
			onScroll: (event: React.UIEvent<HTMLDivElement>) => void;
		}) => {
			useLayoutEffect(() => {
				scrollRef({scrollTo: state.restoreScroll});
				return () => scrollRef(null);
			}, [scrollRef]);
			return (
				<nav onScroll={onScroll}>
					{Object.values(groupedTabs)
						.flat()
						.map((tab) => (
							<button type="button" key={tab.type} data-module={tab.type} onClick={() => onTabSelect(tab.type)}>
								{tab.label}
							</button>
						))}
					{footer}
				</nav>
			);
		},
	};
});

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
	Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
	state.selfHosted = true;
	state.mobile = false;
	state.location = new URL('http://localhost/channels/guild/application-settings');
	state.routerLocation = observable({current: state.location});
	state.canView = true;
	state.restoreScroll.mockClear();
	state.selected = 'channel';
	state.channel = {id: 'channel', guildId: 'guild'};
	state.navigate.mockClear();
	state.guild = observable<TestGuild>({
		id: 'guild',
		name: 'Fluxcol',
		ownerId: 'owner',
		isOwner(userId: string) {
			return this.ownerId === userId;
		},
	});
	container = document.createElement('div');
	document.body.append(container);
	root = createRoot(container);
});
afterEach(async () => {
	await act(async () => root.unmount());
	container.remove();
});
async function renderPage() {
	await act(async () => {
		runInAction(() => {
			state.routerLocation!.current = state.location;
		});
		root.render(<ApplicationSettingsPage guildId="guild" />);
	});
}
async function clickButton(text: string) {
	const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === text);
	expect(button).toBeDefined();
	await act(async () => button!.click());
}

describe('application settings access and panel', () => {
	it('renders the complete unavailable module catalog and native settings navigation', async () => {
		await renderPage();
		expect(container.querySelectorAll('[data-flx^="application-settings.module-row."]')).toHaveLength(31);
		expect(container.querySelectorAll('[data-flx="application-settings.module-status"]')).toHaveLength(31);
		expect(container.querySelectorAll('nav button')).toHaveLength(31);
		expect(container.textContent).not.toContain('AI assistant');
		expect(container.textContent).not.toContain('Back to community');
		expect(container.querySelector('[role="dialog"]')?.getAttribute('data-history-disabled')).toBe('true');
		expect(container.textContent).toContain('Built-in community features for Fluxcol.');
		expect(container.querySelector('input, select, textarea, [role="switch"]')).toBeNull();
	});
	it('links module selection to the URL and renders its disabled configuration preview', async () => {
		await renderPage();
		await clickButton('Tickets');
		expect(state.navigate).toHaveBeenCalledWith('/channels/guild/application-settings?module=tickets');
		state.location = new URL('http://localhost/channels/guild/application-settings?module=tickets');
		await renderPage();
		expect(container.querySelector('[data-flx="application-settings.module.tickets"]')).not.toBeNull();
		expect(container.querySelectorAll('input, textarea')).toHaveLength(3);
		expect(
			Array.from(container.querySelectorAll<HTMLInputElement>('input, textarea, [role="switch"]')).every(
				(control) => control.disabled,
			),
		).toBe(true);
		expect(container.querySelector('form')).toBeNull();
	});
	it('keeps keyboard focus in the content when an overview module row is replaced by its preview', async () => {
		await renderPage();
		const row = container.querySelector<HTMLButtonElement>('[data-flx="application-settings.module-row.tickets"]')!;
		row.focus();
		await act(async () => row.click());
		expect(state.navigate).toHaveBeenLastCalledWith('/channels/guild/application-settings?module=tickets');
		const panel = container.querySelector('#application-settings-panel');
		expect(document.activeElement).toBe(panel);
		state.location = new URL('http://localhost/channels/guild/application-settings?module=tickets');
		await renderPage();
		expect(container.querySelector('[data-flx="application-settings.module-row.tickets"]')).toBeNull();
		expect(container.querySelector('[data-flx="application-settings.module.tickets"]')).not.toBeNull();
		expect(document.activeElement).toBe(panel);
		expect(panel?.getAttribute('aria-labelledby')).toBe('application-settings-tab-tickets');
	});
	it.each([
		['welcome', ['Message channel']],
		['tickets', ['Channel category', 'Support roles']],
	] as const)('uses disabled native selection controls for %s without saving settings', async (module, labels) => {
		state.location = new URL(`http://localhost/channels/guild/application-settings?module=${module}`);
		await renderPage();
		for (const labelText of labels) {
			const label = Array.from(container.querySelectorAll('label')).find((item) => item.textContent === labelText)!;
			const control = container.querySelector<HTMLInputElement>(`[id="${label.htmlFor}"]`)!;
			expect(control.getAttribute('role')).toBe('combobox');
			expect(control.disabled).toBe(true);
		}
		expect(state.navigate).not.toHaveBeenCalled();
		expect(container.querySelector('form')).toBeNull();
	});
	it('opens automatic roles as a working module instead of a preview', async () => {
		state.location = new URL('http://localhost/channels/guild/application-settings?module=autorole');
		await renderPage();
		expect(container.textContent).toContain('Automatic role settings');
		expect(container.querySelector('[data-flx="application-settings.preview-fields"]')).toBeNull();
	});
	it.each(['unknown', 'ai-assistant'])('falls back to overview for unavailable module %s', async (module) => {
		state.location = new URL(`http://localhost/channels/guild/application-settings?module=${module}`);
		await renderPage();
		expect(container.querySelectorAll('[data-flx^="application-settings.module-row."]')).toHaveLength(31);
	});
	it('shows all mobile modules and supports returning from a direct module link to the menu', async () => {
		state.mobile = true;
		await renderPage();
		expect(container.querySelectorAll('nav [data-module]')).toHaveLength(31);
		expect(document.activeElement).toBe(container.querySelector('[data-flx="application-settings.mobile"]'));
		expect(container.textContent).not.toContain('AI assistant');
		expect(container.textContent).not.toContain('Back to community');
		await clickButton('Action history');
		expect(state.navigate).toHaveBeenLastCalledWith('/channels/guild/application-settings?module=audit');
		await clickButton('YouTube');
		expect(state.navigate).toHaveBeenCalledWith('/channels/guild/application-settings?module=youtube');
		state.location = new URL('http://localhost/channels/guild/application-settings?module=youtube');
		await renderPage();
		expect(container.querySelector('[data-flx="application-settings.module.youtube"]')).not.toBeNull();
		await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Go back"]')!.click());
		expect(state.navigate).toHaveBeenLastCalledWith('/channels/guild/application-settings');
	});
	it('restores the mobile module list scroll position after opening a module and returning', async () => {
		state.mobile = true;
		await renderPage();
		const list = container.querySelector<HTMLElement>('nav')!;
		await act(async () => {
			list.scrollTop = 420;
			list.dispatchEvent(new Event('scroll'));
		});
		state.location = new URL('http://localhost/channels/guild/application-settings?module=welcome');
		await renderPage();
		state.restoreScroll.mockClear();
		state.location = new URL('http://localhost/channels/guild/application-settings');
		await renderPage();
		expect(state.restoreScroll).toHaveBeenLastCalledWith({to: 420, animate: false});
		expect(document.activeElement).toBe(container.querySelector('[data-flx="application-settings.mobile"]'));
	});
	it('denies a non-owner opening the page directly', async () => {
		runInAction(() => {
			state.guild!.ownerId = 'another-owner';
		});
		await renderPage();
		expect(container.querySelector('[data-flx^="application-settings.module-row."]')).toBeNull();
		expect(container.querySelector('[role="dialog"]')).toBeNull();
		expect(container.querySelector('[role="status"]')?.textContent).toContain('only available');
	});
	it('denies the owner on a hosted instance', async () => {
		state.selfHosted = false;
		await renderPage();
		expect(container.querySelector('[data-flx^="application-settings.module-row."]')).toBeNull();
	});
	it('removes the panel immediately when ownership changes', async () => {
		await renderPage();
		await act(async () => {
			runInAction(() => {
				state.guild!.ownerId = 'new-owner';
			});
		});
		expect(container.querySelector('[data-flx^="application-settings.module-row."]')).toBeNull();
		expect(container.querySelector('[role="status"]')).not.toBeNull();
	});
	it('opens history through the footer button and closes through the native close button', async () => {
		await renderPage();
		await clickButton('Action history');
		expect(state.navigate).toHaveBeenCalledWith('/channels/guild/application-settings?module=audit');
		await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Close"]')!.click());
		expect(state.navigate).toHaveBeenCalledWith('/channels/guild/channel');
	});
});

describe('return destination', () => {
	it.each(['missing-selection', 'deleted-channel', 'other-community', 'lost-permission'])(
		'falls back safely for %s',
		(scenario) => {
			if (scenario === 'missing-selection') state.selected = null;
			if (scenario === 'deleted-channel') state.channel = undefined;
			if (scenario === 'other-community') state.channel = {id: 'channel', guildId: 'other'};
			if (scenario === 'lost-permission') state.canView = false;
			expect(getApplicationSettingsReturnPath('guild')).toBe('/channels/guild');
		},
	);
});
