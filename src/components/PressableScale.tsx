/**
 * PressableScale - iOS 风格按压缩放组件
 *
 * 按压时 scale(0.97) + opacity(0.9) 弹簧动画，松开回弹。
 * 可选触觉反馈（via triggerHaptic）。兼容 ActionButton 的 meta 回调模式。
 * 使用 CSS transition 实现 Web 端动画。
 *
 * 渲染 UI 并上报用户 intent，不 import service，不包含业务逻辑判断。
 */
import type React from 'react';
import { memo, useCallback, useState } from 'react';
import { type AccessibilityState, Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { triggerHaptic } from '@/components/RoleRevealEffects/utils/haptics';

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
  const [pressed, setPressed] = useState(false);

  const animatedStyle = {
    transform: [{ scale: pressed ? activeScale : 1 }],
    opacity: pressed ? 0.9 : 1,
    transitionProperty: 'transform, opacity',
    transitionDuration: '150ms',
    transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  };

  const handlePressIn = useCallback(() => {
    setPressed(true);
  }, []);

  const handlePressOut = useCallback(() => {
    setPressed(false);
  }, []);

  const handlePress = useCallback(() => {
    if (disabled && !fireWhenDisabled) return;
    if (haptic) {
      void triggerHaptic('light');
    }
    // 兼容 meta 回调模式：始终传 { disabled }，let callers decide
    (onPress as (meta: { disabled: boolean }) => void)({ disabled });
  }, [haptic, onPress, disabled, fireWhenDisabled]);

  return (
    <Pressable
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
    </Pressable>
  );
};

export const PressableScale = memo(PressableScaleComponent);

PressableScale.displayName = 'PressableScale';
