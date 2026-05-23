/**
 * ParticleBurstEnter — 粒子爆发
 *
 * Particles explode outward from center, then child appears.
 * Epic-tier archetype.
 */
import { memo, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import AnimationOverlay from '../AnimationOverlay';
import { buildMultiAnimationStyle, EASE_OUT_CUBIC } from '../cssAnimations';
import { EPIC_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';
import { EPIC_FLASH_ANIM_STYLE, EPIC_FLASH_STYLE } from './useEpicEnhancers';

export interface ParticleBurstConfig {
  color: string;
  accentColor: string;
  particleCount: number;
  shape: 'circle' | 'shard';
  spiral: boolean;
}

const CHILD_DELAY = EPIC_DURATION * 0.3;
const CHILD_DURATION = EPIC_DURATION * 0.5;

export const ParticleBurstEnter = memo<SeatAnimationProps & { config: ParticleBurstConfig }>(
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
          effectId="burstParticles"
          color={config.color}
          accentColor={config.accentColor}
          params={JSON.stringify({
            particleCount: config.particleCount,
            shape: config.shape,
            spiral: config.spiral,
          })}
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
ParticleBurstEnter.displayName = 'ParticleBurstEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', opacity: 0 },
});
