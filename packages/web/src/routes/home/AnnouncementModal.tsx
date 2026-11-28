/**
 * Product announcement modal composed with game-owned announcement tabs. The changelog tab leads
 * the tab bar and is the default page — opening the modal (including the post-update What's New
 * flow) lands on the update log; game-owned tabs and feedback follow it.
 */
import '@/components/CenterDialog.css';
import './AnnouncementModal.css';

import { Portal } from '@ark-ui/react/portal';
import { Suspense, useState } from 'react';

import { AppDialog } from '@/components/AppDialog';
import { Spinner } from '@/components/Spinner';
import { TabList, TabPanel, Tabs } from '@/components/Tabs';
import { ANNOUNCEMENT_VERSIONS, ANNOUNCEMENTS } from '@/config/announcements';
import { useAuthContext } from '@/contexts/AuthContext';
import { FeedbackTab } from '@/features/feedback/components/FeedbackTab';
import { useUnreadFeedback } from '@/features/feedback/queries/useUnreadFeedback';
import type { ClientGameAnnouncementTab } from '@/games/catalog';
import { TESTIDS } from '@/testids';
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
    <AppDialog.Root
      open={open}
      onOpenChange={(details) => {
        if (!details.open) onClose();
      }}
      lazyMount
      unmountOnExit
    >
      <Portal>
        <AppDialog.Backdrop className="center-dialog-backdrop" />
        <AppDialog.Positioner className="center-dialog-positioner">
          <AppDialog.Content className="center-dialog announcement-modal">
            <header className="announcement-header">
              <IconMegaphoneOutline className="announcement-header-icon" aria-hidden />
              <AppDialog.Title className="announcement-title">公告与反馈</AppDialog.Title>
              <AppDialog.CloseTrigger
                className="announcement-close"
                aria-label="关闭公告"
                data-testid={TESTIDS.homeAnnouncementCloseButton}
              >
                <IconClose aria-hidden />
              </AppDialog.CloseTrigger>
            </header>

            <Tabs value={activeTab} onValueChange={setActiveTab} lazy>
              <div className="announcement-tabs">
                <TabList
                  label="公告与反馈"
                  variant="underline"
                  layout="scroll"
                  items={[
                    { value: CHANGELOG_TAB, label: '更新日志' },
                    ...gameTabs.map((tab) => ({ value: tab.key, label: tab.label })),
                    {
                      value: FEEDBACK_TAB,
                      label: '意见反馈',
                      trailing: hasUnreadFeedback ? (
                        <span className="announcement-tab-dot" aria-label="有新回复" role="img" />
                      ) : undefined,
                    },
                  ]}
                />
              </div>

              <TabPanel value={CHANGELOG_TAB}>
                <ChangelogList />
              </TabPanel>
              {gameTabs.map((tab) => (
                <TabPanel key={tab.key} value={tab.key}>
                  <div className="announcement-scroll">
                    <Suspense fallback={<Spinner label={`加载${tab.label}`} />}>
                      <tab.Content />
                    </Suspense>
                  </div>
                </TabPanel>
              ))}
              <TabPanel value={FEEDBACK_TAB}>
                <div className="announcement-scroll">
                  <FeedbackTab
                    key={user?.id ?? 'signed-out'}
                    userId={user?.id ?? null}
                    onUnreadChange={setUnreadFeedbackCount}
                  />
                </div>
              </TabPanel>
            </Tabs>
          </AppDialog.Content>
        </AppDialog.Positioner>
      </Portal>
    </AppDialog.Root>
  );
}
