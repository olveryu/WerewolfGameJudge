/**
 * ThunderBoltFlair — 雷鸣电闪
 *
 * 4 条锯齿电弧沿头像边缘持续游走，每个顶点带辉光点。
 * 亮度正弦脉冲（min 0.3），始终可见。
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

const ARC_COUNT = 4;
const SEGS = 6;

export const ThunderBoltFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1);
  }, [progress]);

  // 4 arcs evenly spaced around the perimeter
  const arcs = useMemo(
    () =>
      Array.from({ length: ARC_COUNT }, (_, a) => ({
        baseAngle: (a / ARC_COUNT) * Math.PI * 2,
        zigzag: Array.from(
          { length: SEGS + 1 },
          (_, s) => (((a * 7 + s * 11) % 13) / 13 - 0.5) * 0.12,
        ),
        phase: a * 0.25,
      })),
    [],
  );

  const recorder = useMemo(() => Skia.PictureRecorder(), []);
  const paint = useMemo(() => {
    const p = Skia.Paint();
    p.setStrokeWidth(1.8);
    return p;
  }, []);

  const picture = useDerivedValue(() => {
    'worklet';
    const c = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));
    const cx = size / 2;
    const cy = size / 2;
    const orbit = size * 0.42;
    const t = progress.value;

    for (let a = 0; a < ARC_COUNT; a++) {
      const arc = arcs[a];
      // Sine pulse per arc (min 0.3, max 1.0)
      const pulse = 0.3 + 0.7 * Math.max(0, Math.sin(((t + arc.phase) % 1) * Math.PI * 2));
      const arcSpan = ((Math.PI * 2) / ARC_COUNT) * 0.7; // each arc spans 70% of its quadrant

      for (let s = 0; s < SEGS; s++) {
        const frac0 = s / SEGS;
        const frac1 = (s + 1) / SEGS;
        const angle0 = arc.baseAngle + t * Math.PI * 2 + frac0 * arcSpan;
        const angle1 = arc.baseAngle + t * Math.PI * 2 + frac1 * arcSpan;
        const r0 = orbit + arc.zigzag[s] * size;
        const r1 = orbit + arc.zigzag[s + 1] * size;
        const x0 = cx + Math.cos(angle0) * r0;
        const y0 = cy + Math.sin(angle0) * r0;
        const x1 = cx + Math.cos(angle1) * r1;
        const y1 = cy + Math.sin(angle1) * r1;

        // Glow line (wider, dimmer)
        paint.setStrokeWidth(4);
        paint.setColor(Skia.Color(`rgba(100,180,255,${(pulse * 0.15).toFixed(2)})`));
        c.drawLine(x0, y0, x1, y1, paint);

        // Core line (thin, bright)
        paint.setStrokeWidth(1.5);
        paint.setColor(Skia.Color(`rgba(160,210,255,${(pulse * 0.8).toFixed(2)})`));
        c.drawLine(x0, y0, x1, y1, paint);

        // Vertex glow dot
        paint.setColor(Skia.Color(`rgba(200,230,255,${(pulse * 0.6).toFixed(2)})`));
        c.drawCircle(x0, y0, size * 0.012, paint);
      }
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
