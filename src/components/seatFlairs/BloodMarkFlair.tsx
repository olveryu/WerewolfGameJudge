/**
 * BloodMarkFlair — 血月印记
 *
 * 4 颗暗红血滴从顶部滑落，拉长尾迹，到底部消散后循环。
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

export const BloodMarkFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 3500, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        xFrac: 0.2 + (i * 0.6) / (N - 1),
        phase: i / N,
        rFrac: 0.018 + (i % 2) * 0.006,
      })),
    [],
  );

  const recorder = useMemo(() => Skia.PictureRecorder(), []);
  const paint = useMemo(() => Skia.Paint(), []);

  const picture = useDerivedValue(() => {
    'worklet';
    const c = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));
    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      const t = (progress.value + s.phase) % 1;
      const x = s.xFrac * size;
      const y = t * size;
      const r = s.rFrac * size;
      const alpha = t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 0.85;
      // Main drop
      paint.setColor(Skia.Color(`rgba(180,20,20,${alpha.toFixed(2)})`));
      c.drawCircle(x, y, r, paint);
      // Trailing smear above the drop
      const trailLen = 3;
      for (let j = 1; j <= trailLen; j++) {
        const ty = y - j * r * 1.5;
        const ta = alpha * (1 - j / (trailLen + 1)) * 0.6;
        const tr = r * (1 - j * 0.15);
        paint.setColor(Skia.Color(`rgba(140,10,10,${ta.toFixed(2)})`));
        c.drawCircle(x, ty, tr, paint);
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
BloodMarkFlair.displayName = 'BloodMarkFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
  canvas: { flex: 1 },
});
