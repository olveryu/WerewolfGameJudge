/**
 * 猜词面板：输入框 + 发送 + 聊天式猜词消息流。
 *
 * 猜中者的答案对其他猜题者隐藏：view model 里 text 为 null 时只显示「xxx 猜中了」。
 */

import type { DrawGuessViewModel } from '@game-judge/game-engine/games/drawguess/public';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Animated, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { borderRadius, colors, fixed, spacing, textStyles } from '@/theme';

type DrawGuessGuessMessage = DrawGuessViewModel['messages'][number];

const GUESS_THROTTLE_MS = 2000;
const TOO_FAST_HINT_MS = 1500;

interface DrawGuessGuessPanelProps {
  readonly messages: readonly DrawGuessGuessMessage[];
  readonly viewerSeat: number | null;
  readonly isLocked: boolean;
  readonly canGuess: boolean;
  /** 画手只看聊天流，不显示输入框。 */
  readonly readOnly?: boolean;
  readonly onSubmitGuess: (text: string) => void;
}

function GuessMessageRow({
  message,
  viewerSeat,
}: {
  readonly message: DrawGuessGuessMessage;
  readonly viewerSeat: number | null;
}) {
  if (message.correct && message.seat === viewerSeat) {
    return (
      <View style={[styles.messageRow, styles.ownCorrectRow]}>
        <Text style={styles.ownCorrectText}>🎉 你猜中了！</Text>
      </View>
    );
  }
  if (message.correct) {
    return (
      <View style={[styles.messageRow, styles.otherCorrectRow]}>
        <Text style={styles.otherCorrectText}>
          🎯 {message.displayName} 猜中了{message.text === null ? '' : `：${message.text}`}
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.messageRow}>
      <Text style={styles.messageText}>
        <Text style={styles.messageName}>{message.displayName}：</Text>
        {message.text ?? ''}
      </Text>
    </View>
  );
}

/** 聊天式猜词区；猜中锁定后输入框置灰。 */
export const DrawGuessGuessPanel: React.FC<DrawGuessGuessPanelProps> = ({
  messages,
  viewerSeat,
  isLocked,
  canGuess,
  readOnly = false,
  onSubmitGuess,
}) => {
  const [draft, setDraft] = useState('');
  const [tooFast, setTooFast] = useState(false);
  const lastSubmitRef = useRef(0);
  const shake = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList<DrawGuessGuessMessage>>(null);
  const tooFastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 用户是否在底部附近：只有在底部时才自动滚，不打扰翻看历史的用户
  const isNearBottomRef = useRef(true);

  useEffect(
    () => () => {
      if (tooFastTimer.current !== null) clearTimeout(tooFastTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (messages.length > 0 && isNearBottomRef.current) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  const inputDisabled = !canGuess || isLocked;
  const submit = () => {
    const text = draft.trim();
    if (text.length === 0 || inputDisabled) return;
    const now = Date.now();
    if (now - lastSubmitRef.current < GUESS_THROTTLE_MS) {
      // 客户端节流：超限只抖动提示，不发送命令。
      setTooFast(true);
      if (tooFastTimer.current !== null) clearTimeout(tooFastTimer.current);
      tooFastTimer.current = setTimeout(() => setTooFast(false), TOO_FAST_HINT_MS);
      Animated.sequence([
        Animated.timing(shake, { toValue: 6, duration: 40, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -6, duration: 40, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 4, duration: 40, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 40, useNativeDriver: true }),
      ]).start();
      return;
    }
    lastSubmitRef.current = now;
    setDraft('');
    onSubmitGuess(text);
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(message) => `${message.seat}:${message.at}`}
        renderItem={({ item }) => <GuessMessageRow message={item} viewerSeat={viewerSeat} />}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        accessibilityLabel="猜词消息"
        onScroll={(event) => {
          const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          const distanceFromBottom =
            contentSize.height - contentOffset.y - layoutMeasurement.height;
          // 40px 容差：用户在底部附近才算"在底部"
          isNearBottomRef.current = distanceFromBottom < 40;
        }}
        scrollEventThrottle={100}
      />
      {isLocked ? (
        <View style={styles.lockedBar} accessibilityLabel="已猜中，等待本轮结束">
          <Text style={styles.lockedText}>已猜中，等待本轮结束</Text>
        </View>
      ) : readOnly ? null : (
        <Animated.View style={[styles.inputRow, { transform: [{ translateX: shake }] }]}>
          <TextInput
            style={[styles.input, inputDisabled && styles.inputDisabled]}
            value={draft}
            onChangeText={setDraft}
            placeholder="请用简体输入"
            placeholderTextColor={colors.textSecondary}
            editable={!inputDisabled}
            maxLength={32}
            returnKeyType="send"
            onSubmitEditing={submit}
            accessibilityLabel="猜词输入框"
            accessibilityHint="请用简体输入"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="发送猜词"
            onPress={submit}
            disabled={inputDisabled || draft.trim().length === 0}
            style={({ pressed }) => [
              styles.sendButton,
              (inputDisabled || draft.trim().length === 0) && styles.sendButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.sendText}>发送</Text>
          </Pressable>
        </Animated.View>
      )}
      {tooFast && <Text style={styles.tooFastHint}>慢一点</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: spacing.tight,
  },
  messageList: {
    maxHeight: 280,
    minHeight: 120,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
  },
  messageListContent: {
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.small,
    gap: spacing.tight,
  },
  messageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  messageText: {
    ...textStyles.secondary,
    color: colors.text,
  },
  messageName: {
    ...textStyles.secondarySemibold,
    color: colors.text,
  },
  guessedText: {
    ...textStyles.secondarySemibold,
    color: colors.primary,
  },
  otherCorrectRow: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.tight,
    borderWidth: fixed.borderWidth,
    borderColor: colors.success,
  },
  otherCorrectText: {
    ...textStyles.secondarySemibold,
    color: colors.success,
  },
  ownCorrectRow: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.tight,
    borderWidth: fixed.borderWidth,
    borderColor: colors.primary,
  },
  ownCorrectText: {
    ...textStyles.secondarySemibold,
    color: colors.primary,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.small,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minHeight: fixed.minTouchTarget,
    paddingHorizontal: spacing.small,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.small,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    ...textStyles.body,
    color: colors.text,
  },
  inputDisabled: {
    opacity: fixed.disabledOpacity,
  },
  sendButton: {
    minWidth: fixed.minTouchTarget,
    minHeight: fixed.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.medium,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.small,
  },
  sendButtonDisabled: {
    opacity: fixed.disabledOpacity,
  },
  pressed: {
    opacity: fixed.activeOpacity,
  },
  sendText: {
    ...textStyles.bodySemibold,
    color: colors.surface,
  },
  lockedBar: {
    minHeight: fixed.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.small,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
  },
  lockedText: {
    ...textStyles.secondary,
    color: colors.textSecondary,
  },
  tooFastHint: {
    ...textStyles.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
