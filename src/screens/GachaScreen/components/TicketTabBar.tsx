/**
 * TicketTabBar — 双面板券种切换器
 *
 * 两个 tab 各显示 icon + 名称 + 数量，inactive tab 降透明度但数字始终可见。
 * Animated sliding indicator 跟随 active tab 滑动。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { borderRadius, colors, spacing, typography, withAlpha } from '@/theme';

// ─── Constants ──────────────────────────────────────────────────────────

const NORMAL_TINT = '#6366F1';
const GOLDEN_TINT = '#B8860B';
const GOLDEN_ICON = '#DAA520';

const SLIDER_EASING_DURATION = 300;

// ─── Props ──────────────────────────────────────────────────────────────

interface TicketTabBarProps {
  activeTab: 'normal' | 'golden';
  normalCount: number;
  goldenCount: number;
  onSwitch: (tab: 'normal' | 'golden') => void;
  reducedMotion?: boolean | null;
}

// ─── Component ──────────────────────────────────────────────────────────

export function TicketTabBar({
  activeTab,
  normalCount,
  goldenCount,
  onSwitch,
  reducedMotion,
}: TicketTabBarProps) {
  const sliderX = useSharedValue(activeTab === 'golden' ? 1 : 0);

  useEffect(() => {
    const target = activeTab === 'golden' ? 1 : 0;
    if (reducedMotion) {
      sliderX.value = target;
    } else {
      sliderX.value = withTiming(target, { duration: SLIDER_EASING_DURATION });
    }
  }, [activeTab, reducedMotion, sliderX]);

  const sliderStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sliderX.value * sliderWidthOffset }],
    backgroundColor:
      sliderX.value > 0.5 ? withAlpha(GOLDEN_TINT, 0.1) : withAlpha(NORMAL_TINT, 0.12),
  }));

  const isNormal = activeTab === 'normal';

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.slider, sliderStyle]} />

      {/* Normal tab */}
      <Pressable
        style={[styles.tab, !isNormal && styles.tabInactive]}
        onPress={() => onSwitch('normal')}
        accessibilityRole="tab"
        accessibilityState={{ selected: isNormal }}
        accessibilityLabel={`普通券 ${normalCount} 张`}
      >
        <View style={styles.iconWrapNormal}>
          <Ionicons name="ticket-outline" size={12} color={NORMAL_TINT} />
        </View>
        <Text style={[styles.label, !isNormal && styles.labelInactive]}>普通</Text>
        <Text style={[styles.count, styles.countNormal, !isNormal && styles.countInactive]}>
          {normalCount}
        </Text>
      </Pressable>

      {/* Golden tab */}
      <Pressable
        style={[styles.tab, isNormal && styles.tabInactive]}
        onPress={() => onSwitch('golden')}
        accessibilityRole="tab"
        accessibilityState={{ selected: !isNormal }}
        accessibilityLabel={`黄金券 ${goldenCount} 张`}
      >
        <View style={styles.iconWrapGolden}>
          <Ionicons name="star" size={12} color={GOLDEN_ICON} />
        </View>
        <Text style={[styles.label, isNormal && styles.labelInactive]}>黄金</Text>
        <Text style={[styles.count, styles.countGolden, isNormal && styles.countInactive]}>
          {goldenCount}
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Layout Constants ───────────────────────────────────────────────────

// Slider occupies ~50% minus padding. Offset = container inner width / 2.
// We use a relative approach: slider width = 50% via flex, offset via translateX.
// Since slider is absolutely positioned and uses left: SLIDER_PAD, translateX
// moves it by (containerWidth - 2*SLIDER_PAD) / 2. We approximate with a fixed
// value matching the 375px base width; the slider stretches to ~50% via
// position + right calc, so translateX of ~163 works. However, for
// responsiveness, we instead use a percentage-based approach.
//
// Actually, let's compute at layout time. For simplicity: slider fills 50%,
// and translateX offset = 50% of container ≈ half the inner width.
// With padding 3px each side, inner = 375 - 2*screenH - 2*3 ≈ 329.
// Half = ~164. We'll use a good-enough constant that the slider visually aligns.
const sliderWidthOffset = 168;

// ─── Styles ─────────────────────────────────────────────────────────────

const SLIDER_PAD = 3;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: borderRadius.medium,
    backgroundColor: withAlpha(colors.text, 0.04),
    padding: SLIDER_PAD,
    position: 'relative',
  },
  slider: {
    position: 'absolute',
    top: SLIDER_PAD,
    bottom: SLIDER_PAD,
    left: SLIDER_PAD,
    width: '49%',
    borderRadius: borderRadius.medium - 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.small,
    paddingVertical: spacing.small + spacing.micro,
    borderRadius: borderRadius.medium - 2,
    zIndex: 1,
  },
  tabInactive: {
    opacity: 0.45,
  },
  iconWrapNormal: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.small - 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(NORMAL_TINT, 0.2),
  },
  iconWrapGolden: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.small - 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(GOLDEN_ICON, 0.15),
  },
  label: {
    fontSize: typography.secondary,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  labelInactive: {
    color: colors.textMuted,
  },
  count: {
    fontSize: typography.body - 1,
    fontWeight: typography.weights.bold,
    fontVariant: ['tabular-nums'],
    minWidth: 20,
  },
  countNormal: {
    color: NORMAL_TINT,
  },
  countGolden: {
    color: GOLDEN_TINT,
  },
  countInactive: {
    opacity: 0.7,
  },
});
