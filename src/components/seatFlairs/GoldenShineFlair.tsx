/**
 * GoldenShineFlair — 金色闪耀
 *
 * 10 颗金色光点围绕头像随机绽放又消散，模拟 sparkle 效果。
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

const N = 10;

export const GoldenShineFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        angle: (i / N) * Math.PI * 2 + i * 0.3,
        dist: 0.32 + (i % 4) * 0.06,
        phase: i / N,
        rFrac: 0.012 + (i % 3) * 0.006,
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
    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      const t = (progress.value + s.phase) % 1;
      // Sparkle: sharp peak at t=0.3, rest faded
      const flash = Math.max(0, 1 - Math.abs(t - 0.3) * 5);
      if (flash < 0.01) continue;
      const d = s.dist * size * (0.9 + flash * 0.2);
      const x = cx + Math.cos(s.angle) * d;
      const y = cy + Math.sin(s.angle) * d;
      const r = s.rFrac * size * (0.5 + flash);
      paint.setColor(Skia.Color(`rgba(255,200,50,${(flash * 0.9).toFixed(2)})`));
      c.drawCircle(x, y, r, paint);
      // Dimmer outer glow
      paint.setColor(Skia.Color(`rgba(255,220,100,${(flash * 0.3).toFixed(2)})`));
      c.drawCircle(x, y, r * 2, paint);
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
GoldenShineFlair.displayName = 'GoldenShineFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
  canvas: { flex: 1 },
});
