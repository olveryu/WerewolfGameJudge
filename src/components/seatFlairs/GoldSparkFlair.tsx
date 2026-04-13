/**
 * GoldSparkFlair — 金星四溅
 *
 * 8 颗四芒星从外围爆发散出后消散，带十字光芒。
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

export const GoldSparkFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 3500, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        angle: (i / N) * Math.PI * 2 + i * 0.7,
        dist: 0.35 + (i % 4) * 0.04,
        phase: i / N,
        burst: 0.3 + (i % 3) * 0.1,
      })),
    [],
  );

  const recorder = useMemo(() => Skia.PictureRecorder(), []);
  const paint = useMemo(() => {
    const p = Skia.Paint();
    p.setStrokeWidth(1.2);
    return p;
  }, []);

  const picture = useDerivedValue(() => {
    'worklet';
    const c = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));
    const cx = size / 2;
    const cy = size / 2;
    const t = progress.value;

    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      const tt = (t * 1.5 + s.phase) % 1;
      const burstDist = s.dist * size + tt * size * s.burst;
      const angle = s.angle + Math.sin(t * Math.PI * 2) * 0.2;
      const x = cx + Math.cos(angle) * burstDist;
      const y = cy + Math.sin(angle) * burstDist;

      // Stay outside center
      if (burstDist < size * 0.25) continue;

      const alpha = tt < 0.1 ? tt / 0.1 : (1 - tt) * 0.8;
      const armLen = size * 0.02 * (1 - tt * 0.5);

      // 4-point sparkle (cross)
      paint.setStrokeWidth(1.2);
      paint.setColor(Skia.Color(`rgba(255,210,60,${(alpha * 0.8).toFixed(2)})`));
      c.drawLine(x - armLen, y, x + armLen, y, paint);
      c.drawLine(x, y - armLen, x, y + armLen, paint);

      // Center dot
      paint.setColor(Skia.Color(`rgba(255,240,150,${(alpha * 0.9).toFixed(2)})`));
      c.drawCircle(x, y, size * 0.01, paint);
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
GoldSparkFlair.displayName = 'GoldSparkFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
  canvas: { flex: 1 },
});
