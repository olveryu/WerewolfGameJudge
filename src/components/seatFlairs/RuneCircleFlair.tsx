/**
 * RuneCircleFlair — 符文之环
 *
 * 8 个几何符文（十字/菱形/三角/方框）排列成旋转圆环，
 * 双层绘制（光晕层 + 亮线层），波浪脉冲流转。
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

const N = 8;
const ORBIT = 0.42;

// 4 glyph types cycled among 8 positions
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

export const RuneCircleFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 10000, easing: Easing.linear }), -1);
  }, [progress]);

  const recorder = useMemo(() => Skia.PictureRecorder(), []);
  const paint = useMemo(() => {
    const p = Skia.Paint();
    p.setStrokeWidth(1.2);
    return p;
  }, []);

  const picture = useDerivedValue(() => {
    'worklet';
    const c = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));
    const cx = size / 2;
    const cy = size / 2;
    const orbit = ORBIT * size;
    const rotAngle = progress.value * Math.PI * 2;
    const glyphR = size * 0.04; // glyph half-size

    // Draw faint connecting ring
    paint.setStrokeWidth(1);
    paint.setColor(Skia.Color('rgba(160,96,224,0.1)'));
    c.drawCircle(cx, cy, orbit, paint);

    for (let i = 0; i < N; i++) {
      const base = (i / N) * Math.PI * 2;
      const angle = base + rotAngle;
      const x = cx + Math.cos(angle) * orbit;
      const y = cy + Math.sin(angle) * orbit;

      // Flowing pulse: wave travels around ring
      const pulse = 0.3 + 0.7 * Math.max(0, Math.sin(((progress.value * N - i) * Math.PI * 2) / N));
      const glyph = GLYPH_ORDER[i];

      // Layer 1: Glow halo
      paint.setColor(Skia.Color(`rgba(180,120,240,${(pulse * 0.2).toFixed(2)})`));
      c.drawCircle(x, y, glyphR * 1.6, paint);

      // Layer 2: Bright glyph lines
      paint.setStrokeWidth(1.5);
      paint.setColor(Skia.Color(`rgba(200,160,255,${(pulse * 0.85).toFixed(2)})`));

      if (glyph === 'cross') {
        c.drawLine(x - glyphR, y, x + glyphR, y, paint);
        c.drawLine(x, y - glyphR, x, y + glyphR, paint);
      } else if (glyph === 'diamond') {
        c.drawLine(x, y - glyphR, x + glyphR, y, paint);
        c.drawLine(x + glyphR, y, x, y + glyphR, paint);
        c.drawLine(x, y + glyphR, x - glyphR, y, paint);
        c.drawLine(x - glyphR, y, x, y - glyphR, paint);
      } else if (glyph === 'triangle') {
        const h = glyphR * 0.866; // sin(60°)
        c.drawLine(x, y - glyphR, x + h, y + glyphR * 0.5, paint);
        c.drawLine(x + h, y + glyphR * 0.5, x - h, y + glyphR * 0.5, paint);
        c.drawLine(x - h, y + glyphR * 0.5, x, y - glyphR, paint);
      } else {
        // square
        const half = glyphR * 0.75;
        c.drawLine(x - half, y - half, x + half, y - half, paint);
        c.drawLine(x + half, y - half, x + half, y + half, paint);
        c.drawLine(x + half, y + half, x - half, y + half, paint);
        c.drawLine(x - half, y + half, x - half, y - half, paint);
      }

      // Center dot
      paint.setColor(Skia.Color(`rgba(220,190,255,${(pulse * 0.7).toFixed(2)})`));
      c.drawCircle(x, y, size * 0.006, paint);
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
RuneCircleFlair.displayName = 'RuneCircleFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
  canvas: { flex: 1 },
});
