/**
 * PrismShardFlair — 棱镜碎片 (Skia Canvas + Picture)
 *
 * 6 块彩色三角碎片在外围旋转漂浮，颜色随时间偏移，带顶部高光点。
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
const HUES = [0, 60, 120, 180, 240, 300];

// ── Pre-allocated Skia resources ──
const recorder = Skia.PictureRecorder();
const paint = Skia.Paint();
const path = Skia.Path.Make();

const SPARKLE_COLOR = Skia.Color('rgb(240,240,255)');
const AURA_BASE = Skia.Color('rgb(200,180,255)');
const AURA_R = 200;
const AURA_G = 180;
const AURA_B = 255;

// Pre-computed seeds
const SEEDS = Array.from({ length: N }, (_, i) => ({
  angle0: (i / N) * Math.PI * 2 + i * 0.5,
  dist: 0.36 + (i % 3) * 0.05,
  phase: i / N,
  rotSpeed: 1.5 + (i % 3) * 0.5,
}));

export const PrismShardFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);
  const slowProgress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 7000, easing: Easing.linear }), -1);
    slowProgress.value = withRepeat(withTiming(1, { duration: 11000, easing: Easing.linear }), -1);
  }, [progress, slowProgress]);

  const canvasStyle = useMemo(() => ({ width: size, height: size }), [size]);

  const flairPicture = useDerivedValue(() => {
    'worklet';
    const t = progress.value;
    const st = slowProgress.value;
    const cx0 = size / 2;
    const cy0 = size / 2;
    const shardR = size * 0.028;
    const c = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));

    // ── LegendaryAura ──
    const breathe = 0.03 + 0.07 * (0.5 + 0.5 * Math.sin(st * Math.PI * 2));
    paint.setColor(AURA_BASE);
    paint.setAlphaf(breathe * 0.3);
    c.drawCircle(cx0, cy0, size * 0.4, paint);
    paint.setAlphaf(breathe * 0.6);
    c.drawCircle(cx0, cy0, size * 0.3, paint);
    paint.setAlphaf(breathe);
    c.drawCircle(cx0, cy0, size * 0.2, paint);

    // Orbit ring
    const ringBreath = 0.05 + 0.07 * (0.5 + 0.5 * Math.cos(st * Math.PI * 2 + 1));
    const shift = Math.sin(st * Math.PI * 2) * 20;
    const nr = Math.max(0, Math.min(255, Math.round(AURA_R + shift)));
    const nb = Math.max(0, Math.min(255, Math.round(AURA_B - shift)));
    paint.setColor(Skia.Color(`rgb(${nr},${AURA_G},${nb})`));
    paint.setAlphaf(ringBreath);
    paint.setStyle(1);
    paint.setStrokeWidth(size * 0.015);
    c.drawCircle(cx0, cy0, size * 0.38, paint);
    paint.setStyle(0);
    paint.setStrokeWidth(0);

    // ── Prism shards ──
    for (let i = 0; i < N; i++) {
      const seed = SEEDS[i]!;
      const hue0 = HUES[i]!;
      const angle = seed.angle0 + Math.sin((t + seed.phase) * Math.PI * 1.2) * 0.5;
      const dist = seed.dist * size + Math.cos(t * Math.PI * 2 + seed.phase * 4) * size * 0.03;
      const x = cx0 + Math.cos(angle) * dist;
      const y = cy0 + Math.sin(angle) * dist;
      const pulse = 0.35 + 0.65 * Math.abs(Math.sin((t * 2 + seed.phase * 5) * Math.PI));
      const hue = hue0 + t * 60;
      const rot = t * Math.PI * seed.rotSpeed;

      // Compute hue-shifted color
      const rc = 128 + Math.round(Math.cos((hue * Math.PI) / 180) * 80);
      const gc = 128 + Math.round(Math.cos(((hue - 120) * Math.PI) / 180) * 80);
      const bc = 128 + Math.round(Math.cos(((hue - 240) * Math.PI) / 180) * 80);

      // Inner glow
      paint.setColor(Skia.Color(`rgb(${rc},${gc},${bc})`));
      paint.setAlphaf(pulse * 0.4);
      c.drawCircle(x, y, shardR * 0.5, paint);

      // Triangle outline
      const p0x = x + Math.cos(rot - Math.PI / 2) * shardR;
      const p0y = y + Math.sin(rot - Math.PI / 2) * shardR;
      const p1x = x + Math.cos(rot + Math.PI * 0.3) * shardR * 0.7;
      const p1y = y + Math.sin(rot + Math.PI * 0.3) * shardR * 0.7;
      const p2x = x + Math.cos(rot + Math.PI * 1.2) * shardR * 0.7;
      const p2y = y + Math.sin(rot + Math.PI * 1.2) * shardR * 0.7;

      path.reset();
      path.moveTo(p0x, p0y);
      path.lineTo(p1x, p1y);
      path.lineTo(p2x, p2y);
      path.close();

      const brc = 160 + Math.round(Math.cos((hue * Math.PI) / 180) * 60);
      const bgc = 160 + Math.round(Math.cos(((hue - 120) * Math.PI) / 180) * 60);
      const bbc = 160 + Math.round(Math.cos(((hue - 240) * Math.PI) / 180) * 60);
      paint.setColor(Skia.Color(`rgb(${brc},${bgc},${bbc})`));
      paint.setAlphaf(pulse * 0.7);
      paint.setStyle(1);
      paint.setStrokeWidth(0.8);
      c.drawPath(path, paint);
      paint.setStyle(0);

      // Top sparkle
      paint.setColor(SPARKLE_COLOR);
      paint.setAlphaf(pulse * 0.6);
      c.drawCircle(p0x, p0y, size * 0.006, paint);
    }

    paint.setAlphaf(1);
    paint.setStrokeWidth(0);
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
PrismShardFlair.displayName = 'PrismShardFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
