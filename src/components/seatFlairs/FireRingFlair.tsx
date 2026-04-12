/**
 * FireRingFlair — 烈焰之环
 *
 * 8 颗火焰粒子沿头像边缘环形运动，红→橙→黄渐变，带拖尾。
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
const TRAIL = 3;
const COLORS = [
  [220, 40, 0],
  [240, 120, 0],
  [255, 180, 30],
  [220, 60, 0],
  [240, 100, 10],
  [255, 160, 20],
  [200, 30, 0],
  [240, 140, 0],
] as const;

export const FireRingFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1);
  }, [progress]);

  const recorder = useMemo(() => Skia.PictureRecorder(), []);
  const paint = useMemo(() => Skia.Paint(), []);

  const picture = useDerivedValue(() => {
    'worklet';
    const c = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));
    const cx = size / 2;
    const cy = size / 2;
    const orbit = size * 0.42;
    const r = size * 0.02;

    for (let i = 0; i < N; i++) {
      const baseAngle = (i / N) * Math.PI * 2 + progress.value * Math.PI * 2;
      const [cr, cg, cb] = COLORS[i % COLORS.length];
      // Trail dots (behind main particle)
      for (let t = TRAIL; t >= 0; t--) {
        const trailAngle = baseAngle - t * 0.08;
        const x = cx + Math.cos(trailAngle) * orbit;
        const y = cy + Math.sin(trailAngle) * orbit;
        const alphaScale = t === 0 ? 1 : (1 - t / (TRAIL + 1)) * 0.5;
        const rScale = t === 0 ? 1 : 1 - t * 0.2;
        paint.setColor(Skia.Color(`rgba(${cr},${cg},${cb},${(alphaScale * 0.75).toFixed(2)})`));
        c.drawCircle(x, y, r * rScale, paint);
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
FireRingFlair.displayName = 'FireRingFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
  canvas: { flex: 1 },
});
