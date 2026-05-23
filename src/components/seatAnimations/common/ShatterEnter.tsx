/**
 * ShatterEnter — 碎片入场
 *
 * 8 colored shards explode outward from center, then children fade in.
 * Rare-tier entrance animation template.
 */
import { memo, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import AnimationOverlay from '../AnimationOverlay';
import { buildAnimationStyle, EASE_OUT_CUBIC } from '../cssAnimations';
import { RARE_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';
import type { FlairColorSet } from './palette';

const FADE_IN_DELAY = RARE_DURATION * 0.3;
const FADE_IN_DURATION = RARE_DURATION * 0.5;

interface ColoredAnimationProps extends SeatAnimationProps {
  colors: FlairColorSet;
}

export const ShatterEnter = memo<ColoredAnimationProps>(
  ({ size, borderRadius, onComplete, children, colors }) => {
    const onCompleteRef = useRef(onComplete);
    useEffect(() => {
      onCompleteRef.current = onComplete;
    });

    useEffect(() => {
      const id = setTimeout(() => onCompleteRef.current(), FADE_IN_DELAY + FADE_IN_DURATION);
      return () => clearTimeout(id);
    }, []);

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <AnimationOverlay
          dom={{ matchContents: true }}
          size={size}
          duration={RARE_DURATION}
          effectId="shatterShards"
          color={colors.rgb}
          accentColor={colors.rgbLight}
        />
        <View
          style={[
            styles.childWrapper,
            { width: size, height: size, borderRadius },
            buildAnimationStyle({
              name: 'seatShatter',
              duration: FADE_IN_DURATION,
              delay: FADE_IN_DELAY,
              easing: EASE_OUT_CUBIC,
            }),
          ]}
        >
          {children}
        </View>
      </View>
    );
  },
);
ShatterEnter.displayName = 'ShatterEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', opacity: 0 },
});
