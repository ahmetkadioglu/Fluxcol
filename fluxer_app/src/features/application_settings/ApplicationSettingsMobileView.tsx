// SPDX-License-Identifier: AGPL-3.0-or-later

import Accessibility from '@app/features/accessibility/state/Accessibility';
import mobileGuildStyles from '@app/features/app/components/dialogs/components/MobileGuildSettingsView.module.css';
import {
	MobileHeader,
	MobileHeaderWithBanner,
	MobileSettingsList,
} from '@app/features/app/components/dialogs/shared/MobileSettingsComponents';
import {Scroller, type ScrollerHandle} from '@app/features/ui/components/Scroller';
import type {TabData} from '@app/features/ui/state/UnsavedChanges';
import userSettingsStyles from '@app/features/user/components/modals/UserSettingsModal.module.css';
import type {Icon} from '@phosphor-icons/react';
import {AnimatePresence, motion} from 'framer-motion';
import {observer} from 'mobx-react-lite';
import {type ReactNode, type RefObject, type UIEvent, useCallback, useRef} from 'react';

const FADE_VARIANTS = {enter: {opacity: 0}, center: {opacity: 1}, exit: {opacity: 0}};

interface ApplicationSettingsMobileViewProps {
	title: string;
	selectedTitle: string;
	selectedId: string;
	isRoot: boolean;
	contentRef: RefObject<HTMLDivElement | null>;
	groupedTabs: Record<string, Array<{type: string; label: string; icon: Icon}>>;
	categoryLabels: Record<string, string>;
	onBack: () => void;
	onModuleSelect: (id: string) => void;
	footer: ReactNode;
	children: ReactNode;
	showUnsavedBanner?: boolean;
	flashBanner?: boolean;
	tabData?: TabData;
}

export const ApplicationSettingsMobileView = observer(function ApplicationSettingsMobileView({
	title,
	selectedTitle,
	selectedId,
	isRoot,
	contentRef,
	groupedTabs,
	categoryLabels,
	onBack,
	onModuleSelect,
	footer,
	children,
	showUnsavedBanner,
	flashBanner,
	tabData,
}: ApplicationSettingsMobileViewProps) {
	const reducedMotion = Accessibility.useReducedMotion;
	const listScrollPositionRef = useRef(0);
	const restoreListScroll = useCallback((scroller: ScrollerHandle | null) => {
		if (scroller) scroller.scrollTo({to: listScrollPositionRef.current, animate: false});
	}, []);
	const handleListScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
		listScrollPositionRef.current = event.currentTarget.scrollTop;
	}, []);
	const retainContentFocus = useCallback(() => {
		const wrapper = contentRef.current;
		if (wrapper && !wrapper.contains(document.activeElement)) wrapper.focus({preventScroll: true});
	}, [contentRef]);
	const viewKey = isRoot ? 'list' : selectedId;
	return (
		<div
			ref={contentRef}
			role="region"
			aria-label={isRoot ? title : selectedTitle}
			tabIndex={-1}
			className={userSettingsStyles.mobileWrapper}
			data-flx="application-settings.mobile"
		>
			<div className={userSettingsStyles.mobileHeaderContainer}>
				<AnimatePresence mode="wait" initial={false}>
					<motion.div
						key={viewKey}
						variants={reducedMotion ? undefined : FADE_VARIANTS}
						initial={reducedMotion ? 'center' : 'enter'}
						animate="center"
						exit={reducedMotion ? 'center' : 'exit'}
						transition={{duration: reducedMotion ? 0 : 0.08, ease: 'easeInOut'}}
						className={userSettingsStyles.mobileHeaderContent}
					>
						{isRoot ? (
							<MobileHeader title={title} onBack={onBack} />
						) : (
							<MobileHeaderWithBanner
								title={selectedTitle}
								onBack={onBack}
								showUnsavedBanner={showUnsavedBanner}
								flashBanner={flashBanner}
								tabData={tabData}
							/>
						)}
					</motion.div>
				</AnimatePresence>
			</div>
			<div className={userSettingsStyles.mobileContentContainer}>
				<AnimatePresence mode="wait" initial={false}>
					<motion.div
						key={viewKey}
						variants={reducedMotion ? undefined : FADE_VARIANTS}
						initial={reducedMotion ? 'center' : 'enter'}
						animate="center"
						exit={reducedMotion ? 'center' : 'exit'}
						transition={{duration: reducedMotion ? 0 : 0.15, ease: 'easeInOut'}}
						onAnimationComplete={retainContentFocus}
						className={userSettingsStyles.mobileContentPane}
					>
						{isRoot ? (
							<MobileSettingsList
								groupedTabs={groupedTabs}
								categoryLabels={categoryLabels}
								hiddenCategories={['overview']}
								onTabSelect={onModuleSelect}
								footer={footer}
								scrollRef={restoreListScroll}
								onScroll={handleListScroll}
							/>
						) : (
							<Scroller className={mobileGuildStyles.scrollerFlex} data-flx="application-settings.mobile-scroller">
								<div className={mobileGuildStyles.contentContainer} data-flx="application-settings.mobile-content">
									{children}
								</div>
							</Scroller>
						)}
					</motion.div>
				</AnimatePresence>
			</div>
		</div>
	);
});
