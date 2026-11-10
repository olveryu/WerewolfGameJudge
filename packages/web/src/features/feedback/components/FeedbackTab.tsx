/**
 * FeedbackTab — two-way feedback conversation UI.
 *
 * Three sub-views: history list → conversation detail → submit new feedback. Admin replies are
 * left-aligned, user messages right-aligned, chat-bubble style.
 */
import './FeedbackTab.css';

import { useLayoutEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Spinner } from '@/components/Spinner';
import { APP_VERSION } from '@/config/version';
import { useFeedbackHistory } from '@/features/feedback/queries/useFeedbackHistory';
import {
  type FeedbackItem,
  markFeedbackRead,
  replyToFeedback,
  resolveFeedback,
  submitFeedback,
  syncFeedbackDelivery,
} from '@/features/feedback/services/feedbackApi';
import { TESTIDS } from '@/testids';
import { handleError } from '@/utils/errorPipeline';
import { homeLog } from '@/utils/logger';
import IconAddCircleOutline from '~icons/ion/add-circle-outline';
import IconArrowBack from '~icons/ion/arrow-back';
import IconChatbubbleEllipsesOutline from '~icons/ion/chatbubble-ellipses-outline';
import IconCheckmarkCircle from '~icons/ion/checkmark-circle';
import IconEllipsisHorizontalCircle from '~icons/ion/ellipsis-horizontal-circle';
import IconLockClosedOutline from '~icons/ion/lock-closed-outline';
import IconSend from '~icons/ion/send';
import IconShieldCheckmark from '~icons/ion/shield-checkmark';
import IconSyncOutline from '~icons/ion/sync-outline';

type FeedbackView = 'list' | 'compose' | 'detail';
type FeedbackFilter = 'open' | 'all';
type SyncStatus = FeedbackItem['syncStatus'];

const MAX_FEEDBACK_LENGTH = 500;

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHour = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 30) return `${diffDay} 天前`;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function countUnreadAdminReplies(item: FeedbackItem): number {
  return item.replies.filter((reply) => reply.isAdmin === 1 && reply.isRead === 0).length;
}

function BackButton({ onBack, testId }: { onBack: () => void; testId?: string }) {
  return (
    <button type="button" className="feedback-link" onClick={onBack} data-testid={testId}>
      <IconArrowBack aria-hidden />
      返回列表
    </button>
  );
}

interface SyncStatusRowProps {
  readonly syncStatus: SyncStatus;
  readonly isSubmitting: boolean;
  readonly onSync: () => void;
}

function SyncStatusRow({ syncStatus, isSubmitting, onSync }: SyncStatusRowProps) {
  if (syncStatus === 'synced') return null;
  return (
    <div className="feedback-sync-row">
      <span className="feedback-time">
        {syncStatus === 'pending'
          ? '已保存，尚未同步'
          : syncStatus === 'needs_review'
            ? '待人工核对，请勿重复提交'
            : '远端结果待核对'}
      </span>
      <button
        type="button"
        className="feedback-link"
        aria-label="核对反馈同步状态"
        disabled={isSubmitting}
        onClick={onSync}
      >
        <IconSyncOutline aria-hidden />
        核对状态
      </button>
    </div>
  );
}

interface FeedbackComposeProps {
  readonly text: string;
  readonly isSubmitting: boolean;
  readonly onTextChange: (text: string) => void;
  readonly onSubmit: () => void;
  readonly onBack: () => void;
}

function FeedbackCompose({
  text,
  isSubmitting,
  onTextChange,
  onSubmit,
  onBack,
}: FeedbackComposeProps) {
  const isSubmitDisabled = text.trim().length === 0 || isSubmitting;
  return (
    <div className="feedback-area">
      <BackButton onBack={onBack} />
      <textarea
        className="feedback-input"
        aria-label="反馈内容"
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        placeholder="说说你的建议或遇到的问题…"
        maxLength={MAX_FEEDBACK_LENGTH}
        disabled={isSubmitting}
        data-testid={TESTIDS.feedbackInput}
      />
      <span className="feedback-char-count">
        {text.length}/{MAX_FEEDBACK_LENGTH}
      </span>
      <button
        type="button"
        className="feedback-submit"
        onClick={onSubmit}
        disabled={isSubmitDisabled}
        aria-busy={isSubmitting}
        data-testid={TESTIDS.feedbackSubmitButton}
      >
        {isSubmitting ? <Spinner label="提交中" /> : '提交反馈'}
      </button>
    </div>
  );
}

