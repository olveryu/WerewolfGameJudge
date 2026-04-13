/**
 * ButterflyFlair — 蝶影翩翩
 *
 * 4 只蝴蝶在外围环绕飞舞，翅膀扇动（双椭圆模拟），带身体线条。
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

const N = 4;
const COLORS = [
  [180, 100, 220],
  [200, 120, 240],
  [160, 80, 200],
  [220, 140, 255],
] as const;

export const ButterflyFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        phase: i / N,
        orbit: 0.28 + (i % 2) * 0.08,
        speed: 0.6 + i * 0.1,
      })),
    [],
  );

  const recorder = useMemo(() => Skia.PictureRecorder(), []);
  const paint = useMemo(() => Skia.Paint(), []);

  const picture = useDerivedValue(() => {
    'worklet';
    const c = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));
    const cx = size / 2;
    const cy = size / 2;
    const t = progress.value;

    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      const angle = (t * s.speed + s.phase) * Math.PI * 2;
      const dist = s.orbit * size + Math.sin(t * Math.PI * 4) * size * 0.03;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      const wingFlap = Math.abs(Math.sin(t * Math.PI * 8 + s.phase * 10));
      const wingR = size * 0.02 * (0.3 + 0.7 * wingFlap);
      const alpha = 0.4 + 0.4 * wingFlap;
      const [cr, cg, cb] = COLORS[i];
      const bodyAngle = angle + Math.PI / 2;

      // Wings (circles offset along body angle)
      const wdx = Math.cos(bodyAngle) * wingR * 0.5;
      const wdy = Math.sin(bodyAngle) * wingR * 0.5;
      paint.setColor(Skia.Color(`rgba(${cr},${cg},${cb},${alpha.toFixed(2)})`));
      c.drawCircle(x - wdx, y - wdy, wingR, paint);
      c.drawCircle(x + wdx, y + wdy, wingR, paint);

      // Body dot
      paint.setColor(
        Skia.Color(`rgba(${cr - 40},${cg - 40},${cb - 40},${(alpha + 0.2).toFixed(2)})`),
      );
      c.drawCircle(x, y, size * 0.005, paint);
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
ButterflyFlair.displayName = 'ButterflyFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
  canvas: { flex: 1 },
});
