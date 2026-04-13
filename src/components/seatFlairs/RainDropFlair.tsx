/**
 * RainDropFlair — 细雨绵绵
 *
 * 12 道斜向雨滴落下，带尾迹线条，底部溅起小水花圈。
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

const N = 12;

export const RainDropFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        xFrac: 0.05 + (i * 0.9) / (N - 1),
        phase: i / N,
        lenFrac: 0.03 + (i % 3) * 0.015,
        speed: 0.7 + (i % 4) * 0.1,
      })),
    [],
  );

  const recorder = useMemo(() => Skia.PictureRecorder(), []);
  const paint = useMemo(() => {
    const p = Skia.Paint();
    p.setStrokeWidth(0.8);
    return p;
  }, []);

  const picture = useDerivedValue(() => {
    'worklet';
    const c = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));
    const t = progress.value;

    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      const tt = (t * s.speed + s.phase) % 1;
      const y = tt * size * 1.1 - size * 0.05;
      const x = s.xFrac * size + tt * size * 0.08;
      const alpha = tt < 0.05 ? tt / 0.05 : tt > 0.9 ? (1 - tt) / 0.1 : 0.5;
      const len = s.lenFrac * size;

      // Rain streak
      paint.setStrokeWidth(0.8);
      paint.setColor(Skia.Color(`rgba(150,190,230,${(alpha * 0.7).toFixed(2)})`));
      c.drawLine(x, y, x - 1, y - len, paint);

      // Splash ring at bottom
      if (tt > 0.85) {
        const splash = (tt - 0.85) / 0.15;
        const splashAlpha = (1 - splash) * 0.4;
        const splashR = splash * size * 0.02;
        paint.setStrokeWidth(0.5);
        paint.setColor(Skia.Color(`rgba(150,190,230,${splashAlpha.toFixed(2)})`));
        // Draw splash as small circle segments
        const segs = 12;
        for (let seg = 0; seg < segs; seg++) {
          const a0 = (seg / segs) * Math.PI * 2;
          const a1 = ((seg + 1) / segs) * Math.PI * 2;
          c.drawLine(
            x + Math.cos(a0) * splashR,
            y + Math.sin(a0) * splashR,
            x + Math.cos(a1) * splashR,
            y + Math.sin(a1) * splashR,
            paint,
          );
        }
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
RainDropFlair.displayName = 'RainDropFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
  canvas: { flex: 1 },
});