interface FeedbackDetailProps {
  readonly feedback: FeedbackItem;
  readonly replyText: string;
  readonly isSubmitting: boolean;
  readonly onReplyTextChange: (text: string) => void;
  readonly onSendReply: () => void;
  readonly onResolve: (action: 'resolve' | 'reopen') => void;
  readonly onSync: (id: string) => void;
  readonly onBack: () => void;
}

function FeedbackDetail({
  feedback,
  replyText,
  isSubmitting,
  onReplyTextChange,
  onSendReply,
  onResolve,
  onSync,
  onBack,
}: FeedbackDetailProps) {
  const isResolved = feedback.status === 'resolved';
  const isSynced = feedback.syncStatus === 'synced';
  const lastReply = feedback.replies.at(-1);
  const isSendDisabled = replyText.trim().length === 0 || isSubmitting || !isSynced;
  const chatRef = useRef<HTMLDivElement>(null);
  const messageCount = feedback.replies.length;

  // Keep the newest message in view: on open and whenever a reply lands.
  useLayoutEffect(() => {
    const chat = chatRef.current;
    if (chat !== null) chat.scrollTop = chat.scrollHeight;
  }, [messageCount]);

  return (
    <div className="feedback-area">
      <BackButton onBack={onBack} testId={TESTIDS.feedbackBackButton} />
      <button
        type="button"
        className="feedback-status-chip"
        data-resolved={isResolved}
        onClick={() => onResolve(isResolved ? 'reopen' : 'resolve')}
        disabled={!isSynced || isSubmitting}
        data-testid={TESTIDS.feedbackResolveButton}
      >
        {isResolved ? (
          <IconCheckmarkCircle aria-hidden />
        ) : (
          <IconEllipsisHorizontalCircle aria-hidden />
        )}
        {!isSynced
          ? '反馈已保存，远端待确认'
          : isResolved
            ? '已解决 · 点击重新打开'
            : '进行中 · 点击标记解决'}
      </button>

      <div ref={chatRef} className="feedback-chat">
        <div className="feedback-bubble-row" data-side="user">
          <p className="feedback-bubble" data-side="user">
            {feedback.content}
          </p>
          <span className="feedback-time">{formatTime(feedback.createdAt)}</span>
          <SyncStatusRow
            syncStatus={feedback.syncStatus}
            isSubmitting={isSubmitting}
            onSync={() => onSync(feedback.id)}
          />
        </div>

        {feedback.replies.map((reply) =>
          reply.isAdmin === 1 ? (
            <div key={reply.id} className="feedback-bubble-row" data-side="admin">
              <span className="feedback-admin-label">
                <IconShieldCheckmark aria-hidden />
                开发者
              </span>
              <p className="feedback-bubble" data-side="admin">
                {reply.body}
              </p>
              <span className="feedback-time">{formatTime(reply.createdAt)}</span>
            </div>
          ) : (
            <div key={reply.id} className="feedback-bubble-row" data-side="user">
              <p className="feedback-bubble" data-side="user">
                {reply.body}
              </p>
              <span className="feedback-time">{formatTime(reply.createdAt)}</span>
              <SyncStatusRow
                syncStatus={reply.syncStatus}
                isSubmitting={isSubmitting}
                onSync={() => onSync(reply.id)}
              />
            </div>
          ),
        )}

        {feedback.status === 'open' && lastReply?.isAdmin === 1 && (
          <button
            type="button"
            className="feedback-resolve-prompt"
            onClick={() => onResolve('resolve')}
          >
            <span>问题解决了？</span>
            <span className="feedback-resolve-prompt-answer">
              <IconCheckmarkCircle aria-hidden />
              是的
            </span>
          </button>
        )}
      </div>

      <div className="feedback-reply-bar">
        <input
          className="feedback-reply-input"
          aria-label="追问内容"
          value={replyText}
          onChange={(event) => onReplyTextChange(event.target.value)}
          placeholder="追问…"
          maxLength={MAX_FEEDBACK_LENGTH}
          disabled={isSubmitting || !isSynced}
          data-testid={TESTIDS.feedbackReplyInput}
        />
        <button
          type="button"
          className="feedback-reply-send"
          aria-label="发送追问"
          onClick={onSendReply}
          disabled={isSendDisabled}
          aria-busy={isSubmitting}
          data-testid={TESTIDS.feedbackReplySendButton}
        >
          {isSubmitting ? <Spinner label="发送中" /> : <IconSend aria-hidden />}
        </button>
      </div>
    </div>
  );
}

interface FeedbackListProps {
  readonly items: readonly FeedbackItem[];
  readonly filter: FeedbackFilter;
  readonly onFilterChange: (filter: FeedbackFilter) => void;
  readonly onOpenDetail: (feedbackId: string) => void;
  readonly onCompose: () => void;
}

