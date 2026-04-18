/**
 * PityProgressBar — 保底进度条
 *
 * 水平进度条，pity/threshold 填充比例。
 * ≥80% 阈值时触发脉冲动画 + 颜色加深提示。
 * golden 模式使用金色渐变。
 */
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { borderRadius, colors, spacing, typography, withAlpha } from '@/theme';

// ─── Constants ──────────────────────────────────────────────────────────

const NEAR_PITY_RATIO = 0.8;
const GOLDEN_COLOR = '#DAA520';
const GOLDEN_GLOW = '#FFD700';

// ─── Props ──────────────────────────────────────────────────────────────

interface PityProgressBarProps {
  pity: number;
  threshold: number;
  golden?: boolean;
  reducedMotion?: boolean | null;
}

// ─── Component ──────────────────────────────────────────────────────────

export function PityProgressBar({ pity, threshold, golden, reducedMotion }: PityProgressBarProps) {
  const ratio = threshold > 0 ? pity / threshold : 0;
  const isNearPity = ratio >= NEAR_PITY_RATIO;
  const fillPercent = Math.min(ratio * 100, 100);

  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    if (isNearPity && !reducedMotion) {
      pulseOpacity.value = withRepeat(withTiming(0.7, { duration: 800 }), -1, true);
    } else {
      pulseOpacity.value = 1;
    }
  }, [isNearPity, reducedMotion, pulseOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const fillColor = golden
    ? isNearPity
      ? GOLDEN_GLOW
      : GOLDEN_COLOR
    : isNearPity
      ? colors.primary
      : colors.primaryLight;

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            { width: `${fillPercent}%`, backgroundColor: fillColor },
            isNearPity && !reducedMotion && pulseStyle,
          ]}
        >
          {isNearPity && (
            <View style={[styles.glowTip, { backgroundColor: withAlpha(fillColor, 0.5) }]} />
          )}
        </Animated.View>
      </View>
      <Text style={[styles.text, isNearPity && (golden ? styles.textNearGolden : styles.textNear)]}>
        {pity}/{threshold}
      </Text>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight + spacing.micro,
  },
  track: {
    flex: 1,
    height: 4,
    backgroundColor: withAlpha(colors.text, 0.06),
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: borderRadius.full,
    position: 'relative',
  },
  glowTip: {
    position: 'absolute',
    right: 0,
    top: -2,
    bottom: -2,
    width: 8,
    borderRadius: 4,
  },
  text: {
    fontSize: typography.captionSmall,
    color: colors.textMuted,
    minWidth: 30,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  textNear: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  textNearGolden: {
    color: GOLDEN_COLOR,
    fontWeight: typography.weights.semibold,
  },
});
