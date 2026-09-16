// Public discussion transcript and message composer for Fashion Shadow.

import {
  FASHION_DISCUSSION_MESSAGE_MAX_LENGTH,
  FASHION_MAX_DISCUSSION_SPEAKS,
  type FashionPublicState,
} from '@game-judge/game-engine/games/fashion-shadow/public';
import type React from 'react';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { borderRadius, fixed, spacing, typography } from '@/theme';
import { fashionShadowColors } from '@/theme/fashionShadowColors';

import { FashionButton as Button } from './FashionButton';

type DiscussionMode = 'live' | 'archive';

interface FashionDiscussionFeedProps {
  readonly state: FashionPublicState;
  readonly mySeat: number | null;
  readonly myTokens?: number | null;
  readonly mySpeakCount?: number;
  readonly isSubmitting?: boolean;
  readonly mode?: DiscussionMode;
  readonly onSend?: (message: string) => Promise<boolean>;
}

export const FashionDiscussionFeed: React.FC<FashionDiscussionFeedProps> = ({
  state,
  mySeat,
  myTokens = null,
  mySpeakCount = 0,
  isSubmitting = false,
  mode = 'live',
  onSend,
}) => {
  const [draft, setDraft] = useState('');
  const messages = useMemo(
    () =>
      mode === 'live'
        ? state.discussionMessages.filter((message) => message.round === state.currentRound)
        : state.discussionMessages,
    [mode, state.currentRound, state.discussionMessages],
  );
  const trimmedDraft = draft.trim();
  const remainingSpeaks = FASHION_MAX_DISCUSSION_SPEAKS - mySpeakCount;
  const canSend =
    mode === 'live' &&
    onSend !== undefined &&
    mySeat !== null &&
    (myTokens ?? 0) > 0 &&
    remainingSpeaks > 0 &&
    trimmedDraft.length > 0 &&
    !isSubmitting;

  const handleSend = async () => {
    if (!canSend || onSend === undefined) return;
    const accepted = await onSend(trimmedDraft);
    if (accepted) setDraft('');
  };

  return (
    <View style={styles.container}>
      <View style={styles.headingRow}>
        <Text style={styles.heading}>{mode === 'live' ? '公开讨论记录' : '公开讨论档案'}</Text>
        <Text style={styles.counter}>{messages.length} 条</Text>
      </View>

      {messages.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            还没有公开论点。第一条发言会成为所有玩家可见的案件记录。
          </Text>
        </View>
      ) : (
        <View style={styles.messages}>
          {messages.map((message, index) => {
            const occupant = state.realSeats[message.seat];
            const isSelf = message.seat === mySeat;
            return (
              <View
                key={`${message.round}:${message.seat}:${message.createdAt}:${index}`}
                style={[styles.message, isSelf ? styles.messageSelf : null]}
              >
                <Text style={[styles.messageMeta, isSelf ? styles.messageMetaSelf : null]}>
                  {mode === 'archive' ? `R${message.round} · ` : ''}
                  {message.seat + 1}号 · {occupant?.profile.displayName ?? '未知玩家'}
                </Text>
                <Text style={styles.messageText}>{message.message}</Text>
              </View>
            );
          })}
        </View>
      )}

      {mode === 'live' && mySeat !== null ? (
        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="写下可被所有玩家引用的公开论点…"
            placeholderTextColor={fashionShadowColors.textMuted}
            maxLength={FASHION_DISCUSSION_MESSAGE_MAX_LENGTH}
            multiline
            editable={!isSubmitting && remainingSpeaks > 0 && (myTokens ?? 0) > 0}
            style={styles.input}
            accessibilityLabel="公开讨论发言内容"
            accessibilityHint={`最多 ${FASHION_DISCUSSION_MESSAGE_MAX_LENGTH} 字，发布后所有玩家可见且消耗 1 枚行动代币`}
          />
          <View style={styles.composerFooter}>
            <Text style={styles.hint}>
              {draft.length}/{FASHION_DISCUSSION_MESSAGE_MAX_LENGTH} · 剩余 {remainingSpeaks} 次 ·
              行动代币 {myTokens ?? 0} · 每条消耗 1 枚
            </Text>
            <Button
              variant="secondary"
              size="sm"
              onPress={() => void handleSend()}
              disabled={!canSend}
              loading={isSubmitting}
            >
              发布论点
            </Button>
          </View>
        </View>
      ) : mode === 'live' ? (
        <Text style={styles.hint}>旁观者可以读取讨论记录，但不能发布论点。</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: spacing.small },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.small,
  },
  heading: {
    color: fashionShadowColors.text,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.bold,
  },
  counter: {
    color: fashionShadowColors.neonCyan,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.semibold,
  },
  messages: { gap: spacing.small },
  message: {
    backgroundColor: fashionShadowColors.surface,
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.border,
    padding: spacing.medium,
    gap: spacing.tight,
  },
  messageSelf: {
    borderColor: fashionShadowColors.neonCyanSoft,
    backgroundColor: fashionShadowColors.neonCyanSoft,
  },
  messageMeta: {
    color: fashionShadowColors.neonPink,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.semibold,
  },
  messageMetaSelf: { color: fashionShadowColors.neonCyan },
  messageText: {
    color: fashionShadowColors.text,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
  },
  emptyState: {
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.border,
    padding: spacing.medium,
    backgroundColor: fashionShadowColors.surface,
  },
  emptyText: {
    color: fashionShadowColors.textMuted,
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
  },
  composer: {
    borderTopWidth: fixed.borderWidth,
    borderTopColor: fashionShadowColors.border,
    paddingTop: spacing.medium,
    gap: spacing.small,
  },
  input: {
    color: fashionShadowColors.text,
    backgroundColor: fashionShadowColors.surfaceRaised,
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.neonPinkSoft,
    padding: spacing.medium,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    minHeight: spacing.xxlarge,
  },
  composerFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.small,
  },
  hint: {
    flex: 1,
    color: fashionShadowColors.textMuted,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
  },
});
