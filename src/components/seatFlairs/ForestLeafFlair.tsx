/**
 * ForestLeafFlair — 落叶知秋
 *
 * 7 片橙褐色树叶从上方旋转飘落，椭圆形状 + 叶脉线。
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

const N = 7;
const COLORS = [
  [180, 100, 30],
  [200, 120, 40],
  [160, 80, 20],
  [190, 110, 35],
  [170, 90, 25],
  [210, 130, 45],
  [175, 95, 28],
] as const;

export const ForestLeafFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        xFrac: 0.1 + (i * 0.8) / (N - 1),
        phase: i / N,
        rotSpeed: 1 + (i % 3) * 0.7,
        sway: 0.03 + (i % 3) * 0.02,
        rFrac: 0.02 + (i % 3) * 0.005,
      })),
    [],
  );

  const recorder = useMemo(() => Skia.PictureRecorder(), []);
  const paint = useMemo(() => {
    const p = Skia.Paint();
    p.setStrokeWidth(0.5);
    return p;
  }, []);

  const picture = useDerivedValue(() => {
    'worklet';
    const c = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));
    const t = progress.value;

    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      const tt = (t * 0.6 + s.phase) % 1;
      const y = tt * size;
      const x = s.xFrac * size + Math.sin(tt * Math.PI * 3) * size * s.sway;
      const alpha = tt < 0.08 ? tt / 0.08 : tt > 0.85 ? (1 - tt) / 0.15 : 0.65;
      const rot = tt * Math.PI * s.rotSpeed;
      const r = s.rFrac * size;
      const [cr, cg, cb] = COLORS[i];

      // Leaf = ellipse approximated by circle (OK for small size)
      // Main body at slight rotation via offset circles
      const dx = Math.cos(rot) * r * 0.3;
      const dy = Math.sin(rot) * r * 0.3;
      paint.setColor(Skia.Color(`rgba(${cr},${cg},${cb},${(alpha * 0.7).toFixed(2)})`));
      c.drawCircle(x - dx, y - dy, r, paint);
      c.drawCircle(x + dx, y + dy, r * 0.8, paint);

      // Vein line
      paint.setStrokeWidth(0.5);
      paint.setColor(
        Skia.Color(`rgba(${cr - 20},${cg - 20},${cb - 10},${(alpha * 0.5).toFixed(2)})`),
      );
      c.drawLine(x - dx * 2, y - dy * 2, x + dx * 2, y + dy * 2, paint);
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
ForestLeafFlair.displayName = 'ForestLeafFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
  canvas: { flex: 1 },
});
