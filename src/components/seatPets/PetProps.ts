import { useEffect } from 'react';
import type { ViewStyle } from 'react-native';
import {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/** Props for all seat pet animation components */
export interface PetProps {
  /** Pet display size (px) — typically ~tileSize * 0.32 */
  size: number;
}

/**
 * Continuous 0→1 loop for driving animations.
 * Returns a SharedValue cycling linearly from 0 to 1 over `duration` ms.
 */
export function useLoop(duration: number): SharedValue<number> {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1);
  }, [v, duration]);
  return v;
}

/**
 * Float bob animation (translateY -4px).
 * Returns an animated style to apply to an Animated.View wrapper.
 */
export function useFloat(duration = 2500): { floatStyle: ViewStyle } {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(
      withTiming(1, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [v, duration]);
  const floatStyle = useAnimatedStyle(() => {
    'worklet';
    return { transform: [{ translateY: v.value * -4 }] };
  });
  return { floatStyle };
}
