/**
 * DrawButton — 材质感抽奖按钮
 *
 * 普通：靛紫渐变 + 流光扫过。黄金：金色渐变 + 更快流光 + 金色边框。
 * 附带 sparkle 图标 + "仅剩 N 抽" 提示。
 * Press 反馈：Reanimated spring scale 0.95。
 * Disabled 态：去饱和 + 降低 opacity。
 * reducedMotion 时跳过流光动画。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import type { ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { registerKeyframes } from '@/components/seatAnimations/cssAnimations';
import { borderRadius, colors, spacing, typography, withAlpha } from '@/theme';

// Register shimmer sweep keyframes
registerKeyframes(
  'drawButtonShimmer',
  '0%{transform:translateX(-200px) skewX(-20deg)}100%{transform:translateX(400px) skewX(-20deg)}',
);

// ─── Constants ──────────────────────────────────────────────────────────

const GOLDEN_BORDER = '#FFD700';

const NORMAL_GRADIENT: [string, string, string] = ['#5B52ED', '#4F46E5', '#3730A3'];
const GOLDEN_GRADIENT: [string, string, string] = ['#D4A517', '#DAA520', '#B8860B'];

// ─── Props ──────────────────────────────────────────────────────────────

interface DrawButtonProps {
  label: string;
  disabled: boolean;
  onPress: () => void;
  golden?: boolean;
  /** Actual draw count (e.g. 6 when only 6 tickets remain). Shows "仅剩 N 抽" hint. */
  multiPullCount?: number;
  reducedMotion?: boolean | null;
}

// ─── Component ──────────────────────────────────────────────────────────

export function DrawButton({
  label,
  disabled,
  onPress,
  golden,
  multiPullCount,
  reducedMotion,
}: DrawButtonProps) {
  const [pressed, setPressed] = useState(false);

  const wrapperStyle: ViewStyle = {
    transform: [{ scale: pressed ? 0.95 : 1 }],
    ...({
      transitionProperty: 'transform',
      transitionDuration: '150ms',
      transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    } as unknown as ViewStyle),
  };

  const shimmerStyle: ViewStyle | undefined =
    !reducedMotion && !disabled
      ? ({
          animationName: 'drawButtonShimmer',
          animationDuration: golden ? '2.2s' : '3s',
          animationIterationCount: 'infinite',
          animationTimingFunction: 'linear',
        } as unknown as ViewStyle)
      : undefined;

  const handlePressIn = () => setPressed(true);
  const handlePressOut = () => setPressed(false);

  const gradientColors = golden ? GOLDEN_GRADIENT : NORMAL_GRADIENT;

  return (
    <View style={[styles.wrapper, disabled && styles.wrapperDisabled, wrapperStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={styles.pressable}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradient, golden && styles.goldenBorder]}
        >
          {/* Shimmer overlay */}
          {!disabled && <View style={[styles.shimmer, shimmerStyle]} />}

          {/* Inner highlight */}
          <View style={styles.innerHighlight} />

          {/* Content */}
          <View style={styles.content}>
            <Ionicons
              name={golden ? 'star' : 'sparkles'}
              size={14}
              color={withAlpha(colors.surface, disabled ? 0.4 : 0.9)}
            />
            <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
          </View>
          {disabled && <Text style={styles.subLabel}>券不足</Text>}
          {!disabled && multiPullCount != null && multiPullCount < 10 && (
            <Text style={styles.subLabelPartial}>仅剩 {multiPullCount} 抽</Text>
          )}
        </LinearGradient>
      </Pressable>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: borderRadius.medium,
    overflow: 'hidden',
  },
  wrapperDisabled: {
    opacity: 0.35,
  },
  pressable: {
    flex: 1,
  },
  gradient: {
    borderRadius: borderRadius.medium,
    paddingVertical: spacing.medium,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  goldenBorder: {
    borderWidth: 1,
    borderColor: withAlpha(GOLDEN_BORDER, 0.4),
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '60%',
    backgroundColor: withAlpha(colors.surface, 0.12),
    pointerEvents: 'none',
  },
  innerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: withAlpha(colors.surface, 0.2),
    pointerEvents: 'none',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight,
  },
  label: {
    fontSize: typography.body,
    fontWeight: typography.weights.bold,
    color: colors.textInverse,
  },
  labelDisabled: {
    color: withAlpha(colors.textInverse, 0.5),
  },
  subLabel: {
    fontSize: typography.captionSmall,
    color: withAlpha(colors.textInverse, 0.5),
    marginTop: spacing.micro,
  },
  subLabelPartial: {
    fontSize: typography.captionSmall,
    color: withAlpha(colors.textInverse, 0.7),
    marginTop: spacing.micro,
  },
});
