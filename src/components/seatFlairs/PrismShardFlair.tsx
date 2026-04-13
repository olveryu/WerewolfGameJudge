/**
 * PrismShardFlair — 棱镜碎片
 *
 * 6 块彩色三角碎片在外围旋转漂浮，颜色随时间偏移，带顶部高光点。
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
// HSL hue values for each shard – spread across rainbow
const HUES = [0, 60, 120, 180, 240, 300] as const;

export const PrismShardFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 7000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        angle0: (i / N) * Math.PI * 2 + i * 0.5,
        dist: 0.36 + (i % 3) * 0.05,
        phase: i / N,
        rotSpeed: 1.5 + (i % 3) * 0.5,
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
    const cx = size / 2;
    const cy = size / 2;
    const t = progress.value;
    const shardR = size * 0.028;

    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      const angle = s.angle0 + Math.sin((t + s.phase) * Math.PI * 1.2) * 0.5;
      const dist = s.dist * size + Math.cos(t * Math.PI * 2 + s.phase * 4) * size * 0.03;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      const pulse = 0.35 + 0.65 * Math.abs(Math.sin((t * 2 + s.phase * 5) * Math.PI));
      const rot = t * Math.PI * s.rotSpeed;

      // Triangle shard vertices
      const p0x = x + Math.cos(rot - Math.PI / 2) * shardR;
      const p0y = y + Math.sin(rot - Math.PI / 2) * shardR;
      const p1x = x + Math.cos(rot + Math.PI * 0.3) * shardR * 0.7;
      const p1y = y + Math.sin(rot + Math.PI * 0.3) * shardR * 0.7;
      const p2x = x + Math.cos(rot + Math.PI * 1.2) * shardR * 0.7;
      const p2y = y + Math.sin(rot + Math.PI * 1.2) * shardR * 0.7;

      // Fill triangles via 3 line segments (filled look with multiple layers)
      const hue = HUES[i] + t * 60;
      // Approximate a filled triangle as converging circles
      paint.setColor(
        Skia.Color(
          `rgba(${128 + Math.round(Math.cos((hue * Math.PI) / 180) * 80)},${128 + Math.round(Math.cos(((hue - 120) * Math.PI) / 180) * 80)},${128 + Math.round(Math.cos(((hue - 240) * Math.PI) / 180) * 80)},${(pulse * 0.4).toFixed(2)})`,
        ),
      );
      c.drawCircle(x, y, shardR * 0.5, paint);

      // Triangle outline
      paint.setStrokeWidth(0.8);
      paint.setColor(
        Skia.Color(
          `rgba(${160 + Math.round(Math.cos((hue * Math.PI) / 180) * 60)},${160 + Math.round(Math.cos(((hue - 120) * Math.PI) / 180) * 60)},${160 + Math.round(Math.cos(((hue - 240) * Math.PI) / 180) * 60)},${(pulse * 0.7).toFixed(2)})`,
        ),
      );
      c.drawLine(p0x, p0y, p1x, p1y, paint);
      c.drawLine(p1x, p1y, p2x, p2y, paint);
      c.drawLine(p2x, p2y, p0x, p0y, paint);

      // Sparkle at top vertex
      paint.setColor(Skia.Color(`rgba(240,240,255,${(pulse * 0.6).toFixed(2)})`));
      c.drawCircle(p0x, p0y, size * 0.006, paint);
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
PrismShardFlair.displayName = 'PrismShardFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
  canvas: { flex: 1 },
});
