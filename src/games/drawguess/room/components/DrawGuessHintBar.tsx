/**
 * 题目提示条：画手看答案，猜题者看字数 + 拼音首字母渐显。
 */

import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { borderRadius, colors, fixed, spacing, textStyles, typography } from '@/theme';

interface DrawGuessHintBarProps {
  /** 画手的题目原文；猜题者为 null。 */
  readonly word: string | null;
  /** 猜题者看到的提示串，如「3个字 · d _ m」；画手为 null。 */
  readonly hintText: string | null;
  readonly wordLength: number;
}

/** 画手看到答案条，猜题者看到字数与拼音首字母提示。 */
export const DrawGuessHintBar: React.FC<DrawGuessHintBarProps> = ({
  word,
  hintText,
  wordLength,
}) => {
  if (word !== null) {
    return (
      <View
        style={styles.container}
        accessibilityLabel={`题目：${word}，共${wordLength}个字`}
        accessibilityRole="text"
      >
        <Text style={styles.word}>{word}</Text>
        <Text style={styles.meta}>{wordLength} 个字</Text>
      </View>
    );
  }
  return (
    <View
      style={styles.container}
      accessibilityLabel={hintText === null ? '等待题目' : `题目提示：${hintText}`}
      accessibilityRole="text"
    >
      <Text style={styles.hint}>{hintText ?? '等待题目…'}</Text>
      <Text style={styles.meta}>每 20 秒揭示一个拼音首字母</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
  },
  word: {
    ...textStyles.titleBold,
    color: colors.text,
  },
  hint: {
    ...textStyles.titleBold,
    color: colors.primary,
    letterSpacing: typography.letterSpacing.wide,
  },
  meta: {
    ...textStyles.caption,
    color: colors.textSecondary,
  },
});
