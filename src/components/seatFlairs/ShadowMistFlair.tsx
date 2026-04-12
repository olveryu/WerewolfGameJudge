/**
 * ShadowMistFlair — 暗影迷雾
 *
 * 5 团紫黑色烟雾从底部升起并扩散，opacity 渐灭。循环往复。
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

const N = 5;

export const ShadowMistFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        xFrac: 0.15 + (i * 0.7) / (N - 1),
        phase: i / N,
        maxR: 0.06 + (i % 3) * 0.02,
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
      // Rise from bottom to ~40% height, expanding radius
      const y = size * (1 - t * 0.6);
      const x = s.xFrac * size + Math.sin(t * Math.PI * 3) * size * 0.03;
      const r = s.maxR * size * (0.3 + t * 0.7);
      const alpha = t < 0.1 ? t / 0.1 : (1 - t) * 0.4;
      paint.setColor(Skia.Color(`rgba(42,16,64,${alpha.toFixed(2)})`));
      c.drawCircle(x, y, r, paint);
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
ShadowMistFlair.displayName = 'ShadowMistFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
  canvas: { flex: 1 },
});
