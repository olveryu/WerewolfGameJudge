/**
 * 猜词输入行：输入框 + 发送 + 2 秒客户端节流。
 *
 * 草稿由作画视图持有并受控：提交失败时草稿保留，只有服务端确认成功后
 * 作画视图才清空草稿。猜中锁定后本行退化为锁定条。
 */

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { borderRadius, colors, fixed, spacing, textStyles } from '@/theme';

const GUESS_THROTTLE_MS = 2000;
const TOO_FAST_HINT_MS = 1500;

interface DrawGuessGuessComposerProps {
  /** 受控草稿：作画视图持有，失败保留、成功清空。 */
  readonly draft: string;
  readonly onDraftChange: (value: string) => void;
  readonly isLocked: boolean;
  readonly canGuess: boolean;
  /** 提交命令并返回服务端是否受理；失败时不清空草稿。 */
  readonly onSubmitGuess: (text: string) => Promise<boolean>;
}

/** 猜词输入行；猜中锁定后显示锁定条，输入框置灰。 */
export const DrawGuessGuessComposer: React.FC<DrawGuessGuessComposerProps> = ({
  draft,
  onDraftChange,
  isLocked,
  canGuess,
  onSubmitGuess,
}) => {
  const [tooFast, setTooFast] = useState(false);
  const lastSubmitRef = useRef(0);
  const shake = useRef(new Animated.Value(0)).current;
  const tooFastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (tooFastTimer.current !== null) clearTimeout(tooFastTimer.current);
    },
    [],
  );

  if (isLocked) {
    return (
      <View style={styles.lockedBar} accessibilityLabel="已猜中，等待本轮结束">
        <Text style={styles.lockedText}>已猜中，等待本轮结束</Text>
      </View>
    );
  }

  const inputDisabled = !canGuess;
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
    void (async () => {
      const accepted = await onSubmitGuess(text);
      if (accepted) onDraftChange('');
    })();
  };

  return (
    <View>
      <Animated.View style={[styles.inputRow, { transform: [{ translateX: shake }] }]}>
        <TextInput
          style={[styles.input, inputDisabled && styles.inputDisabled]}
          value={draft}
          onChangeText={onDraftChange}
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
      {tooFast && <Text style={styles.tooFastHint}>慢一点</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
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
