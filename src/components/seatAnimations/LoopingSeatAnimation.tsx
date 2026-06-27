/**
 * LoopingSeatAnimation — wrapper that loops one-shot sit-down animations
 *
 * Sit-down animations are designed for one-shot playback (stop after onComplete).
 * This component achieves looping by incrementing a key to trigger React remount,
 * with a configurable interval between cycles.
 *
 * Used both in the live room seat grid (SeatTile) and in the AppearanceScreen /
 * UnlocksScreen grid previews. In the live grid the loop is gated off during the
 * Ongoing phase (see SeatTile `seatDecorationsEnabled`) to cut CPU/GPU heat &
 * battery drain.
 */
import { memo, useCallback, useEffect, useReducer, useRef } from 'react';
import { View } from 'react-native';

import type { SeatAnimationProps } from './SeatAnimationProps';

/** Wait time after each animation cycle ends (ms) */
const DEFAULT_LOOP_DELAY = 800;

interface LoopingSeatAnimationProps {
  /** Animation component to loop */
  Component: React.ComponentType<SeatAnimationProps>;
  /** Animation size */
  size: number;
  /** Border radius */
  borderRadius: number;
  /** Children (content wrapped by the animation) */
  children: React.ReactNode;
  /** Loop interval (ms), default 800 */
  loopDelay?: number;
  /** Callback when animation active state changes: true=playing, false=waiting between cycles */
  onActiveChange?: (active: boolean) => void;
}

export const LoopingSeatAnimation = memo<LoopingSeatAnimationProps>(
  // eslint-disable-next-line @typescript-eslint/naming-convention -- React component prop requires PascalCase
  ({ Component, size, borderRadius, children, loopDelay = DEFAULT_LOOP_DELAY, onActiveChange }) => {
    const [cycle, bump] = useReducer((n: number) => n + 1, 0);
    const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    // Signal animation started on each new cycle (mount / remount)
    useEffect(() => {
      onActiveChange?.(true);
    }, [cycle, onActiveChange]);

    const handleComplete = useCallback(() => {
      onActiveChange?.(false);
      // Clear any pending timer to prevent stacking
      if (timerRef.current != null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(bump, loopDelay);
    }, [loopDelay, onActiveChange]);

    return (
      <View style={{ width: size, height: size }}>
        <Component key={cycle} size={size} borderRadius={borderRadius} onComplete={handleComplete}>
          {children}
        </Component>
      </View>
    );
  },
);

LoopingSeatAnimation.displayName = 'LoopingSeatAnimation';
