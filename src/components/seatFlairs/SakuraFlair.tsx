/**
 * SakuraFlair — 樱花飘落
 *
 * 6 片樱花花瓣从上方飘落，左右轻摆，到底部渐隐后循环。
 * 每片花瓣用 5 个紧密圆点模拟椭圆形状。
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

export const SakuraFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        xFrac: 0.1 + (i * 0.8) / (N - 1),
        phase: i / N,
        swayAmp: 0.04 + (i % 3) * 0.02,
        swayFreq: 1.5 + (i % 2) * 0.5,
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
      const y = t * size;
      const x = s.xFrac * size + Math.sin(t * Math.PI * 2 * s.swayFreq) * size * s.swayAmp;
      const alpha = t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 0.7;
      const r = size * 0.015;
      // Draw petal as cluster of 5 overlapping circles
      const angle = t * Math.PI;
      const dx = Math.cos(angle) * r * 0.6;
      const dy = Math.sin(angle) * r * 0.6;
      paint.setColor(Skia.Color(`rgba(255,183,197,${alpha.toFixed(2)})`));
      c.drawCircle(x, y, r, paint);
      c.drawCircle(x + dx, y + dy, r * 0.8, paint);
      c.drawCircle(x - dx, y - dy, r * 0.8, paint);
      paint.setColor(Skia.Color(`rgba(255,210,220,${(alpha * 0.6).toFixed(2)})`));
      c.drawCircle(x + dy, y - dx, r * 0.6, paint);
      c.drawCircle(x - dy, y + dx, r * 0.6, paint);
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
SakuraFlair.displayName = 'SakuraFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
  canvas: { flex: 1 },
});
