/**
 * GuardShield — 守卫之盾
 *
 * Hexagonal shield outline forms, glows, then child appears inside.
 */
import { memo, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import AnimationOverlay from '../AnimationOverlay';
import { buildAnimationStyle, EASE_OUT_CUBIC } from '../cssAnimations';
import { LEGENDARY_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';

const CHILD_DELAY = LEGENDARY_DURATION * 0.5;
const CHILD_DURATION = LEGENDARY_DURATION * 0.35;

export const GuardShield = memo<SeatAnimationProps>(
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
          effectId="guardHexShield"
          color="rgb(60,180,220)"
          easing="linear"
        />
        <View
          style={[
            styles.childWrapper,
            { width: size, height: size, borderRadius },
            buildAnimationStyle({
              name: 'seatLegendaryScale085',
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
GuardShield.displayName = 'GuardShield';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', opacity: 0 },
});
