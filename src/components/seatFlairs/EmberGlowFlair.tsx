/**
 * EmberGlowFlair — 余烬微光
 *
 * 6 颗橙色/琥珀色小圆点从底部缓慢上升，随高度渐灭后重置。
 * Skia Immediate Mode：PictureRecorder worklet 每帧绘制。
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

const PARTICLE_COUNT = 6;
const COLORS = [
  [255, 140, 0],
  [255, 180, 50],
  [255, 100, 20],
  [255, 160, 30],
  [255, 200, 80],
  [255, 120, 10],
] as const;

export const EmberGlowFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        xFrac: 0.15 + (i * 0.7) / (PARTICLE_COUNT - 1),
        phase: i / PARTICLE_COUNT,
        rFrac: 0.02 + (i % 3) * 0.008,
        ci: i % COLORS.length,
      })),
    [],
  );

  const recorder = useMemo(() => Skia.PictureRecorder(), []);
  const paint = useMemo(() => Skia.Paint(), []);

  const picture = useDerivedValue(() => {
    'worklet';
    const c = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const s = seeds[i];
      const t = (progress.value + s.phase) % 1;
      const y = size * (1 - t);
      const x = s.xFrac * size + Math.sin(t * Math.PI * 2) * size * 0.04;
      const r = s.rFrac * size;
      const alpha = t < 0.15 ? t / 0.15 : t > 0.7 ? (1 - t) / 0.3 : 1;
      const [cr, cg, cb] = COLORS[s.ci];
      paint.setColor(Skia.Color(`rgba(${cr},${cg},${cb},${(alpha * 0.8).toFixed(2)})`));
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
EmberGlowFlair.displayName = 'EmberGlowFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
  canvas: { flex: 1 },
});
