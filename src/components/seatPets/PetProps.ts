import { useEffect } from 'react';
import {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useLoopProgress } from '@/hooks/useLoopProgress';

/** Props for all seat pet animation components */
export interface PetProps {
  /** Pet display size (px) — typically ~tileSize * 0.32 */
  size: number;
}

/**
 * Continuous 0→1 loop for driving animations.
 * Alias of the shared loop hook — cancels the infinite animation on unmount.
 */
export const useLoop = useLoopProgress;

/**
 * Float bob animation (translateY -4px).
 * Returns an animated style to apply to an Animated.View wrapper.
 */
export function useFloat(duration = 2500) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(
      withTiming(1, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(v);
  }, [v, duration]);
  const floatStyle = useAnimatedStyle(() => {
    'worklet';
    return { transform: [{ translateY: v.value * -4 }] };
  });
  return { floatStyle };
}
