/**
 * PressableScale - iOS-style press-to-scale component.
 *
 * Press springs to scale(0.97) + opacity(0.9) and bounces back on release.
 * Optional haptic feedback (via triggerHaptic).
 * Uses react-native-reanimated for cross-platform animation.
 *
 * Renders UI and reports user intent. No service imports, no business logic.
 */
import type React from 'react';
import { memo, useCallback, useMemo } from 'react';
import { type AccessibilityState, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { triggerHaptic } from '@/utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Spring config: fast response, slight bounce. */
const SPRING_CONFIG = {
  damping: 15,
  stiffness: 300,
  mass: 0.8,
} as const;

interface PressableScaleBaseProps {
  /** Scale factor on press (default: 0.97). */
  activeScale?: number;
  /** Whether to trigger haptic feedback (default: false). */
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: 'button' | 'link' | 'tab';
  accessibilityState?: AccessibilityState;
  hitSlop?: number;
}

type PressableScaleProps = PressableScaleBaseProps &
  (
    | {
        onPress: () => void;
        disabled?: boolean;
      }
    | {
        onPress?: never;
        disabled: true;
      }
  );

const PressableScaleComponent: React.FC<PressableScaleProps> = ({
  onPress,
  disabled = false,
  activeScale = 0.97,
  haptic = false,
  style,
  children,
  testID,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  accessibilityState,
  hitSlop,
}) => {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value < 1 ? 0.9 : 1,
  }));

  const handlePressIn = useCallback(() => {
    scale.value = reducedMotion ? 1 : withSpring(activeScale, SPRING_CONFIG);
  }, [activeScale, reducedMotion, scale]);

  const handlePressOut = useCallback(() => {
    scale.value = reducedMotion ? 1 : withSpring(1, SPRING_CONFIG);
  }, [reducedMotion, scale]);

  const handlePress = useMemo(() => {
    if (onPress === undefined) return undefined;
    return () => {
      if (haptic) {
        void triggerHaptic('light');
      }
      onPress();
    };
  }, [haptic, onPress]);

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[animatedStyle, style]}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState ?? { disabled }}
      hitSlop={hitSlop}
    >
      {children}
    </AnimatedPressable>
  );
};

export const PressableScale = memo(PressableScaleComponent);

PressableScale.displayName = 'PressableScale';
