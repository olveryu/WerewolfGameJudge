/**
 * GuardShield — 守卫盾牌
 *
 * Legendary entrance: hexagonal shield segments assemble around center,
 * golden glow pulses, shield shatters outward revealing avatar.
 */
import { memo, useEffect, useMemo } from 'react';
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

import { LEGENDARY_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';
import { AnimatedCircle, AnimatedPath } from '../svgAnimatedPrimitives';

const SEGMENT_COUNT = 6;

const ShieldSegment = memo<{
  index: number;
  size: number;
  assemble: { value: number };
  shatter: { value: number };
}>(({ index, size, assemble, shatter }) => {
  const angle = (index / SEGMENT_COUNT) * Math.PI * 2 - Math.PI / 2;
  const nextAngle = ((index + 1) / SEGMENT_COUNT) * Math.PI * 2 - Math.PI / 2;

  const props = useAnimatedProps(() => {
    'worklet';
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.35;
    const inR = size * 0.15;
    const assembleT = assemble.value;
    const shatterT = shatter.value;
    const offset = (1 - assembleT) * size * 0.3 + shatterT * size * 0.5;
    const midAngle = (angle + nextAngle) / 2;
    const dx = Math.cos(midAngle) * offset;
    const dy = Math.sin(midAngle) * offset;
    const p1x = cx + Math.cos(angle) * r + dx;
    const p1y = cy + Math.sin(angle) * r + dy;
    const p2x = cx + Math.cos(nextAngle) * r + dx;
    const p2y = cy + Math.sin(nextAngle) * r + dy;
    const p3x = cx + Math.cos(nextAngle) * inR + dx;
    const p3y = cy + Math.sin(nextAngle) * inR + dy;
    const p4x = cx + Math.cos(angle) * inR + dx;
    const p4y = cy + Math.sin(angle) * inR + dy;
    return {
      d: `M ${p1x} ${p1y} L ${p2x} ${p2y} L ${p3x} ${p3y} L ${p4x} ${p4y} Z`,
      opacity: assembleT * (1 - shatterT) * 0.6,
    } as Record<string, string | number>;
  });

  return (
    <AnimatedPath
      animatedProps={props}
      fill="rgb(220,180,50)"
      stroke="rgb(180,140,30)"
      strokeWidth={1}
    />
  );
});
ShieldSegment.displayName = 'ShieldSegment';

export const GuardShield = memo<SeatAnimationProps>(
  ({ size, borderRadius, onComplete, children }) => {
    const assemble = useSharedValue(0);
    const glow = useSharedValue(0);
    const shatter = useSharedValue(0);
    const childOpacity = useSharedValue(0);

    useEffect(() => {
      assemble.value = withTiming(1, {
        duration: LEGENDARY_DURATION * 0.42,
        easing: Easing.out(Easing.cubic),
      });
      glow.value = withDelay(
        LEGENDARY_DURATION * 0.42,
        withTiming(0.6, { duration: LEGENDARY_DURATION * 0.21 }),
      );
      shatter.value = withDelay(
        LEGENDARY_DURATION * 0.63,
        withTiming(1, { duration: LEGENDARY_DURATION * 0.32, easing: Easing.out(Easing.quad) }),
      );
      childOpacity.value = withDelay(
        LEGENDARY_DURATION * 0.63,
        withTiming(
          1,
          { duration: LEGENDARY_DURATION * 0.37, easing: Easing.out(Easing.cubic) },
          (f) => {
            if (f) runOnJS(onComplete)();
          },
        ),
      );
    }, [assemble, glow, shatter, childOpacity, onComplete]);

    const glowProps = useAnimatedProps(() => {
      'worklet';
      return { r: size * 0.25, opacity: glow.value * (1 - shatter.value) } as Record<
        string,
        number
      >;
    });
    const childStyle = useAnimatedStyle(() => ({
      opacity: childOpacity.value,
      transform: [{ scale: 0.7 + childOpacity.value * 0.3 }],
    }));

    const segments = useMemo(() => Array.from({ length: SEGMENT_COUNT }, (_, i) => i), []);

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            animatedProps={glowProps}
            fill="rgb(255,230,100)"
          />
          {segments.map((i) => (
            <ShieldSegment key={i} index={i} size={size} assemble={assemble} shatter={shatter} />
          ))}
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
GuardShield.displayName = 'GuardShield';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
