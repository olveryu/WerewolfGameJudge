/**
 * FlameEnvelopeEnter — 火焰包裹 (Skia Canvas + Picture)
 *
 * Flame-like particles envelope the tile from edges, then recede to reveal child.
 * Epic-tier archetype. Parameterized by flame color, intensity, direction.
 * All flame tongues rendered in a single Picture worklet.
 */
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { EPIC_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';
import { EPIC_FLASH_STYLE, useEpicEnhancers } from './useEpicEnhancers';

export interface FlameEnvelopeConfig {
  /** Flame primary color */
  color: string;
  /** Flame tip/accent color */
  accentColor: string;
  /** Number of flame tongues (6-10) */
  flameCount: number;
  /** 'inward' = flames converge to center, 'outward' = flames expand from center */
  direction: 'inward' | 'outward';
}

// ── Pre-allocated Skia resources ──
const recorder = Skia.PictureRecorder();
const paint = Skia.Paint();
const path = Skia.Path.Make();

export const FlameEnvelopeEnter = memo<SeatAnimationProps & { config: FlameEnvelopeConfig }>(
  ({ size, borderRadius, onComplete, children, config }) => {
    const flameProgress = useSharedValue(0);
    const childOpacity = useSharedValue(0);
    const childScale = useSharedValue(0.8);
    const { flashStyle } = useEpicEnhancers(size);

    useEffect(() => {
      flameProgress.value = withTiming(1, {
        duration: EPIC_DURATION * 0.7,
        easing: Easing.out(Easing.cubic),
      });
      childOpacity.value = withDelay(
        EPIC_DURATION * 0.3,
        withTiming(
          1,
          { duration: EPIC_DURATION * 0.5, easing: Easing.out(Easing.cubic) },
          (finished) => {
            if (finished) scheduleOnRN(onComplete);
          },
        ),
      );
      childScale.value = withDelay(
        EPIC_DURATION * 0.3,
        withSpring(1, { dampingRatio: 0.6, duration: 600 }),
      );
    }, [flameProgress, childOpacity, childScale, onComplete]);

    const childStyle = useAnimatedStyle(() => ({
      opacity: childOpacity.value,
      transform: [{ scale: childScale.value }],
    }));

    // Pre-compute flame colors at mount (config is stable)
    const flameColor = useMemo(() => Skia.Color(config.color), [config.color]);
    const accentColor = useMemo(() => Skia.Color(config.accentColor), [config.accentColor]);

    const flamePicture = useDerivedValue(() => {
      'worklet';
      const t = flameProgress.value;
      const cx = size / 2;
      const cy = size / 2;
      const isInward = config.direction === 'inward';
      const c = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));

      // Glow circle (same as useEpicEnhancers produces)
      const glowR = size * 0.45 * (0.5 + t * 0.5);
      const glowAlpha = Math.max(0, (1 - t) * 0.3);
      paint.setColor(flameColor);
      paint.setAlphaf(glowAlpha);
      c.drawCircle(cx, cy, glowR, paint);

      // Flame tongues
      for (let i = 0; i < config.flameCount; i++) {
        const angle = (i / config.flameCount) * Math.PI * 2;
        const flickerPhase = t * Math.PI * 6 + i;
        const flicker = Math.sin(flickerPhase) * 0.15;
        const baseRadius = isInward ? size * 0.5 * (1 - t * 0.8) : size * 0.1 + t * size * 0.35;
        const tipRadius = baseRadius + size * (0.08 + flicker);
        const bx = cx + Math.cos(angle) * baseRadius;
        const by = cy + Math.sin(angle) * baseRadius;
        const tx = cx + Math.cos(angle) * tipRadius;
        const ty = cy + Math.sin(angle) * tipRadius;
        const spread = size * 0.03;
        const perpX = -Math.sin(angle) * spread;
        const perpY = Math.cos(angle) * spread;

        path.reset();
        path.moveTo(bx + perpX, by + perpY);
        path.quadTo(tx, ty, bx - perpX, by - perpY);
        path.close();

        const opacity = isInward ? 0.7 * (1 - t) : 0.7 * t * (1 - Math.max(0, (t - 0.7) / 0.3));

        paint.setColor(i % 3 === 0 ? accentColor : flameColor);
        paint.setAlphaf(opacity);
        c.drawPath(path, paint);
      }

      paint.setAlphaf(1);
      return recorder.finishRecordingAsPicture();
    });

    const canvasStyle = useMemo(
      () => ({ width: size, height: size, ...StyleSheet.absoluteFillObject }),
      [size],
    );

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Canvas style={canvasStyle}>
          <Picture picture={flamePicture} />
        </Canvas>
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
FlameEnvelopeEnter.displayName = 'FlameEnvelopeEnter';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
