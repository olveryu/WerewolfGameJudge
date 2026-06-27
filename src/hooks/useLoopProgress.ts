/**
 * useLoopProgress — shared linear 0→1 looping driver for seat flair & pet animations.
 *
 * Returns a SharedValue cycling linearly from 0 to 1 over `duration` ms, forever.
 * The infinite animation is cancelled on unmount via `cancelAnimation` — Reanimated
 * does NOT auto-stop `withRepeat(..., -1)` when the component unmounts, so omitting
 * this leaks the animation (continued UI-thread / web rAF work → heat & battery drain).
 */
import { useEffect } from 'react';
import {
  cancelAnimation,
  Easing,
  type SharedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export function useLoopProgress(duration: number): SharedValue<number> {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1);
    return () => cancelAnimation(progress);
  }, [progress, duration]);
  return progress;
}
