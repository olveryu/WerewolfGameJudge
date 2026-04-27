/**
 * RingPortalEnter — 环形传送
 *
 * Concentric rings expand from center with glow, child materializes inside.
 * Epic-tier archetype. Parameterized by ring count, color, pulse, and glow intensity.
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
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { EPIC_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';
import { AnimatedCircle } from '../svgAnimatedPrimitives';
import { EPIC_FLASH_STYLE, useEpicEnhancers } from './useEpicEnhancers';

export interface RingPortalConfig {
  /** Ring stroke color */
  color: string;
  /** Inner glow fill color */
  glowColor: string;
  /** Number of concentric rings (2-4) */
  ringCount: number;
  /** Whether rings pulse or expand smoothly */
  pulse: boolean;
}

const Ring = memo<{
  index: number;
  size: number;
  progress: { value: number };
  config: RingPortalConfig;
}>(({ index, size, progress, config }) => {
  const phaseDelay = index * 0.15;

  const props = useAnimatedProps(() => {
    'worklet';
    const rawT = Math.max(0, Math.min((progress.value - phaseDelay) / (1 - phaseDelay), 1));
    const t = config.pulse ? rawT * (1 + 0.1 * Math.sin(rawT * Math.PI * 4)) : rawT;
    return {
      r: t * size * (0.3 + index * 0.05),
      opacity: (1 - rawT) * 0.6,
      strokeWidth: 2 + (1 - rawT) * 2,
    } as Record<string, number>;
  });

  return (
    <AnimatedCircle
      cx={size / 2}
      cy={size / 2}
      animatedProps={props}
      fill="none"
      stroke={config.color}
    />
  );
});
Ring.displayName = 'Ring';

export const RingPortalEnter = memo<SeatAnimationProps & { config: RingPortalConfig }>(
  ({ size, borderRadius, onComplete, children, config }) => {
    const ringProgress = useSharedValue(0);
    const childOpacity = useSharedValue(0);
    const childScale = useSharedValue(0.5);
    const glowOpacity = useSharedValue(0);
    const { flashStyle, glowProps: epicGlowProps } = useEpicEnhancers(size);

    useEffect(() => {
      ringProgress.value = withTiming(1, {
        duration: EPIC_DURATION * 0.7,
        easing: Easing.out(Easing.cubic),
      });
      glowOpacity.value = withTiming(0.5, { duration: EPIC_DURATION * 0.3 }, () => {
        'worklet';
        glowOpacity.value = withTiming(0, { duration: EPIC_DURATION * 0.4 });
      });
      childOpacity.value = withDelay(
        EPIC_DURATION * 0.3,
        withTiming(
          1,
          { duration: EPIC_DURATION * 0.5, easing: Easing.out(Easing.cubic) },
          (finished) => {
            if (finished) runOnJS(onComplete)();
          },
        ),
      );
      childScale.value = withDelay(
        EPIC_DURATION * 0.3,
        withSpring(1, { dampingRatio: 0.6, duration: 600 }),
      );
    }, [ringProgress, childOpacity, childScale, glowOpacity, onComplete]);

    const childStyle = useAnimatedStyle(() => ({
      opacity: childOpacity.value,
      transform: [{ scale: childScale.value }],
    }));

    const glowProps = useAnimatedProps(() => {
      'worklet';
      return {
        r: size * 0.35,
        opacity: glowOpacity.value,
      } as Record<string, number>;
    });

    const rings = useMemo(
      () => Array.from({ length: config.ringCount }, (_, i) => i),
      [config.ringCount],
    );

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            animatedProps={epicGlowProps}
            fill={config.color}
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            animatedProps={glowProps}
            fill={config.glowColor}
          />
          {rings.map((i) => (
            <Ring key={i} index={i} size={size} progress={ringProgress} config={config} />
          ))}
        </Svg>
        <Animated.View
          style={[styles.childWrapper, { width: size, height: size, borderRadius }, childStyle]}
        >
          {children}
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[EPIC_FLASH_STYLE, { borderRadius }, flashStyle]}
        />
      </View>
    );
  },
);
RingPortalEnter.displayName = 'RingPortalEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
