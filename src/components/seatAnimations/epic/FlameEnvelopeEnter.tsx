/**
 * FlameEnvelopeEnter — 火焰包裹
 *
 * Flame-like particles envelope the tile from edges, then recede to reveal child.
 * Epic-tier archetype. Parameterized by flame color, intensity, direction.
 */
import { memo, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import AnimationOverlay from '../AnimationOverlay';
import { buildMultiAnimationStyle, EASE_OUT_CUBIC } from '../cssAnimations';
import { EPIC_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';
import { EPIC_FLASH_ANIM_STYLE, EPIC_FLASH_STYLE } from './useEpicEnhancers';

export interface FlameEnvelopeConfig {
  color: string;
  accentColor: string;
  flameCount: number;
  direction: 'inward' | 'outward';
}

const CHILD_DELAY = EPIC_DURATION * 0.3;
const CHILD_DURATION = EPIC_DURATION * 0.5;

export const FlameEnvelopeEnter = memo<SeatAnimationProps & { config: FlameEnvelopeConfig }>(
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
          effectId="flameTongues"
          color={config.color}
          accentColor={config.accentColor}
          params={JSON.stringify({ flameCount: config.flameCount, direction: config.direction })}
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
              { name: 'seatRevealSpring08', duration: 600, delay: CHILD_DELAY, easing: 'linear' },
            ]) as never,
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
FlameEnvelopeEnter.displayName = 'FlameEnvelopeEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', opacity: 0 },
});
