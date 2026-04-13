/**
 * SnowfallFlair — 纷飞白雪
 *
 * 10 片雪花从上方飘落，每片用 3 条交叉线绘制六角星形，缓慢旋转。
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

export const SnowfallFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        xFrac: 0.05 + (i * 0.9) / (N - 1),
        phase: i / N,
        rFrac: 0.008 + (i % 3) * 0.005,
        speed: 0.4 + (i % 4) * 0.1,
        sway: 0.02 + (i % 3) * 0.015,
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

    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      const tt = (progress.value * s.speed + s.phase) % 1;
      const y = tt * size;
      const x = s.xFrac * size + Math.sin(tt * Math.PI * 4) * size * s.sway;
      const alpha = tt < 0.05 ? tt / 0.05 : tt > 0.9 ? (1 - tt) / 0.1 : 0.7;
      const r = s.rFrac * size;

      // 3-line star (snowflake)
      paint.setStrokeWidth(0.8);
      paint.setColor(Skia.Color(`rgba(220,230,255,${(alpha * 0.8).toFixed(2)})`));
      for (let a = 0; a < 3; a++) {
        const ang = (a / 3) * Math.PI + tt * Math.PI;
        c.drawLine(
          x - Math.cos(ang) * r,
          y - Math.sin(ang) * r,
          x + Math.cos(ang) * r,
          y + Math.sin(ang) * r,
          paint,
        );
      }

      // Center dot
      paint.setColor(Skia.Color(`rgba(240,245,255,${(alpha * 0.9).toFixed(2)})`));
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
SnowfallFlair.displayName = 'SnowfallFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
  canvas: { flex: 1 },
});
