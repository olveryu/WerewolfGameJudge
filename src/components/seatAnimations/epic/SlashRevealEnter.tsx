/**
 * SlashRevealEnter — 斩击揭幕
 *
 * Diagonal slashes cut across the tile, then child appears.
 * Epic-tier archetype.
 */
import { memo, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import AnimationOverlay from '../AnimationOverlay';
import { buildMultiAnimationStyle, EASE_OUT_CUBIC } from '../cssAnimations';
import { EPIC_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';
import { EPIC_FLASH_ANIM_STYLE, EPIC_FLASH_STYLE } from './useEpicEnhancers';

export interface SlashRevealConfig {
  color: string;
  accentColor: string;
  slashCount: number;
  baseAngle: number;
}

const CHILD_DELAY = EPIC_DURATION * 0.35;
const CHILD_DURATION = EPIC_DURATION * 0.45;

export const SlashRevealEnter = memo<SeatAnimationProps & { config: SlashRevealConfig }>(
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
          effectId="slashLines"
          color={config.color}
          params={JSON.stringify({ slashCount: config.slashCount, baseAngle: config.baseAngle })}
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
              { name: 'seatRevealSpring08', duration: 500, delay: CHILD_DELAY, easing: 'linear' },
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
SlashRevealEnter.displayName = 'SlashRevealEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', opacity: 0 },
});
