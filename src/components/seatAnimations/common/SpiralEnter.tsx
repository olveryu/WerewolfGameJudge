/**
 * SpiralEnter — 螺旋入场
 *
 * Children spiral inward (rotate + scale + opacity) with a colored ring.
 * Rare-tier entrance animation template.
 */
import { memo, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import AnimationOverlay from '../AnimationOverlay';
import { buildAnimationStyle, EASE_OUT_CUBIC } from '../cssAnimations';
import { RARE_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';
import type { FlairColorSet } from './palette';

interface ColoredAnimationProps extends SeatAnimationProps {
  colors: FlairColorSet;
}

export const SpiralEnter = memo<ColoredAnimationProps>(
  ({ size, borderRadius, onComplete, children, colors }) => {
    const onCompleteRef = useRef(onComplete);
    useEffect(() => {
      onCompleteRef.current = onComplete;
    });

    useEffect(() => {
      const id = setTimeout(() => onCompleteRef.current(), RARE_DURATION);
      return () => clearTimeout(id);
    }, []);

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <AnimationOverlay
          dom={{ matchContents: true }}
          size={size}
          duration={RARE_DURATION}
          effectId="burstRing"
          color={colors.rgb}
        />
        <View
          style={[
            styles.childWrapper,
            { width: size, height: size, borderRadius },
            buildAnimationStyle({
              name: 'seatSpiral',
              duration: RARE_DURATION,
              easing: EASE_OUT_CUBIC,
            }) as never,
          ]}
        >
          {children}
        </View>
      </View>
    );
  },
);
SpiralEnter.displayName = 'SpiralEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', opacity: 0 },
});
