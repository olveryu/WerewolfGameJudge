/**
 * RuneCircleFlair — 符文之环 (Skia Canvas + Picture)
 *
 * 8 个几何符文（十字/菱形/三角/方框）排列成旋转圆环，
 * 光晕层 + 符文路径层 + 中心点，波浪脉冲流转。
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
import { useFlairStatic } from './FlairStaticContext';

const N = 8;
const ORBIT = 0.42;

type GlyphType = 'cross' | 'diamond' | 'triangle' | 'square';
const GLYPH_ORDER: GlyphType[] = [
  'cross',
  'diamond',
  'triangle',
  'square',
  'cross',
  'diamond',
  'triangle',
  'square',
];

// ── Pre-allocated Skia resources ──
const recorder = Skia.PictureRecorder();
const paint = Skia.Paint();
const path = Skia.Path.Make();

const HALO_COLOR = Skia.Color('rgb(180,120,240)');
const STROKE_COLOR = Skia.Color('rgb(200,160,255)');
const DOT_COLOR = Skia.Color('rgb(220,190,255)');
const RING_COLOR = Skia.Color('rgb(160,96,224)');
const AURA_BASE = Skia.Color('rgb(160,96,224)');
const AURA_R = 160;
const AURA_G = 96;
const AURA_B = 224;

function drawGlyph(
  c: ReturnType<typeof recorder.beginRecording>,
  glyph: GlyphType,
  x: number,
  y: number,
  g: number,
): void {
  'worklet';
  path.reset();
  if (glyph === 'cross') {
    path.moveTo(x - g, y);
    path.lineTo(x + g, y);
    path.moveTo(x, y - g);
    path.lineTo(x, y + g);
  } else if (glyph === 'diamond') {
    path.moveTo(x, y - g);
    path.lineTo(x + g, y);
    path.lineTo(x, y + g);
    path.lineTo(x - g, y);
    path.close();
  } else if (glyph === 'triangle') {
    const h = g * 0.866;
    path.moveTo(x, y - g);
    path.lineTo(x + h, y + g * 0.5);
    path.lineTo(x - h, y + g * 0.5);
    path.close();
  } else {
    const half = g * 0.75;
    path.moveTo(x - half, y - half);
    path.lineTo(x + half, y - half);
    path.lineTo(x + half, y + half);
    path.lineTo(x - half, y + half);
    path.close();
  }
  c.drawPath(path, paint);
}

export const RuneCircleFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const isStatic = useFlairStatic();
  const progress = useSharedValue(0);
  const slowProgress = useSharedValue(0);

  useEffect(() => {
    if (isStatic) return;
    progress.value = withRepeat(withTiming(1, { duration: 10000, easing: Easing.linear }), -1);
    slowProgress.value = withRepeat(withTiming(1, { duration: 7000, easing: Easing.linear }), -1);
  }, [progress, slowProgress, isStatic]);

  const canvasStyle = useMemo(() => ({ width: size, height: size }), [size]);

  const flairPicture = useDerivedValue(() => {
    'worklet';
    const t = progress.value;
    const st = slowProgress.value;
    const cx = size / 2;
    const cy = size / 2;
    const orbit = ORBIT * size;
    const glyphR = size * 0.04;
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
    c.drawCircle(cx, cy, orbit, paint);
    paint.setStyle(0);
    paint.setStrokeWidth(0);

    // Static orbit ring (faint guide)
    paint.setColor(RING_COLOR);
    paint.setAlphaf(0.1);
    paint.setStyle(1);
    paint.setStrokeWidth(1);
    c.drawCircle(cx, cy, orbit, paint);
    paint.setStyle(0);

    // ── Rune particles ──
    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 2 + t * Math.PI * 2;
      const x = cx + Math.cos(angle) * orbit;
      const y = cy + Math.sin(angle) * orbit;
      const pulse = 0.3 + 0.7 * Math.max(0, Math.sin(((t * N - i) * Math.PI * 2) / N));

      // Halo
      paint.setColor(HALO_COLOR);
      paint.setAlphaf(pulse * 0.2);
      c.drawCircle(x, y, glyphR * 1.6, paint);

      // Glyph path (stroke)
      paint.setColor(STROKE_COLOR);
      paint.setAlphaf(pulse * 0.85);
      paint.setStyle(1);
      paint.setStrokeWidth(1.5);
      drawGlyph(c, GLYPH_ORDER[i]!, x, y, glyphR);
      paint.setStyle(0);

      // Center dot
      paint.setColor(DOT_COLOR);
      paint.setAlphaf(pulse * 0.7);
      c.drawCircle(x, y, size * 0.006, paint);
    }

    paint.setAlphaf(1);
    paint.setStrokeWidth(0);
    return recorder.finishRecordingAsPicture();
  });

  return (
    <View style={[styles.wrapper, canvasStyle]}>
      <Canvas style={canvasStyle} __destroyWebGLContextAfterRender={isStatic}>
        <Picture picture={flairPicture} />
      </Canvas>
    </View>
  );
});
RuneCircleFlair.displayName = 'RuneCircleFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
