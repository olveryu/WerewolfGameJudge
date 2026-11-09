/**
 * Product announcement modal composed with game-owned announcement tabs. The changelog tab leads
 * the tab bar and is the default page — opening the modal (including the post-update What's New
 * flow) lands on the update log; game-owned tabs and feedback follow it.
 */
import '@/components/CenterDialog.css';
import './AnnouncementModal.css';

import { Dialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import { Tabs } from '@ark-ui/react/tabs';
import { Suspense, useState } from 'react';

import { Spinner } from '@/components/Spinner';
import { ANNOUNCEMENT_VERSIONS, ANNOUNCEMENTS } from '@/config/announcements';
import { useAuthContext } from '@/contexts/AuthContext';
import { FeedbackTab } from '@/features/feedback/components/FeedbackTab';
import { useUnreadFeedback } from '@/features/feedback/queries/useUnreadFeedback';
import type { ClientGameAnnouncementTab } from '@/games/catalog';
import IconClose from '~icons/ion/close';
import IconMegaphoneOutline from '~icons/ion/megaphone-outline';

const CHANGELOG_TAB = 'changelog';
const FEEDBACK_TAB = 'feedback';

interface AnnouncementModalProps {
  readonly open: boolean;
  readonly gameTabs: readonly ClientGameAnnouncementTab[];
  readonly onClose: () => void;
}

function ChangelogList() {
  return (
    <div className="announcement-scroll">
      {ANNOUNCEMENT_VERSIONS.map((version) => {
        const announcement = ANNOUNCEMENTS[version];
        if (announcement === undefined) {
          throw new Error(`[FAIL-FAST] Missing announcement content for ${version}`);
        }
        return (
          <section key={version} className="announcement-section">
            <h3 className="announcement-section-title">{announcement.title}</h3>
            <ul className="announcement-items">
              {announcement.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** "公告与反馈" modal: changelog, game-owned tabs, then feedback. */
export function AnnouncementModal({ open, gameTabs, onClose }: AnnouncementModalProps) {
  const { user } = useAuthContext();
  const { data: unreadFeedbackCount, setUnreadFeedbackCount } = useUnreadFeedback();
  const hasUnreadFeedback = unreadFeedbackCount !== undefined && unreadFeedbackCount > 0;
  const [activeTab, setActiveTab] = useState(CHANGELOG_TAB);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(details) => {
        if (!details.open) onClose();
      }}
      lazyMount
      unmountOnExit
    >
      <Portal>
        <Dialog.Backdrop className="center-dialog-backdrop" />
        <Dialog.Positioner className="center-dialog-positioner">
          <Dialog.Content className="center-dialog announcement-modal">
            <header className="announcement-header">
              <IconMegaphoneOutline className="announcement-header-icon" aria-hidden />
              <Dialog.Title className="announcement-title">公告与反馈</Dialog.Title>
              <Dialog.CloseTrigger className="announcement-close" aria-label="关闭公告">
                <IconClose aria-hidden />
              </Dialog.CloseTrigger>
            </header>

            <Tabs.Root
              value={activeTab}
              onValueChange={(details) => setActiveTab(details.value)}
              lazyMount
              unmountOnExit
            >
              <Tabs.List className="announcement-tabs" aria-label="公告与反馈">
                <Tabs.Trigger value={CHANGELOG_TAB} className="announcement-tab">
                  更新日志
                </Tabs.Trigger>
                {gameTabs.map((tab) => (
                  <Tabs.Trigger key={tab.key} value={tab.key} className="announcement-tab">
                    {tab.label}
                  </Tabs.Trigger>
                ))}
                <Tabs.Trigger value={FEEDBACK_TAB} className="announcement-tab">
                  意见反馈
                  {hasUnreadFeedback && (
                    <span className="announcement-tab-dot" aria-label="有新回复" role="img" />
                  )}
                </Tabs.Trigger>
              </Tabs.List>

              <Tabs.Content value={CHANGELOG_TAB}>
                <ChangelogList />
              </Tabs.Content>
              {gameTabs.map((tab) => (
                <Tabs.Content key={tab.key} value={tab.key}>
                  <div className="announcement-scroll">
                    <Suspense fallback={<Spinner label={`加载${tab.label}`} />}>
                      <tab.Content />
                    </Suspense>
                  </div>
                </Tabs.Content>
              ))}
              <Tabs.Content value={FEEDBACK_TAB}>
                <div className="announcement-scroll">
                  <FeedbackTab
                    key={user?.id ?? 'signed-out'}
                    isLoggedIn={user !== null}
                    onUnreadChange={setUnreadFeedbackCount}
                  />
                </div>
              </Tabs.Content>
            </Tabs.Root>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
