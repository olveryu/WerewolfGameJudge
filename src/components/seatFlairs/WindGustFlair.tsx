/**
 * WindGustFlair — 疾风粒子
 *
 * 8 条短水平划线从左吹向右，跳过中心区域，带头部光点。
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

export const WindGustFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        yFrac: 0.1 + (i / N) * 0.8,
        phase: i / N,
        speed: 1.2 + (i % 3) * 0.3,
        rFrac: 0.008 + (i % 4) * 0.003,
      })),
    [],
  );

  const recorder = useMemo(() => Skia.PictureRecorder(), []);
  const paint = useMemo(() => {
    const p = Skia.Paint();
    p.setStrokeWidth(1);
    return p;
  }, []);

  const picture = useDerivedValue(() => {
    'worklet';
    const c = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));
    const cx = size / 2;
    const cy = size / 2;
    const safe = size * 0.22;

    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      const tt = (progress.value * s.speed + s.phase) % 1;
      const x = tt * size;
      const baseY = s.yFrac * size;
      const y = baseY + Math.sin(tt * Math.PI * 3) * size * 0.04;

      // Skip particles too close to center
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy < safe * safe) continue;

      const alpha = tt < 0.1 ? tt / 0.1 : tt > 0.85 ? (1 - tt) / 0.15 : 0.5;
      const streakLen = size * 0.04;

      // Streak line
      paint.setStrokeWidth(s.rFrac * size * 2);
      paint.setColor(Skia.Color(`rgba(180,230,200,${(alpha * 0.7).toFixed(2)})`));
      c.drawLine(x, y, x - streakLen, y + 0.5, paint);

      // Head dot
      paint.setColor(Skia.Color(`rgba(200,245,220,${(alpha * 0.6).toFixed(2)})`));
      c.drawCircle(x, y, s.rFrac * size, paint);
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
WindGustFlair.displayName = 'WindGustFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
  canvas: { flex: 1 },
});
