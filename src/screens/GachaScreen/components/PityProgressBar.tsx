/**
 * PityProgressBar — 保底进度条
 *
 * 水平进度条，pity/threshold 填充比例。
 * ≥80% 阈值时触发脉冲动画 + 颜色加深提示。
 * golden 模式使用金色渐变。
 */
import type { ViewStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';

import { registerKeyframes } from '@/components/seatAnimations/cssAnimations';
import { borderRadius, colors, spacing, typography, withAlpha } from '@/theme';

// ─── Constants ──────────────────────────────────────────────────────────

const NEAR_PITY_RATIO = 0.8;
const GOLDEN_COLOR = '#DAA520';
const GOLDEN_GLOW = '#FFD700';

// Register pulse animation
registerKeyframes('pityPulse', '0%{opacity:1}50%{opacity:0.7}100%{opacity:1}');

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

  const pulseStyle: ViewStyle | undefined =
    isNearPity && !reducedMotion
      ? {
          animationName: 'pityPulse',
          animationDuration: '1.6s',
          animationIterationCount: 'infinite',
          animationTimingFunction: 'ease-in-out',
        }
      : undefined;

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
        <View
          style={[
            styles.fill,
            { width: `${fillPercent}%`, backgroundColor: fillColor },
            isNearPity && !reducedMotion && pulseStyle,
          ]}
        >
          {isNearPity && (
            <View style={[styles.glowTip, { backgroundColor: withAlpha(fillColor, 0.5) }]} />
          )}
        </View>
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
