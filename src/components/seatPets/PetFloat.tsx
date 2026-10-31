/**
 * PetFloat — the shared idle bob every seat pet sits on.
 *
 * Declares the bob as a Reanimated CSS animation (translateY 0 → -4 px, alternating), so it
 * runs on the compositor on web and in Reanimated core on native. Replaces the former
 * `useFloat` shared-value loop.
 */
import { memo, type ReactNode } from 'react';
import Animated, { type CSSAnimationProperties } from 'react-native-reanimated';

/** Vertical travel of the bob in px. */
const FLOAT_RISE = 4;

export interface PetFloatProps {
  size: number;
  /** Full bob cycle (up and back down) in ms. */
  durationMs: number;
  children: ReactNode;
}

const floatAnimation = (durationMs: number): CSSAnimationProperties => ({
  animationName: {
    from: { transform: [{ translateY: 0 }] },
    to: { transform: [{ translateY: -FLOAT_RISE }] },
  },
  animationDuration: durationMs / 2,
  animationTimingFunction: 'ease-in-out',
  animationIterationCount: 'infinite',
  animationDirection: 'alternate',
});

export const PetFloat = memo<PetFloatProps>(({ size, durationMs, children }) => (
  <Animated.View style={[{ width: size, height: size }, floatAnimation(durationMs)]}>
    {children}
  </Animated.View>
));
PetFloat.displayName = 'PetFloat';
