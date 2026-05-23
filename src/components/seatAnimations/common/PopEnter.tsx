/**
 * PopEnter — 弹出入场
 *
 * Children pop in with an elastic overshoot scale and a colored burst ring.
 * Common-tier entrance animation template.
 */
import { memo, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import AnimationOverlay from '../AnimationOverlay';
import { buildMultiAnimationStyle } from '../cssAnimations';
import { COMMON_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';
import type { FlairColorSet } from './palette';

interface ColoredAnimationProps extends SeatAnimationProps {
  colors: FlairColorSet;
}

/** Spring duration approximation — scale settles within ~1.2s for damping=6, stiffness=200 */
const SPRING_DURATION = 1200;

export const PopEnter = memo<ColoredAnimationProps>(
  ({ size, borderRadius, onComplete, children, colors }) => {
    const onCompleteRef = useRef(onComplete);
    useEffect(() => {
      onCompleteRef.current = onComplete;
    });

    useEffect(() => {
      const id = setTimeout(() => onCompleteRef.current(), COMMON_DURATION);
      return () => clearTimeout(id);
    }, []);

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <AnimationOverlay
          dom={{ matchContents: true }}
          size={size}
          duration={COMMON_DURATION}
          effectId="burstRing"
          color={colors.rgb}
        />
        <View
          style={[
            styles.childWrapper,
            { width: size, height: size, borderRadius },
            buildMultiAnimationStyle([
              { name: 'seatQuickFade', duration: COMMON_DURATION * 0.1, easing: 'linear' },
              { name: 'seatPopScale', duration: SPRING_DURATION, easing: 'linear' },
            ]),
          ]}
        >
          {children}
        </View>
      </View>
    );
  },
);
PopEnter.displayName = 'PopEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', opacity: 0 },
});
