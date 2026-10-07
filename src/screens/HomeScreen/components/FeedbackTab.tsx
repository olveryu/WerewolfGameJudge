/**
 * FeedbackTab — Two-way feedback conversation UI
 *
 * Three sub-views: history list → conversation detail → submit new feedback.
 * Admin replies are left-aligned, user messages right-aligned, chat-bubble style.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { toast } from 'sonner-native';

import { APP_VERSION } from '@/config/version';
import type { FeedbackItem } from '@/features/feedback/services/feedbackApi';
import {
  getFeedbackHistory,
  markFeedbackRead,
  replyToFeedback,
  resolveFeedback,
  submitFeedback,
  syncFeedbackDelivery,
} from '@/features/feedback/services/feedbackApi';
import { TESTIDS } from '@/testids';
import { borderRadius, colors, componentSizes, spacing, typography, withAlpha } from '@/theme';
import { handleError } from '@/utils/errorPipeline';
import { homeLog } from '@/utils/logger';

type FeedbackView = 'list' | 'compose' | 'detail';
type FeedbackFilter = 'open' | 'all';

interface FeedbackTabProps {
  scrollMaxHeight: number;
  isLoggedIn: boolean;
  /** Callback to notify parent that unread count changed */
  onUnreadChange: (count: number) => void;
}

