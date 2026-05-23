/**
 * ButterflyFlair — 蝶影翩翩 (Skia Canvas + Picture)
 *
 * 6 只蝴蝶在外围环绕飞舞，翅膀扇动（双圆模拟），带身体圆点。
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

const WING_COLORS = [
  Skia.Color('rgb(180,100,220)'),
  Skia.Color('rgb(200,120,240)'),
  Skia.Color('rgb(160,80,200)'),
  Skia.Color('rgb(220,140,255)'),
  Skia.Color('rgb(190,90,230)'),
  Skia.Color('rgb(210,130,250)'),
];
const BODY_COLORS = [
  Skia.Color('rgb(140,60,180)'),
  Skia.Color('rgb(160,80,200)'),
  Skia.Color('rgb(120,40,160)'),
  Skia.Color('rgb(180,100,215)'),
  Skia.Color('rgb(150,50,190)'),
  Skia.Color('rgb(170,90,210)'),
];
const AURA_BASE = Skia.Color('rgb(180,100,220)');
const AURA_R = 180;
const AURA_G = 100;
const AURA_B = 220;

// Pre-computed seeds
const SEEDS = Array.from({ length: N }, (_, i) => ({
  phase: i / N,
  orbit: 0.28 + (i % 2) * 0.08,
  speed: 0.6 + i * 0.1,
}));

export const ButterflyFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);
  const slowProgress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1);
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
    c.drawCircle(cx, cy, size * 0.32, paint);
    paint.setStyle(0);
    paint.setStrokeWidth(0);

    // ── Butterflies ──
    for (let i = 0; i < N; i++) {
      const seed = SEEDS[i]!;
      const angle = (t * seed.speed + seed.phase) * Math.PI * 2;
      const dist = seed.orbit * size + Math.sin(t * Math.PI * 4) * size * 0.03;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      const wingFlap = Math.abs(Math.sin(t * Math.PI * 8 + seed.phase * 10));
      const wingR = size * 0.02 * (0.3 + 0.7 * wingFlap);
      const alpha = 0.4 + 0.4 * wingFlap;
      const bodyAngle = angle + Math.PI / 2;
      const wdx = Math.cos(bodyAngle) * wingR * 0.5;
      const wdy = Math.sin(bodyAngle) * wingR * 0.5;

      // Wings
      paint.setColor(WING_COLORS[i]!);
      paint.setAlphaf(alpha);
      c.drawCircle(x - wdx, y - wdy, wingR, paint);
      c.drawCircle(x + wdx, y + wdy, wingR, paint);

      // Body
      paint.setColor(BODY_COLORS[i]!);
      paint.setAlphaf(Math.min(1, alpha + 0.2));
      c.drawCircle(x, y, size * 0.005, paint);
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
ButterflyFlair.displayName = 'ButterflyFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
