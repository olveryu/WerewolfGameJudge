/** Public reveal for the round's best cross-examination performer. */

import type React from 'react';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { borderRadius, fixed, spacing, typography } from '@/theme';
import { fashionShadowColors } from '@/theme/fashionShadowColors';

const AWARD_REVEAL_STEP_MS = 180;

interface FashionCrossExamAwardBannerProps {
  readonly seat: number | null;
  readonly displayName: string | null;
}

export const FashionCrossExamAwardBanner: React.FC<FashionCrossExamAwardBannerProps> = ({
  seat,
  displayName,
}) => {
  const reveal = useSharedValue(0);

  useEffect(() => {
    reveal.value = 0;
    reveal.value = withSequence(
      withTiming(1.04, { duration: AWARD_REVEAL_STEP_MS }),
      withTiming(1, { duration: AWARD_REVEAL_STEP_MS }),
    );
    return () => cancelAnimation(reveal);
  }, [reveal, seat]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, reveal.value),
    transform: [{ scale: reveal.value === 0 ? 0.94 : reveal.value }],
  }));

  return (
    <Animated.View
      style={[styles.card, seat === null ? styles.tieCard : styles.winnerCard, animatedStyle]}
    >
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{seat === null ? 'TIE' : 'MVP'}</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.kicker}>CROSS EXAMINATION RESULT</Text>
        <Text style={styles.title}>
          {seat === null
            ? '评选并列 · 本轮无人获得最佳攻防者称号'
            : `${seat + 1}号 · ${displayName ?? '玩家'} 获选最佳攻防者`}
        </Text>
        <Text style={styles.body}>
          {seat === null
            ? '本轮评选没有产生唯一最高票玩家。'
            : '该结果已写入本局结算，并可能影响角色的个人胜利条件。'}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.medium,
    borderRadius: borderRadius.large,
    borderWidth: fixed.borderWidth,
    padding: spacing.medium,
    backgroundColor: fashionShadowColors.surfaceMuted,
  },
  winnerCard: { borderColor: fashionShadowColors.warning },
  tieCard: { borderColor: fashionShadowColors.border },
  badge: {
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.warning,
    backgroundColor: fashionShadowColors.surfaceRaised,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.tight,
  },
  badgeText: {
    color: fashionShadowColors.warning,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
  },
  copy: { flex: 1, gap: spacing.micro },
  kicker: {
    color: fashionShadowColors.textMuted,
    fontSize: typography.captionSmall,
    lineHeight: typography.lineHeights.captionSmall,
    fontWeight: typography.weights.bold,
  },
  title: {
    color: fashionShadowColors.text,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.bold,
  },
  body: {
    color: fashionShadowColors.textSecondary,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
  },
});
