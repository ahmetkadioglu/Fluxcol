// SPDX-License-Identifier: AGPL-3.0-or-later

import {Routes} from '@app/app/Routes';
import {SettingsModalHeader} from '@app/features/app/components/dialogs/components/SettingsModalHeader';
import * as Modal from '@app/features/app/components/dialogs/Modal';
import {
	SettingsModalContainer,
	SettingsModalDesktopContent,
	SettingsModalDesktopScroll,
	SettingsModalDesktopSidebar,
	SettingsModalSidebarCategory,
	SettingsModalSidebarCategoryTitle,
	SettingsModalSidebarFooter,
	SettingsModalSidebarItem,
	SettingsModalSidebarNav,
} from '@app/features/app/components/dialogs/shared/SettingsModalLayout';
import {canAccessApplicationSettings} from '@app/features/application_settings/ApplicationSettingsAccess';
import {
	APPLICATION_SETTINGS_COPY as COPY,
	APPLICATION_SETTINGS_GROUPS as GROUPS,
	APPLICATION_SETTINGS_MODULES as MODULES,
} from '@app/features/application_settings/ApplicationSettingsCatalog';
import {ApplicationSettingsContent} from '@app/features/application_settings/ApplicationSettingsContent';
import {APPLICATION_SETTINGS_DESCRIPTOR} from '@app/features/application_settings/ApplicationSettingsMessages';
import {ApplicationSettingsMobileView} from '@app/features/application_settings/ApplicationSettingsMobileView';
import {getApplicationSettingsReturnPath} from '@app/features/application_settings/ApplicationSettingsNavigation';
import styles from '@app/features/application_settings/ApplicationSettingsPage.module.css';
import {eventLogTabId} from '@app/features/application_settings/EventLogSettings';
import {ChannelViewScaffold} from '@app/features/channel/components/channel_view/ChannelViewScaffold';
import guildSettingsStyles from '@app/features/guild/components/modals/GuildSettingsModal.module.css';
import Guilds from '@app/features/guild/state/Guilds';
import * as RouterUtils from '@app/features/navigation/utils/RouterUtils';
import {useLocation} from '@app/features/platform/components/router/RouterReact';
import {Button} from '@app/features/ui/button/Button';
import MobileLayout from '@app/features/ui/state/MobileLayout';
import {useUnsavedChangesFlash} from '@app/features/user/hooks/useUnsavedChangesFlash';
import {useFluxerDocumentTitle} from '@app/features/window/hooks/useFluxerDocumentTitle';
import {useLingui} from '@lingui/react/macro';
import {ArrowLeftIcon, GearIcon, GridFourIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import {useCallback, useEffect, useRef} from 'react';

const PANEL_ID = 'application-settings-panel';
const AUDIT_MODULE = MODULES.find((module) => module.id === 'audit')!;

export const ApplicationSettingsPage = observer(({guildId}: {guildId: string}) => {
	const {i18n, t} = useLingui();
	const location = useLocation();
	const guild = Guilds.getGuild(guildId);
	const canAccess = canAccessApplicationSettings(guild);
	const isMobile = MobileLayout.enabled;
	const requestedModule = location.searchParams.get('module');
	const module = MODULES.find((item) => item.id === requestedModule);
	const selectedId = module?.id ?? 'overview';
	const mobileRoot = isMobile && !module && requestedModule !== 'overview';
	const headingRef = useRef<HTMLHeadingElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const title = i18n._(APPLICATION_SETTINGS_DESCRIPTOR);
	const communityName = guild?.name ?? '';
	const selectedTitle = module ? i18n._(module.title) : i18n._(COPY.overview);
	const {showUnsavedBanner, flashBanner, tabData, checkUnsavedChanges} = useUnsavedChangesFlash(eventLogTabId(guildId));
	useFluxerDocumentTitle([title, communityName]);
	const close = useCallback(() => {
		if (!checkUnsavedChanges()) RouterUtils.transitionTo(getApplicationSettingsReturnPath(guildId));
	}, [guildId, checkUnsavedChanges]);
	const selectModule = useCallback(
		(id: string) => {
			if (!checkUnsavedChanges())
				RouterUtils.transitionTo(`${Routes.guildApplicationSettings(guildId)}?module=${encodeURIComponent(id)}`);
		},
		[guildId, checkUnsavedChanges],
	);
	const showModuleList = useCallback(() => {
		if (!checkUnsavedChanges()) RouterUtils.transitionTo(Routes.guildApplicationSettings(guildId));
	}, [guildId, checkUnsavedChanges]);
	const focusContent = useCallback(() => contentRef.current?.focus(), []);
	const openModuleFromContent = useCallback(
		(id: string) => {
			selectModule(id);
			focusContent();
		},
		[selectModule, focusContent],
	);
	useEffect(() => {
		if (!canAccess) headingRef.current?.focus();
		else if (isMobile) contentRef.current?.focus();
	}, [guildId, isMobile, canAccess, selectedId, mobileRoot]);

	const returnButton = (
		<Button
			variant="secondary"
			leftIcon={<ArrowLeftIcon size={16} aria-hidden="true" data-flx="application-settings.return-icon" />}
			onClick={close}
			data-flx="application-settings.return"
		>{t`Back to community`}</Button>
	);
	const historyButton = (
		<Button
			id="application-settings-tab-audit"
			variant="secondary"
			fitContainer
			leftIcon={<AUDIT_MODULE.icon size={16} weight="fill" aria-hidden="true" />}
			aria-pressed={selectedId === 'audit'}
			aria-controls={PANEL_ID}
			onClick={() => {
				selectModule('audit');
				focusContent();
			}}
			data-flx="application-settings.history"
		>
			{i18n._(AUDIT_MODULE.title)}
		</Button>
	);
	const content = (
		<ApplicationSettingsContent
			guildId={guildId}
			module={module}
			communityName={communityName}
			onModuleSelect={openModuleFromContent}
		/>
	);
	const mobileTabs = {
		overview: [{type: 'overview', label: i18n._(COPY.overview), icon: GearIcon}],
		...Object.fromEntries(
			GROUPS.map((group) => [
				group.id,
				MODULES.filter((item) => item.group === group.id && item.id !== 'audit').map((item) => ({
					type: item.id,
					label: i18n._(item.title),
					icon: item.icon,
				})),
			]),
		),
	};
	return (
		<>
			{!canAccess && (
				<ChannelViewScaffold
					data-flx="application-settings.page"
					header={
						<header className={styles.backgroundHeader} data-flx="application-settings.header">
							<GridFourIcon size={20} aria-hidden="true" data-flx="application-settings.header-icon" />
							<h1
								ref={headingRef}
								tabIndex={-1}
								className={styles.title}
								data-flx="application-settings.background-title"
							>
								{title}
							</h1>
						</header>
					}
					chatArea={
						<div className={styles.denied} data-flx="application-settings.access-denied">
							<p
								role="status"
								data-flx="application-settings.access-explanation"
							>{t`Application settings are only available to the community owner on a self-hosted instance.`}</p>
							{returnButton}
						</div>
					}
				/>
			)}
			{canAccess && (
				<Modal.Root size="fullscreen" initialFocusRef={contentRef} onClose={close} disableHistoryManagement>
					<Modal.ScreenReaderLabel text={`${title} — ${communityName}`} />
					<SettingsModalContainer fullscreen>
						{isMobile ? (
							<ApplicationSettingsMobileView
								title={title}
								selectedTitle={selectedTitle}
								selectedId={selectedId}
								isRoot={mobileRoot}
								contentRef={contentRef}
								groupedTabs={mobileTabs}
								categoryLabels={Object.fromEntries(GROUPS.map((group) => [group.id, i18n._(group.title)]))}
								onBack={mobileRoot ? close : showModuleList}
								onModuleSelect={selectModule}
								footer={historyButton}
								showUnsavedBanner={showUnsavedBanner}
								flashBanner={flashBanner}
								tabData={tabData}
							>
								{content}
							</ApplicationSettingsMobileView>
						) : (
							<>
								<SettingsModalDesktopSidebar>
									<div className={guildSettingsStyles.sidebarHeader} data-flx="application-settings.sidebar-heading">
										<div className={guildSettingsStyles.guildName} data-flx="application-settings.community-name">
											{communityName}
										</div>
									</div>
									<SettingsModalSidebarNav>
										<SettingsModalSidebarCategory>
											<SettingsModalSidebarItem
												id="application-settings-tab-overview"
												icon={GearIcon}
												label={i18n._(COPY.overview)}
												selected={selectedId === 'overview'}
												controlsId={PANEL_ID}
												onClick={() => selectModule('overview')}
												onRequestContentFocus={focusContent}
											/>
										</SettingsModalSidebarCategory>
										{GROUPS.map((group) => (
											<SettingsModalSidebarCategory key={group.id}>
												<SettingsModalSidebarCategoryTitle>{i18n._(group.title)}</SettingsModalSidebarCategoryTitle>
												{MODULES.filter((item) => item.group === group.id && item.id !== 'audit').map((item) => (
													<SettingsModalSidebarItem
														key={item.id}
														id={`application-settings-tab-${item.id}`}
														icon={item.icon}
														label={i18n._(item.title)}
														selected={selectedId === item.id}
														controlsId={PANEL_ID}
														onClick={() => selectModule(item.id)}
														onRequestContentFocus={focusContent}
													/>
												))}
											</SettingsModalSidebarCategory>
										))}
									</SettingsModalSidebarNav>
									<SettingsModalSidebarFooter>{historyButton}</SettingsModalSidebarFooter>
								</SettingsModalDesktopSidebar>
								<SettingsModalDesktopContent
									ref={contentRef}
									tabpanelId={PANEL_ID}
									labelledBy={`application-settings-tab-${selectedId}`}
								>
									<SettingsModalHeader
										title={selectedTitle}
										showUnsavedBanner={showUnsavedBanner}
										flashBanner={flashBanner}
										tabData={tabData}
										onClose={close}
									/>
									<SettingsModalDesktopScroll scrollKey={selectedId}>{content}</SettingsModalDesktopScroll>
								</SettingsModalDesktopContent>
							</>
						)}
					</SettingsModalContainer>
				</Modal.Root>
			)}
		</>
	);
});
