/**
 * PurpleMistFlair — 紫雾缭绕
 *
 * 7 团紫色雾气在外围漂浮，大小呼吸脉冲，多层渐变模拟柔焦。
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

export const PurpleMistFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        angle0: (i / N) * Math.PI * 2,
        dist: 0.35 + (i % 3) * 0.05,
        phase: i / N,
        driftSpeed: 0.3 + (i % 4) * 0.15,
        maxRFrac: 0.04 + (i % 3) * 0.02,
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
      const angle = s.angle0 + Math.sin((t * s.driftSpeed + s.phase) * Math.PI * 2) * 0.6;
      const dist = s.dist * size + Math.sin(t * Math.PI * 2 + s.phase * 5) * size * 0.04;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      const pulse = 0.3 + 0.5 * Math.abs(Math.sin((t * 2 + s.phase * 4) * Math.PI));
      const r = s.maxRFrac * size * (0.6 + 0.4 * pulse);

      // Multi-layer fog (outer → inner, increasing alpha)
      paint.setColor(Skia.Color(`rgba(80,30,160,${(pulse * 0.08).toFixed(2)})`));
      c.drawCircle(x, y, r, paint);
      paint.setColor(Skia.Color(`rgba(100,50,180,${(pulse * 0.15).toFixed(2)})`));
      c.drawCircle(x, y, r * 0.6, paint);
      paint.setColor(Skia.Color(`rgba(140,80,200,${(pulse * 0.25).toFixed(2)})`));
      c.drawCircle(x, y, r * 0.3, paint);
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
PurpleMistFlair.displayName = 'PurpleMistFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
  canvas: { flex: 1 },
});
