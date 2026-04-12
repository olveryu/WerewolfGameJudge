/**
 * FrostAuraFlair — 寒霜气场
 *
 * 8 颗冰蓝色雪花粒子围绕头像缓慢飘浮，大小和 opacity 随机脉动。
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

export const FrostAuraFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        angle0: (i / N) * Math.PI * 2,
        orbitFrac: 0.42 + (i % 3) * 0.05,
        rFrac: 0.015 + (i % 4) * 0.005,
        speed: 0.8 + (i % 3) * 0.2,
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
      const angle = s.angle0 + progress.value * Math.PI * 2 * s.speed;
      const orbit = s.orbitFrac * size;
      const x = cx + Math.cos(angle) * orbit;
      const y = cy + Math.sin(angle) * orbit;
      const pulse = 0.5 + 0.5 * Math.sin(progress.value * Math.PI * 4 + i);
      const alpha = 0.3 + pulse * 0.4;
      const r = s.rFrac * size * (0.8 + pulse * 0.4);
      paint.setColor(Skia.Color(`rgba(140,220,255,${alpha.toFixed(2)})`));
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
FrostAuraFlair.displayName = 'FrostAuraFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
  canvas: { flex: 1 },
});
