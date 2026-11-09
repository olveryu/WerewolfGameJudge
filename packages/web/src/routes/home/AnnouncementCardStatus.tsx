import { useUnreadFeedback } from '@/features/feedback/queries/useUnreadFeedback';

import { AnnouncementCardText } from './AnnouncementCardText';

/** The announcement card with its unread-reply status; lazy so the probe stays out of the Home chunk. */
export function AnnouncementCardStatus() {
  const { data: unreadCount, isError } = useUnreadFeedback();
  if (unreadCount !== undefined && unreadCount > 0) {
    return <AnnouncementCardText subtitle={`${unreadCount} 条新回复`} hasUnread />;
  }
  return isError ? <AnnouncementCardText subtitle="回复状态读取失败" /> : <AnnouncementCardText />;
}
