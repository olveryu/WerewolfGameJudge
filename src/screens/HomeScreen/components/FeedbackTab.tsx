/**
 * FeedbackTab — 意见反馈双向对话 UI
 *
 * 三个子视图：历史列表 → 对话详情 → 提交新反馈。
 * 管理员回复左对齐，用户消息右对齐，聊天气泡风格。
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
import type { FeedbackItem } from '@/services/feature/FeedbackService';
import {
  getFeedbackHistory,
  markFeedbackRead,
  replyToFeedback,
  submitFeedback,
} from '@/services/feature/FeedbackService';
import { TESTIDS } from '@/testids';
import { borderRadius, colors, componentSizes, spacing, typography, withAlpha } from '@/theme';
import { handleError } from '@/utils/errorPipeline';
import { homeLog } from '@/utils/logger';

type FeedbackView = 'list' | 'compose' | 'detail';

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
  const scrollRef = useRef<ScrollView>(null);

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
      const feedbackId = await submitFeedback(trimmed, APP_VERSION);
      toast.success('感谢反馈！');
      setFeedbackText('');
      // Add to local list immediately
      setFeedbackItems((prev) => [
        {
          id: feedbackId,
          content: trimmed,
          appVersion: APP_VERSION,
          githubIssueNumber: 0, // Not needed for UI display
          createdAt: new Date().toISOString(),
          replies: [],
        },
        ...prev,
      ]);
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
      await replyToFeedback(selectedFeedbackId, trimmed);
      setReplyText('');
      // Add to local state
      setFeedbackItems((prev) =>
        prev.map((f) =>
          f.id === selectedFeedbackId
            ? {
                ...f,
                replies: [
                  ...f.replies,
                  {
                    id: crypto.randomUUID(),
                    isAdmin: 0,
                    body: trimmed,
                    isRead: 1,
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
            : f,
        ),
      );
      // Scroll to bottom after reply
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      handleError(err, { label: '发送追问', logger: homeLog, feedback: 'toast' });
    } finally {
      setIsSubmitting(false);
    }
  }, [replyText, selectedFeedbackId]);

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

        <ScrollView ref={scrollRef} style={styles.chatScroll} showsVerticalScrollIndicator={false}>
          {/* Original feedback message */}
          <View style={styles.bubbleRowRight}>
            <View style={styles.bubbleUser}>
              <Text style={styles.bubbleUserText}>{selectedFeedback.content}</Text>
            </View>
            <Text style={styles.bubbleTime}>{formatTime(selectedFeedback.createdAt)}</Text>
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
              </View>
            ),
          )}
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
            editable={!isSubmitting}
            testID={TESTIDS.feedbackReplyInput}
          />
          <Pressable
            style={[
              styles.replySendButton,
              (replyText.trim().length === 0 || isSubmitting) && styles.submitButtonDisabled,
            ]}
            onPress={() => void handleSendReply()}
            disabled={replyText.trim().length === 0 || isSubmitting}
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

  return (
    <View
      style={[styles.feedbackArea, { maxHeight: scrollMaxHeight }]}
      testID={TESTIDS.feedbackHistoryList}
    >
      {feedbackItems.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={componentSizes.icon.xl}
            color={colors.textMuted}
          />
          <Text style={styles.emptyText}>还没有反馈记录</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {feedbackItems.map((item) => {
            const unreadCount = item.replies.filter(
              (r) => r.isAdmin === 1 && r.isRead === 0,
            ).length;
            const lastReply =
              item.replies.length > 0 ? item.replies[item.replies.length - 1] : undefined;
            const hasReplies = item.replies.some((r) => r.isAdmin === 1);

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
                      hasReplies ? styles.statusReplied : styles.statusPending,
                    ]}
                  >
                    {hasReplies ? '已回复' : '待回复'}
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
