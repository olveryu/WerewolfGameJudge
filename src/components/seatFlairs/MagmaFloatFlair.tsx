/**
 * MagmaFloatFlair — 熔岩浮石
 *
 * 6 块不规则熔岩球在外围浮动，由重叠圆组成，带底部热辉光。
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

const N = 6;

export const MagmaFloatFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        angle0: (i / N) * Math.PI * 2 + i * 0.4,
        dist: 0.35 + (i % 3) * 0.06,
        phase: i / N,
        rFrac: 0.018 + (i % 3) * 0.007,
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
      const tt = (t + s.phase) % 1;
      const angle = s.angle0 + Math.sin(tt * Math.PI * 2) * 0.3;
      const dist = s.dist * size + Math.sin(tt * Math.PI * 4) * size * 0.03;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      const pulse = 0.4 + 0.6 * Math.abs(Math.sin((t * 3 + s.phase * 5) * Math.PI));
      const r = s.rFrac * size;

      // Main rock body
      paint.setColor(Skia.Color(`rgba(200,60,20,${(pulse * 0.6).toFixed(2)})`));
      c.drawCircle(x, y, r, paint);

      // Secondary lobe
      paint.setColor(Skia.Color(`rgba(240,120,20,${(pulse * 0.5).toFixed(2)})`));
      c.drawCircle(x + r * 0.4, y - r * 0.3, r * 0.7, paint);

      // Hot glow underneath
      paint.setColor(Skia.Color(`rgba(255,80,0,${(pulse * 0.12).toFixed(2)})`));
      c.drawCircle(x, y + r * 0.5, r * 1.3, paint);
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
MagmaFloatFlair.displayName = 'MagmaFloatFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
  canvas: { flex: 1 },
});