export const FeedbackTab: React.FC<FeedbackTabProps> = ({
  scrollMaxHeight,
  isLoggedIn,
  onUnreadChange,
}) => {
  const [view, setView] = useState<FeedbackView>('list');
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FeedbackFilter>('open');
  const scrollRef = useRef<ScrollView>(null);
  const submitIntent = useRef<{ id: string; content: string } | null>(null);
  const replyIntent = useRef<{ id: string; content: string; feedbackId: string } | null>(null);

  const selectedFeedback = selectedFeedbackId
    ? feedbackItems.find((f) => f.id === selectedFeedbackId)
    : undefined;

  // Load feedback history when tab mounts
  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;

    setIsLoading(true);
    getFeedbackHistory()
      .then((items) => {
        if (cancelled) return;
        setFeedbackItems(items);
      })
      .catch((err) => {
        if (cancelled) return;
        handleError(err, { label: '加载反馈历史', logger: homeLog, feedback: 'toast' });
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  // ── Submit new feedback ───────────────────────────────────────────────────

  const handleSubmitFeedback = useCallback(async () => {
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
      setFeedbackItems(await getFeedbackHistory());
      setView('list');
    } catch (err) {
      handleError(err, { label: '提交反馈', logger: homeLog, feedback: 'toast' });
    } finally {
      setIsSubmitting(false);
    }
  }, [feedbackText]);

  // ── Open detail view ──────────────────────────────────────────────────────

  const handleOpenDetail = useCallback(
    async (feedbackId: string) => {
      setSelectedFeedbackId(feedbackId);
      setView('detail');
      setReplyText('');

      // Mark unread admin replies as read
      const item = feedbackItems.find((f) => f.id === feedbackId);
      const hasUnread = item?.replies.some((r) => r.isAdmin === 1 && r.isRead === 0);
      if (hasUnread) {
        try {
          await markFeedbackRead(feedbackId);
          // Update local state
          setFeedbackItems((prev) =>
            prev.map((f) =>
              f.id === feedbackId
                ? {
                    ...f,
                    replies: f.replies.map((r) =>
                      r.isAdmin === 1 && r.isRead === 0 ? { ...r, isRead: 1 } : r,
                    ),
                  }
                : f,
            ),
          );
          // Recalculate unread count
          const newUnread = feedbackItems.reduce(
            (acc, f) =>
              acc +
              (f.id === feedbackId
                ? 0
                : f.replies.filter((r) => r.isAdmin === 1 && r.isRead === 0).length),
            0,
          );
          onUnreadChange(newUnread);
        } catch (err) {
          handleError(err, { label: '标记已读', logger: homeLog });
        }
      }
    },
    [feedbackItems, onUnreadChange],
  );

  // ── Send reply ────────────────────────────────────────────────────────────

  const handleSendReply = useCallback(async () => {
    const trimmed = replyText.trim();
    if (trimmed.length === 0 || !selectedFeedbackId) return;

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
      setFeedbackItems(await getFeedbackHistory());
      // Scroll to bottom after reply
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      handleError(err, { label: '发送追问', logger: homeLog, feedback: 'toast' });
    } finally {
      setIsSubmitting(false);
    }
  }, [replyText, selectedFeedbackId]);

  const handleSync = async (id: string) => {
    setIsSubmitting(true);
    try {
      const result = await syncFeedbackDelivery(id);
      setFeedbackItems(await getFeedbackHistory());
      if (result.syncStatus === 'synced') toast.success('反馈同步完成');
      else toast.info('结果仍未确认，请勿重复提交；需开发者人工核对');
    } catch (error) {
      handleError(error, { label: '核对反馈', logger: homeLog, feedback: 'toast' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderSyncStatus = (id: string, syncStatus: FeedbackItem['syncStatus']) => {
    if (syncStatus === 'synced') return null;
    return (
      <View style={[styles.backRow, styles.syncStatusRow]}>
        <Text style={styles.bubbleTime}>
          {syncStatus === 'pending'
            ? '已保存，尚未同步'
            : syncStatus === 'needs_review'
              ? '待人工核对，请勿重复提交'
              : '远端结果待核对'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="核对反馈同步状态"
          disabled={isSubmitting}
          onPress={() => void handleSync(id)}
          style={styles.backRow}
        >
          <Ionicons name="sync-outline" size={componentSizes.icon.sm} color={colors.primary} />
          <Text style={styles.backText}>核对状态</Text>
        </Pressable>
      </View>
    );
  };

  // ── Resolve / Reopen ──────────────────────────────────────────────────────

  const handleResolve = useCallback(async (feedbackId: string, action: 'resolve' | 'reopen') => {
    try {
      await resolveFeedback(feedbackId, action);
      const newStatus = action === 'resolve' ? 'resolved' : 'open';
      setFeedbackItems((prev) =>
        prev.map((f) => (f.id === feedbackId ? { ...f, status: newStatus } : f)),
      );
      toast.success(action === 'resolve' ? '已标记解决' : '已重新打开');
    } catch (err) {
      handleError(err, { label: '更新状态', logger: homeLog, feedback: 'toast' });
    }
  }, []);

  // ── Not logged in ─────────────────────────────────────────────────────────

  if (!isLoggedIn) {
    return (
      <View style={[styles.feedbackArea, { maxHeight: scrollMaxHeight }]}>
        <View style={styles.loginHint}>
          <Ionicons
            name="lock-closed-outline"
            size={componentSizes.icon.lg}
            color={colors.textMuted}
          />
          <Text style={styles.loginHintText}>登录后可提交建议</Text>
        </View>
      </View>
    );
  }

  // ── Loading state ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={[styles.feedbackArea, { maxHeight: scrollMaxHeight }]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>加载中…</Text>
        </View>
      </View>
    );
  }

  // ── Compose new feedback ──────────────────────────────────────────────────

  if (view === 'compose') {
    return (
      <View style={[styles.feedbackArea, { maxHeight: scrollMaxHeight }]}>
        <Pressable style={styles.backRow} onPress={() => setView('list')}>
          <Ionicons name="arrow-back" size={componentSizes.icon.sm} color={colors.primary} />
          <Text style={styles.backText}>返回列表</Text>
        </Pressable>
        <TextInput
          style={styles.feedbackInput}
          value={feedbackText}
          onChangeText={setFeedbackText}
          placeholder="说说你的建议或遇到的问题…"
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
          maxLength={500}
          editable={!isSubmitting}
          testID={TESTIDS.feedbackInput}
        />
        <Text style={styles.charCount}>{feedbackText.length}/500</Text>
        <Pressable
          style={[
            styles.submitButton,
            (feedbackText.trim().length === 0 || isSubmitting) && styles.submitButtonDisabled,
          ]}
          onPress={() => void handleSubmitFeedback()}
          disabled={feedbackText.trim().length === 0 || isSubmitting}
          testID={TESTIDS.feedbackSubmitButton}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={colors.textInverse} />
          ) : (
            <Text style={styles.submitButtonText}>提交反馈</Text>
          )}
        </Pressable>
      </View>
    );
  }

  // ── Detail: conversation thread ───────────────────────────────────────────

  if (view === 'detail' && selectedFeedback) {
    return (
      <View style={[styles.feedbackArea, { maxHeight: scrollMaxHeight }]}>
        <Pressable
          style={styles.backRow}
          onPress={() => setView('list')}
          testID={TESTIDS.feedbackBackButton}
        >
          <Ionicons name="arrow-back" size={componentSizes.icon.sm} color={colors.primary} />
          <Text style={styles.backText}>返回列表</Text>
        </Pressable>

        {/* Status chip — tappable to toggle */}
        <Pressable
          style={[
            styles.statusChipTappable,
            selectedFeedback.status === 'resolved'
              ? styles.statusChipResolved
              : styles.statusChipOpen,
          ]}
          onPress={() =>
            void handleResolve(
              selectedFeedback.id,
              selectedFeedback.status === 'resolved' ? 'reopen' : 'resolve',
            )
          }
          testID={TESTIDS.feedbackResolveButton}
          disabled={selectedFeedback.syncStatus !== 'synced' || isSubmitting}
        >
          <Ionicons
            name={
              selectedFeedback.status === 'resolved'
                ? 'checkmark-circle'
                : 'ellipsis-horizontal-circle'
            }
            size={componentSizes.icon.xs}
            color={selectedFeedback.status === 'resolved' ? colors.success : colors.primary}
          />
          <Text
            style={[
              styles.statusChipText,
              {
                color: selectedFeedback.status === 'resolved' ? colors.success : colors.primary,
              },
            ]}
          >
            {selectedFeedback.syncStatus !== 'synced'
              ? '反馈已保存，远端待确认'
              : selectedFeedback.status === 'resolved'
                ? '已解决 · 点击重新打开'
                : '进行中 · 点击标记解决'}
          </Text>
        </Pressable>

        <ScrollView ref={scrollRef} style={styles.chatScroll} showsVerticalScrollIndicator={false}>
          {/* Original feedback message */}
          <View style={styles.bubbleRowRight}>
            <View style={styles.bubbleUser}>
              <Text style={styles.bubbleUserText}>{selectedFeedback.content}</Text>
            </View>
            <Text style={styles.bubbleTime}>{formatTime(selectedFeedback.createdAt)}</Text>
            {renderSyncStatus(selectedFeedback.id, selectedFeedback.syncStatus)}
          </View>

          {/* Replies */}
          {selectedFeedback.replies.map((reply) =>
            reply.isAdmin === 1 ? (
              <View key={reply.id} style={styles.bubbleRowLeft}>
                <View style={styles.bubbleAdminLabel}>
                  <Ionicons
                    name="shield-checkmark"
                    size={componentSizes.icon.xs}
                    color={colors.primary}
                  />
                  <Text style={styles.bubbleAdminLabelText}>开发者</Text>
                </View>
                <View style={styles.bubbleAdmin}>
                  <Text style={styles.bubbleAdminText}>{reply.body}</Text>
                </View>
                <Text style={styles.bubbleTime}>{formatTime(reply.createdAt)}</Text>
              </View>
            ) : (
              <View key={reply.id} style={styles.bubbleRowRight}>
                <View style={styles.bubbleUser}>
                  <Text style={styles.bubbleUserText}>{reply.body}</Text>
                </View>
                <Text style={styles.bubbleTimeRight}>{formatTime(reply.createdAt)}</Text>
                {renderSyncStatus(reply.id, reply.syncStatus)}
              </View>
            ),
          )}

          {/* Inline resolve prompt — show when last reply is from admin and status is open */}
          {(() => {
            const lastReply = selectedFeedback.replies[selectedFeedback.replies.length - 1];
            return (
              selectedFeedback.status === 'open' &&
              lastReply?.isAdmin === 1 && (
                <Pressable
                  style={styles.resolvePrompt}
                  onPress={() => void handleResolve(selectedFeedback.id, 'resolve')}
                >
                  <Text style={styles.resolvePromptText}>问题解决了？</Text>
                  <View style={styles.resolvePromptButton}>
                    <Ionicons
                      name="checkmark-circle"
                      size={componentSizes.icon.xs}
                      color={colors.success}
                    />
                    <Text style={styles.resolvePromptButtonText}>是的</Text>
                  </View>
                </Pressable>
              )
            );
          })()}
        </ScrollView>

        {/* Reply input */}
        <View style={styles.replyBar}>
          <TextInput
            style={styles.replyInput}
            value={replyText}
            onChangeText={setReplyText}
            placeholder="追问…"
            placeholderTextColor={colors.textMuted}
            maxLength={500}
            editable={!isSubmitting && selectedFeedback.syncStatus === 'synced'}
            testID={TESTIDS.feedbackReplyInput}
          />
          <Pressable
            style={[
              styles.replySendButton,
              (replyText.trim().length === 0 ||
                isSubmitting ||
                selectedFeedback.syncStatus !== 'synced') &&
                styles.submitButtonDisabled,
            ]}
            onPress={() => void handleSendReply()}
            disabled={
              replyText.trim().length === 0 ||
              isSubmitting ||
              selectedFeedback.syncStatus !== 'synced'
            }
            testID={TESTIDS.feedbackReplySendButton}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <Ionicons name="send" size={componentSizes.icon.sm} color={colors.textInverse} />
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  // ── List view (default) ───────────────────────────────────────────────────

  const filteredItems =
    filter === 'all' ? feedbackItems : feedbackItems.filter((f) => f.status === 'open');

  return (
    <View
      style={[styles.feedbackArea, { maxHeight: scrollMaxHeight }]}
      testID={TESTIDS.feedbackHistoryList}
    >
      {/* Filter toggle */}
      <View style={styles.filterRow} testID={TESTIDS.feedbackFilterToggle}>
        <Pressable
          style={[styles.filterPill, filter === 'open' && styles.filterPillActive]}
          onPress={() => setFilter('open')}
        >
          <Text style={[styles.filterPillText, filter === 'open' && styles.filterPillTextActive]}>
            进行中
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterPill, filter === 'all' && styles.filterPillActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterPillText, filter === 'all' && styles.filterPillTextActive]}>
            全部
          </Text>
        </Pressable>
      </View>

      {filteredItems.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={componentSizes.icon.xl}
            color={colors.textMuted}
          />
          <Text style={styles.emptyText}>
            {filter === 'open' ? '没有进行中的反馈' : '还没有反馈记录'}
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {filteredItems.map((item) => {
            const unreadCount = item.replies.filter(
              (r) => r.isAdmin === 1 && r.isRead === 0,
            ).length;
            const lastReply =
              item.replies.length > 0 ? item.replies[item.replies.length - 1] : undefined;

            return (
              <Pressable
                key={item.id}
                style={styles.historyItem}
                onPress={() => void handleOpenDetail(item.id)}
                testID={TESTIDS.feedbackHistoryItem(item.id)}
              >
                <View style={styles.historyItemHeader}>
                  <Text style={styles.historyItemContent} numberOfLines={2}>
                    {item.content}
                  </Text>
                  {(item.syncStatus !== 'synced' ||
                    item.replies.some((reply) => reply.syncStatus !== 'synced')) && (
                    <Text style={styles.bubbleTime}>待同步</Text>
                  )}
                  {unreadCount > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.historyItemFooter}>
                  <Text style={styles.historyItemTime}>{formatTime(item.createdAt)}</Text>
                  <Text
                    style={[
                      styles.historyItemStatus,
                      item.status === 'resolved'
                        ? styles.statusResolved
                        : item.replies.some((r) => r.isAdmin === 1)
                          ? styles.statusReplied
                          : styles.statusPending,
                    ]}
                  >
                    {item.status === 'resolved'
                      ? '✅ 已解决'
                      : item.replies.some((r) => r.isAdmin === 1)
                        ? '已回复'
                        : '待回复'}
                  </Text>
                </View>
                {lastReply && (
                  <Text style={styles.historyItemPreview} numberOfLines={1}>
                    {lastReply.isAdmin === 1 ? '开发者：' : '我：'}
                    {lastReply.body}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <Pressable
        style={styles.newFeedbackButton}
        onPress={() => setView('compose')}
        testID={TESTIDS.feedbackNewButton}
      >
        <Ionicons name="add-circle-outline" size={componentSizes.icon.sm} color={colors.primary} />
        <Text style={styles.newFeedbackButtonText}>提交新反馈</Text>
      </Pressable>
    </View>
  );
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHour = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 30) return `${diffDay} 天前`;

  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  syncStatusRow: {
    flexWrap: 'wrap',
    maxWidth: '100%',
  },
  feedbackArea: {
    marginBottom: spacing.small,
  },
  loginHint: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.small,
    paddingVertical: spacing.xlarge,
  },
  loginHintText: {
    fontSize: typography.body,
    color: colors.textMuted,
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.small,
    paddingVertical: spacing.xlarge,
  },
  loadingText: {
    fontSize: typography.caption,
    color: colors.textMuted,
  },
  emptyText: {
    fontSize: typography.body,
    color: colors.textMuted,
  },
  // ── Compose view ──
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight,
    marginBottom: spacing.small,
  },
  backText: {
    fontSize: typography.caption,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  feedbackInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.medium,
    padding: spacing.small,
    fontSize: typography.body,
    color: colors.text,
    height: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: typography.captionSmall,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: spacing.tight,
    marginBottom: spacing.small,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.medium,
    paddingVertical: spacing.small,
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: typography.body,
    fontWeight: typography.weights.semibold,
    color: colors.textInverse,
  },
  // ── History list ──
  historyItem: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.medium,
    padding: spacing.small,
    marginBottom: spacing.small,
    backgroundColor: colors.surface,
  },
  historyItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.small,
  },
  historyItemContent: {
    flex: 1,
    fontSize: typography.body,
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  unreadBadge: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.micro,
  },
  unreadBadgeText: {
    fontSize: typography.captionSmall,
    color: colors.textInverse,
    fontWeight: typography.weights.semibold,
  },
  historyItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.tight,
  },
  historyItemTime: {
    fontSize: typography.captionSmall,
    color: colors.textMuted,
  },
  historyItemStatus: {
    fontSize: typography.captionSmall,
    fontWeight: typography.weights.medium,
  },
  statusReplied: {
    color: colors.success,
  },
  statusPending: {
    color: colors.textMuted,
  },
  statusResolved: {
    color: colors.success,
  },
  historyItemPreview: {
    fontSize: typography.caption,
    color: colors.textMuted,
    marginTop: spacing.tight,
  },
  newFeedbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.tight,
    paddingVertical: spacing.small,
    marginTop: spacing.tight,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.medium,
    borderStyle: 'dashed',
  },
  newFeedbackButtonText: {
    fontSize: typography.body,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  // ── Filter pills ──
  filterRow: {
    flexDirection: 'row',
    gap: spacing.small,
    marginBottom: spacing.small,
  },
  filterPill: {
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.tight,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillText: {
    fontSize: typography.caption,
    color: colors.textMuted,
    fontWeight: typography.weights.medium,
  },
  filterPillTextActive: {
    color: colors.textInverse,
  },
  // ── Status chip (detail header) ──
  statusChipTappable: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.micro,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.tight,
    borderRadius: borderRadius.full,
    marginBottom: spacing.small,
  },
  statusChipOpen: {
    backgroundColor: withAlpha(colors.primary, 0.1),
  },
  statusChipResolved: {
    backgroundColor: withAlpha(colors.success, 0.1),
  },
  statusChipText: {
    fontSize: typography.captionSmall,
    fontWeight: typography.weights.medium,
  },
  // ── Resolve prompt (inline in chat) ──
  resolvePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.small,
    paddingVertical: spacing.small,
    marginVertical: spacing.small,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  resolvePromptText: {
    fontSize: typography.caption,
    color: colors.textMuted,
  },
  resolvePromptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.micro,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.tight,
    borderRadius: borderRadius.full,
    backgroundColor: withAlpha(colors.success, 0.1),
  },
  resolvePromptButtonText: {
    fontSize: typography.caption,
    color: colors.success,
    fontWeight: typography.weights.medium,
  },
  // ── Chat bubbles ──
  chatScroll: {
    flex: 1,
    marginBottom: spacing.small,
  },
  bubbleRowLeft: {
    alignItems: 'flex-start',
    marginBottom: spacing.small,
  },
  bubbleRowRight: {
    alignItems: 'flex-end',
    marginBottom: spacing.small,
  },
  bubbleAdminLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.micro,
    marginBottom: spacing.micro,
  },
  bubbleAdminLabelText: {
    fontSize: typography.captionSmall,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  bubbleAdmin: {
    backgroundColor: withAlpha(colors.primary, 0.08),
    borderRadius: borderRadius.medium,
    borderTopLeftRadius: borderRadius.none,
    padding: spacing.small,
    maxWidth: '85%',
  },
  bubbleAdminText: {
    fontSize: typography.body,
    color: colors.text,
    lineHeight: typography.body * 1.5,
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.medium,
    borderTopRightRadius: borderRadius.none,
    padding: spacing.small,
    maxWidth: '85%',
  },
  bubbleUserText: {
    fontSize: typography.body,
    color: colors.textInverse,
    lineHeight: typography.body * 1.5,
  },
  bubbleTime: {
    fontSize: typography.captionSmall,
    color: colors.textMuted,
    marginTop: spacing.micro,
  },
  bubbleTimeRight: {
    fontSize: typography.captionSmall,
    color: colors.textMuted,
    marginTop: spacing.micro,
    alignSelf: 'flex-end',
  },
  // ── Reply bar ──
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.small,
  },
  replyInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.medium,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.tight,
    fontSize: typography.body,
    color: colors.text,
    maxHeight: 80,
  },
  replySendButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
