/**
 * PhoenixFeatherFlair — 凤凰羽
 *
 * 8 根金红色羽毛从外围螺旋上升，带弧线轨迹和辉光。
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

export const PhoenixFeatherFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        angle: (i / N) * Math.PI * 2,
        phase: i / N,
        dist: 0.25 + (i % 3) * 0.08,
      })),
    [],
  );

  const recorder = useMemo(() => Skia.PictureRecorder(), []);
  const paint = useMemo(() => {
    const p = Skia.Paint();
    p.setStrokeWidth(2);
    return p;
  }, []);

  const picture = useDerivedValue(() => {
    'worklet';
    const c = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));
    const cx = size / 2;
    const cy = size / 2;
    const t = progress.value;

    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      const tt = (t + s.phase) % 1;
      const spiralAngle = s.angle + tt * Math.PI * 4;
      const dist = (s.dist + tt * 0.2) * size;
      const y0 = cy - tt * size * 0.3;
      const x0 = cx + Math.cos(spiralAngle) * dist * 0.3;
      const alpha = tt < 0.1 ? tt / 0.1 : tt > 0.7 ? (1 - tt) / 0.3 : 0.9;

      // Feather as line segment
      const featherLen = size * 0.035;
      const angle = spiralAngle + Math.PI / 2;
      const dx = Math.cos(angle) * featherLen;
      const dy = Math.sin(angle) * featherLen;
      paint.setStrokeWidth(2);
      paint.setColor(Skia.Color(`rgba(255,160,30,${(alpha * 0.8).toFixed(2)})`));
      c.drawLine(x0 - dx, y0 - dy, x0 + dx, y0 + dy, paint);

      // Glow circle
      paint.setColor(Skia.Color(`rgba(255,100,20,${(alpha * 0.3).toFixed(2)})`));
      c.drawCircle(x0, y0, size * 0.025, paint);
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
PhoenixFeatherFlair.displayName = 'PhoenixFeatherFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
  canvas: { flex: 1 },
});
