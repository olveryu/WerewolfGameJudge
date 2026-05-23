/**
 * LightningEnter — 闪电入场
 *
 * A lightning bolt strikes down, then children appear with a flash.
 * Rare-tier entrance animation template.
 */
import { memo, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import AnimationOverlay from '../AnimationOverlay';
import { buildAnimationStyle, EASE_OUT_CUBIC } from '../cssAnimations';
import { RARE_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';
import type { FlairColorSet } from './palette';

const FLASH_DELAY = RARE_DURATION * 0.35;
const CHILD_DELAY = RARE_DURATION * 0.4;
const CHILD_DURATION = RARE_DURATION * 0.5;

interface ColoredAnimationProps extends SeatAnimationProps {
  colors: FlairColorSet;
}

export const LightningEnter = memo<ColoredAnimationProps>(
  ({ size, borderRadius, onComplete, children, colors }) => {
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
          duration={RARE_DURATION}
          effectId="lightningBolt"
          color={colors.rgb}
          easing="linear"
        />
        <View
          style={[
            styles.childWrapper,
            { width: size, height: size, borderRadius },
            buildAnimationStyle({
              name: 'seatLightning',
              duration: CHILD_DURATION,
              delay: CHILD_DELAY,
              easing: EASE_OUT_CUBIC,
            }) as never,
          ]}
        >
          {children}
        </View>
        <View
          pointerEvents="none"
          style={[
            styles.flash,
            { borderRadius },
            buildAnimationStyle({
              name: 'seatLightningFlash',
              duration: 250,
              delay: FLASH_DELAY,
              easing: 'linear',
            }) as never,
          ]}
        />
      </View>
    );
  },
);
LightningEnter.displayName = 'LightningEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', opacity: 0 },
  // eslint-disable-next-line react-native/no-color-literals
  flash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'white', opacity: 0 },
});
