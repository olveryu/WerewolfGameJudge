/**
 * PhaseShiftEnter — 相位偏移
 *
 * Ghost copies shift in/out with a glow behind, then child solidifies.
 * Epic-tier archetype.
 */
import { memo, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import AnimationOverlay from '../AnimationOverlay';
import { buildAnimationStyle, EASE_OUT_CUBIC } from '../cssAnimations';
import { EPIC_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';
import { EPIC_FLASH_ANIM_STYLE, EPIC_FLASH_STYLE } from './useEpicEnhancers';

export interface PhaseShiftConfig {
  color: string;
  accentColor: string;
  pattern?: 'horizontal' | 'vertical' | 'radial';
}

const CHILD_DELAY = EPIC_DURATION * 0.5;
const CHILD_DURATION = EPIC_DURATION * 0.4;

export const PhaseShiftEnter = memo<SeatAnimationProps & { config: PhaseShiftConfig }>(
  ({ size, borderRadius, onComplete, children, config }) => {
    const onCompleteRef = useRef(onComplete);
    useEffect(() => {
      onCompleteRef.current = onComplete;
    });

    useEffect(() => {
      const id = setTimeout(() => onCompleteRef.current(), CHILD_DELAY + CHILD_DURATION);
      return () => clearTimeout(id);
    }, []);

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <AnimationOverlay
          dom={{ matchContents: true }}
          size={size}
          duration={EPIC_DURATION}
          effectId="phaseGlow"
          color={config.color}
        />
        <View
          style={[
            styles.childWrapper,
            { width: size, height: size, borderRadius },
            buildAnimationStyle({
              name: 'seatRevealFade',
              duration: CHILD_DURATION,
              delay: CHILD_DELAY,
              easing: EASE_OUT_CUBIC,
            }),
          ]}
        >
          {children}
        </View>
        <View
          pointerEvents="none"
          style={[EPIC_FLASH_STYLE, { borderRadius }, EPIC_FLASH_ANIM_STYLE]}
        />
      </View>
    );
  },
);
PhaseShiftEnter.displayName = 'PhaseShiftEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', opacity: 0 },
});
