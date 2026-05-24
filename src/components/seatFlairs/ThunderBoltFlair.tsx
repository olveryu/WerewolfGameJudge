/**
 * ThunderBoltFlair — 雷鸣电闪 (Skia Canvas + Picture)
 *
 * 6 条短锯齿闪电从头像边缘向外劈出，轮流闪亮（flash→afterglow→fade）。
 * 全部通过 useDerivedValue + Picture 在 UI 线程 imperative 绘制。
 */
import { Picture, Skia } from '@shopify/react-native-skia';
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
import { StaticCanvas, useFlairStatic } from './FlairStaticContext';

const BOLT_COUNT = 6;
const SEGS = 4;

// ── Pre-allocated Skia resources ──
const recorder = Skia.PictureRecorder();
const paint = Skia.Paint();
const path = Skia.Path.Make();

const LAYER_COLORS = [
  Skia.Color('rgb(80,160,255)'),
  Skia.Color('rgb(140,200,255)'),
  Skia.Color('rgb(220,240,255)'),
];
const SPARK_COLOR = Skia.Color('rgb(255,255,255)');

// Pre-computed bolt seeds
const BOLT_SEEDS = Array.from({ length: BOLT_COUNT }, (_, i) => ({
  angle: (i / BOLT_COUNT) * Math.PI * 2 - Math.PI / 2,
  offsets: Array.from(
    { length: SEGS + 1 },
    (_, s) => (s % 2 === 0 ? 1 : -1) * (0.03 + ((i * 7 + s * 3) % 5) * 0.012),
  ),
  phase: i / BOLT_COUNT,
}));

export const ThunderBoltFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const isStatic = useFlairStatic();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (isStatic) return;
    progress.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1);
  }, [progress, isStatic]);

  const canvasStyle = useMemo(() => ({ width: size, height: size }), [size]);

  const flairPicture = useDerivedValue(() => {
    'worklet';
    const t = progress.value;
    const cx = size / 2;
    const cy = size / 2;
    const innerR = size * 0.38;
    const outerR = size * 0.52;
    const c = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));

    for (let bi = 0; bi < BOLT_COUNT; bi++) {
      const seed = BOLT_SEEDS[bi]!;
      const cosA = Math.cos(seed.angle);
      const sinA = Math.sin(seed.angle);
      const perpX = -sinA;
      const perpY = cosA;

      // Compute intensity
      const cycle = (t + seed.phase) % 1;
      let intensity: number;
      if (cycle < 0.15) intensity = cycle / 0.15;
      else if (cycle < 0.4) intensity = 1 - (cycle - 0.15) / 0.25;
      else intensity = 0;

      if (intensity < 0.01) continue;

      // Compute bolt path points
      const ptsX: number[] = [];
      const ptsY: number[] = [];
      for (let s = 0; s <= SEGS; s++) {
        const frac = s / SEGS;
        const r = innerR + frac * (outerR - innerR);
        const lateralOff = seed.offsets[s]! * size;
        ptsX.push(cx + cosA * r + perpX * lateralOff);
        ptsY.push(cy + sinA * r + perpY * lateralOff);
      }

      // 3 layers (glow → core → bright)
      const layerWidths = [size * 0.05, size * 0.025, size * 0.012];
      const layerAlphas = [intensity * 0.25, intensity * 0.5, intensity * 0.9];

      for (let li = 0; li < 3; li++) {
        path.reset();
        path.moveTo(ptsX[0]!, ptsY[0]!);
        for (let s = 1; s <= SEGS; s++) {
          path.lineTo(ptsX[s]!, ptsY[s]!);
        }
        paint.setColor(LAYER_COLORS[li]!);
        paint.setAlphaf(layerAlphas[li]!);
        paint.setStyle(1);
        paint.setStrokeWidth(layerWidths[li]!);
        paint.setStrokeCap(1);
        paint.setStrokeJoin(1);
        c.drawPath(path, paint);
      }

      // Spark at tip
      paint.setColor(SPARK_COLOR);
      paint.setAlphaf(intensity * 0.7);
      paint.setStyle(0);
      c.drawCircle(ptsX[SEGS]!, ptsY[SEGS]!, size * 0.015 * intensity, paint);
    }

    paint.setAlphaf(1);
    paint.setStyle(0);
    paint.setStrokeWidth(0);
    return recorder.finishRecordingAsPicture();
  });

  return (
    <View style={[styles.wrapper, canvasStyle]}>
      <StaticCanvas style={canvasStyle}>
        <Picture picture={flairPicture} />
      </StaticCanvas>
    </View>
  );
});
ThunderBoltFlair.displayName = 'ThunderBoltFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
