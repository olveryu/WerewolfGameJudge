/**
 * PortalEnter — 传送门入场
 *
 * A colored elliptical portal opens vertically, then children emerge from within.
 * Rare-tier entrance animation template.
 */
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { RARE_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';
import { AnimatedEllipse } from '../svgAnimatedPrimitives';
import type { FlairColorSet } from './palette';

const PORTAL_DURATION = RARE_DURATION * 0.5;
const EMERGE_DURATION = RARE_DURATION * 0.5;

interface ColoredAnimationProps extends SeatAnimationProps {
  colors: FlairColorSet;
}

export const PortalEnter = memo<ColoredAnimationProps>(
  ({ size, borderRadius, onComplete, children, colors }) => {
    const portalOpen = useSharedValue(0);
    const childProgress = useSharedValue(0);

    useEffect(() => {
      portalOpen.value = withTiming(1, {
        duration: PORTAL_DURATION,
        easing: Easing.out(Easing.cubic),
      });
      childProgress.value = withDelay(
        PORTAL_DURATION * 0.5,
        withTiming(
          1,
          { duration: EMERGE_DURATION, easing: Easing.out(Easing.cubic) },
          (finished) => {
            if (finished) runOnJS(onComplete)();
          },
        ),
      );
    }, [portalOpen, childProgress, onComplete]);

    const outerRingProps = useAnimatedProps(() => {
      'worklet';
      return {
        rx: size * 0.4 * portalOpen.value,
        ry: size * 0.45 * portalOpen.value,
        opacity: 0.4 * (1 - childProgress.value),
      } as Record<string, number>;
    });

    const innerRingProps = useAnimatedProps(() => {
      'worklet';
      return {
        rx: size * 0.3 * portalOpen.value,
        ry: size * 0.35 * portalOpen.value,
        opacity: 0.6 * (1 - childProgress.value),
      } as Record<string, number>;
    });

    const childStyle = useAnimatedStyle(() => ({
      opacity: childProgress.value,
      transform: [{ scale: 0.4 + childProgress.value * 0.6 }],
    }));

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <AnimatedEllipse
            cx={size / 2}
            cy={size / 2}
            animatedProps={outerRingProps}
            fill="none"
            stroke={colors.rgbLight}
            strokeWidth={2}
          />
          <AnimatedEllipse
            cx={size / 2}
            cy={size / 2}
            animatedProps={innerRingProps}
            fill={colors.rgb}
          />
        </Svg>
        <Animated.View
          style={[styles.childWrapper, { width: size, height: size, borderRadius }, childStyle]}
        >
          {children}
        </Animated.View>
      </View>
    );
  },
);
PortalEnter.displayName = 'PortalEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
