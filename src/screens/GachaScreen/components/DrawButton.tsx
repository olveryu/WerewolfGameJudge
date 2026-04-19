/**
 * DrawButton — 材质感抽奖按钮
 *
 * 普通：靛紫渐变 + 流光扫过。黄金：金色渐变 + 更快流光 + 金色边框。
 * ×10 按钮更宽，附带 sparkle 图标。
 * Press 反馈：Reanimated spring scale 0.95。
 * Disabled 态：去饱和 + 降低 opacity。
 * reducedMotion 时跳过流光动画。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { borderRadius, colors, spacing, typography, withAlpha } from '@/theme';

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
  /** Multi-pull button. When set, shows sparkle icon and wider layout. */
  multiPull?: boolean;
  /** Actual draw count for multi-pull button (e.g. 6 when only 6 tickets remain). */
  multiPullCount?: number;
  reducedMotion?: boolean | null;
}

// ─── Component ──────────────────────────────────────────────────────────

export function DrawButton({
  label,
  disabled,
  onPress,
  golden,
  multiPull,
  multiPullCount,
  reducedMotion,
}: DrawButtonProps) {
  const pressScale = useSharedValue(1);
  const shimmerX = useSharedValue(-1);

  // Shimmer loop — continuous translateX sweep
  useEffect(() => {
    if (reducedMotion || disabled) return;
    shimmerX.value = -1;
    shimmerX.value = withRepeat(withTiming(2, { duration: golden ? 2200 : 3000 }), -1, false);
  }, [shimmerX, reducedMotion, disabled, golden]);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value * 200 }, { skewX: '-20deg' }],
  }));

  const handlePressIn = () => {
    // eslint-disable-next-line react-hooks/immutability -- Reanimated shared value
    pressScale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
  };
  const handlePressOut = () => {
    // eslint-disable-next-line react-hooks/immutability -- Reanimated shared value
    pressScale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const gradientColors = golden ? GOLDEN_GRADIENT : NORMAL_GRADIENT;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        multiPull && styles.wrapperTen,
        disabled && styles.wrapperDisabled,
        pressStyle,
      ]}
    >
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
          {!disabled && (
            <Animated.View style={[styles.shimmer, shimmerStyle]} pointerEvents="none" />
          )}

          {/* Inner highlight */}
          <View style={styles.innerHighlight} pointerEvents="none" />

          {/* Content */}
          <View style={styles.content}>
            {multiPull && (
              <Ionicons
                name={golden ? 'star' : 'sparkles'}
                size={14}
                color={withAlpha(colors.surface, disabled ? 0.4 : 0.9)}
              />
            )}
            <Text
              style={[styles.label, multiPull && styles.labelTen, disabled && styles.labelDisabled]}
            >
              {label}
            </Text>
          </View>
          {multiPull && disabled && <Text style={styles.subLabel}>券不足</Text>}
          {multiPull && !disabled && multiPullCount != null && multiPullCount < 10 && (
            <Text style={styles.subLabelPartial}>仅剩 {multiPullCount} 抽</Text>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    borderRadius: borderRadius.medium,
    overflow: 'hidden',
  },
  wrapperTen: {
    flex: 1.4,
  },
  wrapperDisabled: {
    opacity: 0.35,
  },
  pressable: {
    flex: 1,
  },
  gradient: {
    flex: 1,
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
  },
  innerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: withAlpha(colors.surface, 0.2),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight,
  },
  label: {
    fontSize: typography.secondary,
    fontWeight: typography.weights.bold,
    color: colors.textInverse,
  },
  labelTen: {
    fontSize: typography.body,
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
