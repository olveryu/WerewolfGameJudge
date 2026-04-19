/**
 * PressableScale - iOS 风格按压缩放组件
 *
 * 按压时 scale(0.97) + opacity(0.9) 弹簧动画，松开回弹。
 * 可选触觉反馈（via triggerHaptic）。兼容 ActionButton 的 meta 回调模式。
 * 使用 react-native-reanimated 实现跨平台动画。
 *
 * 渲染 UI 并上报用户 intent，不 import service，不包含业务逻辑判断。
 */
import React, { memo, useCallback } from 'react';
import { type AccessibilityState, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { triggerHaptic } from '@/components/RoleRevealEffects/utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** 弹簧配置：快速响应、轻微回弹 */
const SPRING_CONFIG = {
  damping: 15,
  stiffness: 300,
  mass: 0.8,
} as const;

interface PressableScaleProps {
  /** 按压回调。兼容 ActionButton meta 模式和普通 () => void */
  onPress: ((meta: { disabled: boolean }) => void) | (() => void);
  /** 视觉禁用（默认阻断 onPress，除非 fireWhenDisabled=true） */
  disabled?: boolean;
  /** 禁用时仍触发 onPress 并传递 meta（ActionButton 模式）。默认 false */
  fireWhenDisabled?: boolean;
  /** 按压时缩放比例 (default: 0.97) */
  activeScale?: number;
  /** 是否触发触觉反馈 (default: false) */
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'tab';
  accessibilityState?: AccessibilityState;
}

const PressableScaleComponent: React.FC<PressableScaleProps> = ({
  onPress,
  disabled = false,
  fireWhenDisabled = false,
  activeScale = 0.97,
  haptic = false,
  style,
  children,
  testID,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value < 1 ? 0.9 : 1,
  }));

  const handlePressIn = useCallback(() => {
    // eslint-disable-next-line react-hooks/immutability -- Reanimated SharedValue.value is mutable by design
    scale.value = withSpring(activeScale, SPRING_CONFIG);
  }, [activeScale, scale]);

  const handlePressOut = useCallback(() => {
    // eslint-disable-next-line react-hooks/immutability -- Reanimated SharedValue.value is mutable by design
    scale.value = withSpring(1, SPRING_CONFIG);
  }, [scale]);

  const handlePress = useCallback(() => {
    if (disabled && !fireWhenDisabled) return;
    if (haptic) {
      void triggerHaptic('light');
    }
    // 兼容 meta 回调模式：始终传 { disabled }，let callers decide
    (onPress as (meta: { disabled: boolean }) => void)({ disabled });
  }, [haptic, onPress, disabled, fireWhenDisabled]);

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animatedStyle, style]}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState ?? { disabled }}
    >
      {children}
    </AnimatedPressable>
  );
};

export const PressableScale = memo(PressableScaleComponent);

PressableScale.displayName = 'PressableScale';
