/**
 * MagmaFloatFlair — 熔岩浮石 (Skia Canvas + Picture)
 *
 * 6 块不规则熔岩球在外围浮动，由重叠圆组成，带底部热辉光。
 * 全部通过 useDerivedValue + Picture 在 UI 线程 imperative 绘制。
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

const N = 6;

// ── Pre-allocated Skia resources ──
const recorder = Skia.PictureRecorder();
const paint = Skia.Paint();

const BODY_COLOR = Skia.Color('rgb(200,60,20)');
const LOBE_COLOR = Skia.Color('rgb(240,120,20)');
const GLOW_COLOR = Skia.Color('rgb(255,80,0)');
const AURA_BASE = Skia.Color('rgb(240,60,0)');
const AURA_R = 240;
const AURA_G = 60;
const AURA_B = 0;

// Pre-computed seeds
const SEEDS = Array.from({ length: N }, (_, i) => ({
  angle0: (i / N) * Math.PI * 2 + i * 0.4,
  dist: 0.35 + (i % 3) * 0.06,
  phase: i / N,
  rFrac: 0.018 + (i % 3) * 0.007,
}));

export const MagmaFloatFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);
  const slowProgress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1);
    slowProgress.value = withRepeat(withTiming(1, { duration: 7000, easing: Easing.linear }), -1);
  }, [progress, slowProgress]);

  const canvasStyle = useMemo(() => ({ width: size, height: size }), [size]);

  const flairPicture = useDerivedValue(() => {
    'worklet';
    const t = progress.value;
    const st = slowProgress.value;
    const cx = size / 2;
    const cy = size / 2;
    const c = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));

    // ── LegendaryAura ──
    const breathe = 0.03 + 0.07 * (0.5 + 0.5 * Math.sin(st * Math.PI * 2));
    paint.setColor(AURA_BASE);
    paint.setAlphaf(breathe * 0.3);
    c.drawCircle(cx, cy, size * 0.4, paint);
    paint.setAlphaf(breathe * 0.6);
    c.drawCircle(cx, cy, size * 0.3, paint);
    paint.setAlphaf(breathe);
    c.drawCircle(cx, cy, size * 0.2, paint);

    // Orbit ring
    const ringBreath = 0.05 + 0.07 * (0.5 + 0.5 * Math.cos(st * Math.PI * 2 + 1));
    const shift = Math.sin(st * Math.PI * 2) * 20;
    const nr = Math.max(0, Math.min(255, Math.round(AURA_R + shift)));
    const nb = Math.max(0, Math.min(255, Math.round(AURA_B - shift)));
    paint.setColor(Skia.Color(`rgb(${nr},${AURA_G},${nb})`));
    paint.setAlphaf(ringBreath);
    paint.setStyle(1);
    paint.setStrokeWidth(size * 0.015);
    c.drawCircle(cx, cy, size * 0.38, paint);
    paint.setStyle(0);
    paint.setStrokeWidth(0);

    // ── Magma particles ──
    for (let i = 0; i < N; i++) {
      const seed = SEEDS[i]!;
      const tt = (t + seed.phase) % 1;
      const angle = seed.angle0 + Math.sin(tt * Math.PI * 2) * 0.3;
      const dist = seed.dist * size + Math.sin(tt * Math.PI * 4) * size * 0.03;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      const pulse = 0.4 + 0.6 * Math.abs(Math.sin((t * 3 + seed.phase * 5) * Math.PI));
      const r = seed.rFrac * size;

      // Bottom heat glow
      paint.setColor(GLOW_COLOR);
      paint.setAlphaf(pulse * 0.12);
      c.drawCircle(x, y + r * 0.5, r * 1.3, paint);

      // Main body
      paint.setColor(BODY_COLOR);
      paint.setAlphaf(pulse * 0.6);
      c.drawCircle(x, y, r, paint);

      // Lobe
      paint.setColor(LOBE_COLOR);
      paint.setAlphaf(pulse * 0.5);
      c.drawCircle(x + r * 0.4, y - r * 0.3, r * 0.7, paint);
    }

    paint.setAlphaf(1);
    return recorder.finishRecordingAsPicture();
  });

  return (
    <View style={[styles.wrapper, canvasStyle]}>
      <Canvas style={canvasStyle}>
        <Picture picture={flairPicture} />
      </Canvas>
    </View>
  );
});
MagmaFloatFlair.displayName = 'MagmaFloatFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
