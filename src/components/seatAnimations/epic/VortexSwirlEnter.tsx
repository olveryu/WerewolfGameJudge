/**
 * VortexSwirlEnter — 漩涡旋卷
 *
 * Particles spiral inward like a vortex, then child appears.
 * Epic-tier archetype.
 */
import { memo, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import AnimationOverlay from '../AnimationOverlay';
import { buildMultiAnimationStyle, EASE_OUT_CUBIC } from '../cssAnimations';
import { EPIC_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';
import { EPIC_FLASH_ANIM_STYLE, EPIC_FLASH_STYLE } from './useEpicEnhancers';

export interface VortexSwirlConfig {
  color: string;
  accentColor: string;
  particleCount: number;
  direction?: number;
  rotations?: number;
}

const CHILD_DELAY = EPIC_DURATION * 0.4;
const CHILD_DURATION = EPIC_DURATION * 0.4;

export const VortexSwirlEnter = memo<SeatAnimationProps & { config: VortexSwirlConfig }>(
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
          effectId="vortexDots"
          color={config.color}
          accentColor={config.accentColor}
          params={JSON.stringify({ particleCount: config.particleCount })}
          easing="linear"
        />
        <View
          style={[
            styles.childWrapper,
            { width: size, height: size, borderRadius },
            buildMultiAnimationStyle([
              {
                name: 'seatRevealFade',
                duration: CHILD_DURATION,
                delay: CHILD_DELAY,
                easing: EASE_OUT_CUBIC,
              },
              { name: 'seatRevealSpring07', duration: 500, delay: CHILD_DELAY, easing: 'linear' },
            ]),
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
VortexSwirlEnter.displayName = 'VortexSwirlEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', opacity: 0 },
});
