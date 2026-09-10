/** FashionCountdown — presentation-only interrogation timer driven by authoritative end time. */
import type React from 'react';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { borderRadius, fixed, spacing, typography } from '@/theme';
import { fashionShadowColors } from '@/theme/fashionShadowColors';

interface FashionCountdownProps {
  readonly remainingMs: number;
  readonly match: 1 | 2;
}

const URGENT_THRESHOLD_MS = 30_000;

function formatRemaining(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutesPart = Math.floor(seconds / 60);
  const secondsPart = seconds % 60;
  return `${minutesPart}:${String(secondsPart).padStart(2, '0')}`;
}

export const FashionCountdown: React.FC<FashionCountdownProps> = ({ remainingMs, match }) => {
  const pulse = useSharedValue(1);
  const isUrgent = remainingMs > 0 && remainingMs <= URGENT_THRESHOLD_MS;

  useEffect(() => {
    cancelAnimation(pulse);
    pulse.value = 1;
    if (isUrgent) {
      pulse.value = withRepeat(
        withSequence(withTiming(0.74, { duration: 360 }), withTiming(1, { duration: 360 })),
        -1,
        false,
      );
    }
    return () => cancelAnimation(pulse);
  }, [isUrgent, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 0.98 + pulse.value * 0.02 }],
  }));

  return (
    <View style={[styles.frame, isUrgent ? styles.urgentFrame : null]}>
      <Text style={styles.kicker}>CROSS EXAMINATION · MATCH {match}/2</Text>
      <Animated.Text style={[styles.timer, isUrgent ? styles.urgentTimer : null, animatedStyle]}>
        {formatRemaining(remainingMs)}
      </Animated.Text>
      <Text style={styles.caption}>
        {isUrgent ? '最后 30 秒 · 锁定核心证词' : '每组限时 3 分钟'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    borderRadius: borderRadius.large,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.neonCyan,
    backgroundColor: fashionShadowColors.neonCyanSoft,
    padding: spacing.medium,
    gap: spacing.small,
  },
  urgentFrame: {
    borderColor: fashionShadowColors.neonPink,
    backgroundColor: fashionShadowColors.neonPinkSoft,
  },
  kicker: {
    color: fashionShadowColors.textSecondary,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
  },
  timer: {
    color: fashionShadowColors.neonCyan,
    fontSize: typography.display,
    lineHeight: typography.lineHeights.display,
    fontWeight: typography.weights.bold,
  },
  urgentTimer: {
    color: fashionShadowColors.neonPink,
  },
  caption: {
    color: fashionShadowColors.textMuted,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
  },
});
