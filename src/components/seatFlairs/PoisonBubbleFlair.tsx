/**
 * PoisonBubbleFlair — 剧毒气泡
 *
 * 8 颗绿色气泡从底部浮起，带高光反射点，到顶部消散。
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

export const PoisonBubbleFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        xFrac: 0.15 + (i * 0.7) / (N - 1),
        phase: i / N,
        rFrac: 0.02 + (i % 3) * 0.008,
        speed: 0.6 + (i % 4) * 0.1,
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

    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      const tt = (progress.value * s.speed + s.phase) % 1;
      const y = size * (1 - tt * 0.9) - size * 0.05;
      const x = s.xFrac * size + Math.sin(tt * Math.PI * 2) * size * 0.03;
      const alpha = tt < 0.1 ? tt / 0.1 : tt > 0.85 ? (1 - tt) / 0.15 : 0.6;
      const r = s.rFrac * size * (1 + tt * 0.3);

      // Bubble outline
      paint.setStrokeWidth(1);
      paint.setColor(Skia.Color(`rgba(80,220,80,${(alpha * 0.7).toFixed(2)})`));
      // Draw circle outline as multiple segments
      const segs = 16;
      for (let seg = 0; seg < segs; seg++) {
        const a0 = (seg / segs) * Math.PI * 2;
        const a1 = ((seg + 1) / segs) * Math.PI * 2;
        c.drawLine(
          x + Math.cos(a0) * r,
          y + Math.sin(a0) * r,
          x + Math.cos(a1) * r,
          y + Math.sin(a1) * r,
          paint,
        );
      }

      // Highlight dot
      paint.setColor(Skia.Color(`rgba(150,255,150,${(alpha * 0.5).toFixed(2)})`));
      c.drawCircle(x - r * 0.3, y - r * 0.3, r * 0.25, paint);
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
PoisonBubbleFlair.displayName = 'PoisonBubbleFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
  canvas: { flex: 1 },
});
