interface AnnouncementCardTextProps {
  readonly subtitle?: string;
  readonly hasUnread?: boolean;
}

/** Text and unread dot of Home's "公告与反馈" card; the default subtitle doubles as the lazy fallback. */
export function AnnouncementCardText({
  subtitle = '查看更新 · 提交建议',
  hasUnread = false,
}: AnnouncementCardTextProps) {
  return (
    <>
      <span className="home-card-text">
        <span className="home-card-title">公告与反馈</span>
        <span className="home-card-subtitle">{subtitle}</span>
      </span>
      {hasUnread && <span className="home-feedback-dot" aria-hidden />}
    </>
  );
}
