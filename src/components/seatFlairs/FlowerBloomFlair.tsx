/**
 * FlowerBloomFlair — 繁花盛开
 *
 * 5 朵小花在外围交替绽放，每朵 5 片花瓣（圆点簇）+ 花心。
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

const FLOWER_COUNT = 5;
const PETALS = 5;
const COLORS = [
  [255, 130, 160],
  [255, 150, 180],
  [240, 120, 170],
  [255, 160, 140],
  [250, 140, 190],
] as const;

export const FlowerBloomFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1);
  }, [progress]);

  const recorder = useMemo(() => Skia.PictureRecorder(), []);
  const paint = useMemo(() => Skia.Paint(), []);

  const picture = useDerivedValue(() => {
    'worklet';
    const c = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));
    const cx = size / 2;
    const cy = size / 2;
    const dist = size * 0.32;
    const t = progress.value;

    for (let f = 0; f < FLOWER_COUNT; f++) {
      const baseAngle = (f / FLOWER_COUNT) * Math.PI * 2;
      const fx = cx + Math.cos(baseAngle + t * Math.PI * 0.5) * dist;
      const fy = cy + Math.sin(baseAngle + t * Math.PI * 0.5) * dist;
      const bloom = 0.3 + 0.7 * Math.abs(Math.sin((t * 2 + f * 0.8) * Math.PI));
      const petalR = size * 0.015 * bloom;
      const [cr, cg, cb] = COLORS[f];

      // Petals
      for (let p = 0; p < PETALS; p++) {
        const pa = (p / PETALS) * Math.PI * 2 + t * Math.PI;
        const px = fx + Math.cos(pa) * petalR * 1.2;
        const py = fy + Math.sin(pa) * petalR * 1.2;
        paint.setColor(Skia.Color(`rgba(${cr},${cg},${cb},${(bloom * 0.5).toFixed(2)})`));
        c.drawCircle(px, py, petalR * 0.7, paint);
      }

      // Flower center
      paint.setColor(Skia.Color(`rgba(255,230,150,${(bloom * 0.8).toFixed(2)})`));
      c.drawCircle(fx, fy, petalR * 0.4, paint);
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
FlowerBloomFlair.displayName = 'FlowerBloomFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
  canvas: { flex: 1 },
});
