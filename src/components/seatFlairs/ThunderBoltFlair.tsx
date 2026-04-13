/**
 * ThunderBoltFlair — 雷鸣电闪
 *
 * 6 条短锯齿闪电从头像边缘向外劈出，轮流闪亮（flash→afterglow→fade）。
 * 始终有 1-2 条可见，模拟静电放电效果。
 * Skia Immediate Mode。
 */
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { FlairProps } from './FlairProps';

const BOLT_COUNT = 6;
/** Each bolt: 4 zigzag segments from inner edge outward */
const SEGS = 4;

export const ThunderBoltFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1);
  }, [progress]);

  // Pre-compute bolt geometry: angle, zigzag offsets, stagger phase
  const bolts = useMemo(
    () =>
      Array.from({ length: BOLT_COUNT }, (_, i) => ({
        angle: (i / BOLT_COUNT) * Math.PI * 2 - Math.PI / 2,
        // Alternating lateral offsets for zigzag shape
        offsets: Array.from(
          { length: SEGS + 1 },
          (_, s) => (s % 2 === 0 ? 1 : -1) * (0.03 + ((i * 7 + s * 3) % 5) * 0.012),
        ),
        phase: i / BOLT_COUNT,
      })),
    [],
  );

  const recorder = useMemo(() => Skia.PictureRecorder(), []);
  const paint = useMemo(() => {
    const p = Skia.Paint();
    p.setAntiAlias(true);
    return p;
  }, []);

  const picture = useDerivedValue(() => {
    'worklet';
    const c = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));
    const cx = size / 2;
    const cy = size / 2;
    const innerR = size * 0.38; // bolt starts near avatar edge
    const outerR = size * 0.52; // bolt ends outside

    for (let b = 0; b < BOLT_COUNT; b++) {
      const bolt = bolts[b];
      // Flash cycle per bolt: 15% flash, 25% afterglow, 60% dark
      const cycle = (progress.value + bolt.phase) % 1;
      let intensity: number;
      if (cycle < 0.15) {
        // Flash: rapid ramp up
        intensity = cycle / 0.15;
      } else if (cycle < 0.4) {
        // Afterglow: slow fade
        intensity = 1 - (cycle - 0.15) / 0.25;
      } else {
        intensity = 0;
      }
      if (intensity < 0.01) continue;

      const cosA = Math.cos(bolt.angle);
      const sinA = Math.sin(bolt.angle);
      // Perpendicular direction for zigzag
      const perpX = -sinA;
      const perpY = cosA;

      // Build segment points along the bolt
      const pts: { x: number; y: number }[] = [];
      for (let s = 0; s <= SEGS; s++) {
        const frac = s / SEGS;
        const r = innerR + frac * (outerR - innerR);
        const lateralOff = bolt.offsets[s] * size;
        pts.push({
          x: cx + cosA * r + perpX * lateralOff,
          y: cy + sinA * r + perpY * lateralOff,
        });
      }

      // Layer 1: Wide glow (blue, transparent)
      paint.setStrokeWidth(size * 0.05);
      paint.setColor(Skia.Color(`rgba(80,160,255,${(intensity * 0.25).toFixed(2)})`));
      for (let s = 0; s < SEGS; s++) {
        c.drawLine(pts[s].x, pts[s].y, pts[s + 1].x, pts[s + 1].y, paint);
      }

      // Layer 2: Mid glow (lighter blue)
      paint.setStrokeWidth(size * 0.025);
      paint.setColor(Skia.Color(`rgba(140,200,255,${(intensity * 0.5).toFixed(2)})`));
      for (let s = 0; s < SEGS; s++) {
        c.drawLine(pts[s].x, pts[s].y, pts[s + 1].x, pts[s + 1].y, paint);
      }

      // Layer 3: Bright core (white-blue)
      paint.setStrokeWidth(size * 0.012);
      paint.setColor(Skia.Color(`rgba(220,240,255,${(intensity * 0.9).toFixed(2)})`));
      for (let s = 0; s < SEGS; s++) {
        c.drawLine(pts[s].x, pts[s].y, pts[s + 1].x, pts[s + 1].y, paint);
      }

      // Tip spark dot
      const tip = pts[SEGS];
      paint.setColor(Skia.Color(`rgba(255,255,255,${(intensity * 0.7).toFixed(2)})`));
      c.drawCircle(tip.x, tip.y, size * 0.015 * intensity, paint);
    }

    return recorder.finishRecordingAsPicture();
  });

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Canvas style={styles.canvas}>
        <Picture picture={picture} />
      </Canvas>
    </View>
  );
});
ThunderBoltFlair.displayName = 'ThunderBoltFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
  canvas: { flex: 1 },
});