function FeedbackList({
  items,
  filter,
  onFilterChange,
  onOpenDetail,
  onCompose,
}: FeedbackListProps) {
  const filteredItems = filter === 'all' ? items : items.filter((item) => item.status === 'open');

  return (
    <div className="feedback-area" data-testid={TESTIDS.feedbackHistoryList}>
      <div
        className="feedback-filter-row"
        role="group"
        aria-label="反馈筛选"
        data-testid={TESTIDS.feedbackFilterToggle}
      >
        {(
          [
            ['open', '进行中'],
            ['all', '全部'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className="feedback-filter-pill"
            aria-pressed={filter === value}
            onClick={() => onFilterChange(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {filteredItems.length === 0 ? (
        <div className="feedback-center">
          <IconChatbubbleEllipsesOutline className="feedback-center-icon" aria-hidden />
          <p className="feedback-muted">
            {filter === 'open' ? '没有进行中的反馈' : '还没有反馈记录'}
          </p>
        </div>
      ) : (
        <ul className="feedback-history">
          {filteredItems.map((item) => {
            const unreadCount = countUnreadAdminReplies(item);
            const lastReply = item.replies.at(-1);
            const hasAdminReply = item.replies.some((reply) => reply.isAdmin === 1);
            const isPendingSync =
              item.syncStatus !== 'synced' ||
              item.replies.some((reply) => reply.syncStatus !== 'synced');
            const status =
              item.status === 'resolved' ? 'resolved' : hasAdminReply ? 'replied' : 'pending';

            return (
              <li key={item.id}>
                <button
                  type="button"
                  className="feedback-history-item"
                  onClick={() => onOpenDetail(item.id)}
                  data-testid={TESTIDS.feedbackHistoryItem(item.id)}
                >
                  <span className="feedback-history-header">
                    <span className="feedback-history-content">{item.content}</span>
                    {isPendingSync && <span className="feedback-time">待同步</span>}
                    {unreadCount > 0 && (
                      <span
                        className="feedback-unread-badge"
                        aria-label={`${unreadCount} 条未读回复`}
                      >
                        {unreadCount}
                      </span>
                    )}
                  </span>
                  <span className="feedback-history-footer">
                    <span className="feedback-time">{formatTime(item.createdAt)}</span>
                    <span className="feedback-history-status" data-status={status}>
                      {status === 'resolved'
                        ? '✅ 已解决'
                        : status === 'replied'
                          ? '已回复'
                          : '待回复'}
                    </span>
                  </span>
                  {lastReply && (
                    <span className="feedback-history-preview">
                      {lastReply.isAdmin === 1 ? '开发者：' : '我：'}
                      {lastReply.body}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        className="feedback-new-button"
        onClick={onCompose}
        data-testid={TESTIDS.feedbackNewButton}
      >
        <IconAddCircleOutline aria-hidden />
        提交新反馈
      </button>
    </div>
  );
}

interface FeedbackTabProps {
  /** The signed-in user, or null when signed out. */
  readonly userId: string | null;
  /** Notifies the parent that the unread admin reply count changed. */
  readonly onUnreadChange: (count: number) => void;
}

/** Feedback tab of the Home announcement modal; mount it keyed by the signed-in user. */
export function FeedbackTab({ userId, onUnreadChange }: FeedbackTabProps) {
  const [view, setView] = useState<FeedbackView>('list');
  const { query: historyQuery, reloadHistory, updateHistory } = useFeedbackHistory(userId);
  const feedbackItems = historyQuery.data ?? [];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FeedbackFilter>('open');
  const submitIntent = useRef<{ id: string; content: string } | null>(null);
  const replyIntent = useRef<{ id: string; content: string; feedbackId: string } | null>(null);

  const selectedFeedback =
    selectedFeedbackId === null
      ? undefined
      : feedbackItems.find((item) => item.id === selectedFeedbackId);

  const submit = async () => {
    const trimmed = feedbackText.trim();
    if (trimmed.length === 0) return;
    setIsSubmitting(true);
    try {
      if (submitIntent.current === null || submitIntent.current.content !== trimmed) {
        submitIntent.current = { id: crypto.randomUUID(), content: trimmed };
      }
      const result = await submitFeedback(trimmed, APP_VERSION, submitIntent.current.id);
      if (result.syncStatus === 'synced') toast.success('感谢反馈！');
      else toast.info('反馈已保存，远端结果待核对');
      setFeedbackText('');
      submitIntent.current = null;
      await reloadHistory();
      setView('list');
    } catch (error: unknown) {
      handleError(error, { label: '提交反馈', logger: homeLog, feedback: 'toast' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDetail = async (feedbackId: string) => {
    setSelectedFeedbackId(feedbackId);
    setView('detail');
    setReplyText('');
    const item = feedbackItems.find((candidate) => candidate.id === feedbackId);
    if (item === undefined || countUnreadAdminReplies(item) === 0) return;
    try {
      await markFeedbackRead(feedbackId);
      updateHistory((previous) =>
        previous.map((candidate) =>
          candidate.id === feedbackId
            ? {
                ...candidate,
                replies: candidate.replies.map((reply) =>
                  reply.isAdmin === 1 && reply.isRead === 0 ? { ...reply, isRead: 1 } : reply,
                ),
              }
            : candidate,
        ),
      );
      onUnreadChange(
        feedbackItems.reduce(
          (total, candidate) =>
            total + (candidate.id === feedbackId ? 0 : countUnreadAdminReplies(candidate)),
          0,
        ),
      );
    } catch (error: unknown) {
      handleError(error, { label: '标记已读', logger: homeLog });
    }
  };

  const sendReply = async () => {
    const trimmed = replyText.trim();
    if (trimmed.length === 0 || selectedFeedbackId === null) return;
    setIsSubmitting(true);
    try {
      if (
        replyIntent.current === null ||
        replyIntent.current.content !== trimmed ||
        replyIntent.current.feedbackId !== selectedFeedbackId
      ) {
        replyIntent.current = {
          id: crypto.randomUUID(),
          content: trimmed,
          feedbackId: selectedFeedbackId,
        };
      }
      const result = await replyToFeedback(selectedFeedbackId, trimmed, replyIntent.current.id);
      if (result.syncStatus !== 'synced') toast.info('追问已保存，远端结果待核对');
      setReplyText('');
      replyIntent.current = null;
      await reloadHistory();
    } catch (error: unknown) {
      handleError(error, { label: '发送追问', logger: homeLog, feedback: 'toast' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const syncDelivery = async (id: string) => {
    setIsSubmitting(true);
    try {
      const result = await syncFeedbackDelivery(id);
      await reloadHistory();
      if (result.syncStatus === 'synced') toast.success('反馈同步完成');
      else toast.info('结果仍未确认，请勿重复提交；需开发者人工核对');
    } catch (error: unknown) {
      handleError(error, { label: '核对反馈', logger: homeLog, feedback: 'toast' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const changeStatus = async (feedbackId: string, action: 'resolve' | 'reopen') => {
    try {
      await resolveFeedback(feedbackId, action);
      const status = action === 'resolve' ? 'resolved' : 'open';
      updateHistory((previous) =>
        previous.map((item) => (item.id === feedbackId ? { ...item, status } : item)),
      );
      toast.success(action === 'resolve' ? '已标记解决' : '已重新打开');
    } catch (error: unknown) {
      handleError(error, { label: '更新状态', logger: homeLog, feedback: 'toast' });
    }
  };

  if (userId === null) {
    return (
      <div className="feedback-area feedback-center">
        <IconLockClosedOutline className="feedback-center-icon" aria-hidden />
        <p className="feedback-muted">登录后可提交建议</p>
      </div>
    );
  }

  if (historyQuery.isError && historyQuery.data === undefined) {
    return (
      <div className="feedback-area feedback-center" role="alert">
        <p className="feedback-muted">反馈记录加载失败</p>
        <button
          type="button"
          className="feedback-link"
          disabled={historyQuery.isFetching}
          onClick={() => void historyQuery.refetch()}
        >
          <IconSyncOutline aria-hidden />
          重试
        </button>
      </div>
    );
  }

  if (historyQuery.isPending) {
    return (
      <div className="feedback-area feedback-center">
        <Spinner label="加载中" />
        <p className="feedback-muted">加载中…</p>
      </div>
    );
  }

  if (view === 'compose') {
    return (
      <FeedbackCompose
        text={feedbackText}
        isSubmitting={isSubmitting}
        onTextChange={setFeedbackText}
        onSubmit={() => void submit()}
        onBack={() => setView('list')}
      />
    );
  }

  if (view === 'detail' && selectedFeedback !== undefined) {
    return (
      <FeedbackDetail
        feedback={selectedFeedback}
        replyText={replyText}
        isSubmitting={isSubmitting}
        onReplyTextChange={setReplyText}
        onSendReply={() => void sendReply()}
        onResolve={(action) => void changeStatus(selectedFeedback.id, action)}
        onSync={(id) => void syncDelivery(id)}
        onBack={() => setView('list')}
      />
    );
  }

  return (
    <FeedbackList
      items={feedbackItems}
      filter={filter}
      onFilterChange={setFilter}
      onOpenDetail={(feedbackId) => void openDetail(feedbackId)}
      onCompose={() => setView('compose')}
    />
  );
}
