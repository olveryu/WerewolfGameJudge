/**
 * DawnBreak — 破晓黎明
 *
 * Radial light rays expand from center, then child is illuminated.
 */
import { memo, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import AnimationOverlay from '../AnimationOverlay';
import { buildAnimationStyle, EASE_OUT_CUBIC } from '../cssAnimations';
import { LEGENDARY_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';

const CHILD_DELAY = LEGENDARY_DURATION * 0.45;
const CHILD_DURATION = LEGENDARY_DURATION * 0.4;

export const DawnBreak = memo<SeatAnimationProps>(
  ({ size, borderRadius, onComplete, children }) => {
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
          duration={LEGENDARY_DURATION}
          effectId="dawnRays"
          color="rgb(255,200,80)"
          easing="linear"
        />
        <View
          style={[
            styles.childWrapper,
            { width: size, height: size, borderRadius },
            buildAnimationStyle({
              name: 'seatLegendaryScale090',
              duration: CHILD_DURATION,
              delay: CHILD_DELAY,
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
DawnBreak.displayName = 'DawnBreak';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', opacity: 0 },
});
