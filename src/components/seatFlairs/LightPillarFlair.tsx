/**
 * LightPillarFlair — 四柱天光
 *
 * 4 条金色光柱从四角向内延伸（不碰中心），带脉冲明暗。
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

const PILLAR_COUNT = 4;

export const LightPillarFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1);
  }, [progress]);

  const corners = useMemo(
    () => [
      { bx: size * 0.08, by: size, dir: -1 },
      { bx: size * 0.92, by: size, dir: -1 },
      { bx: size * 0.05, by: 0, dir: 1 },
      { bx: size * 0.95, by: 0, dir: 1 },
    ],
    [size],
  );

  const recorder = useMemo(() => Skia.PictureRecorder(), []);
  const paint = useMemo(() => {
    const p = Skia.Paint();
    p.setStrokeWidth(1.5);
    return p;
  }, []);

  const picture = useDerivedValue(() => {
    'worklet';
    const c = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));
    const t = progress.value;
    const w = size * 0.025;

    for (let i = 0; i < PILLAR_COUNT; i++) {
      const corner = corners[i];
      const pulse = 0.3 + 0.7 * Math.abs(Math.sin((t * 2.5 + i * 0.7) * Math.PI));
      const h = size * 0.35 * pulse;

      // Soft pillar glow (wide, dim)
      paint.setColor(Skia.Color(`rgba(255,230,130,${(pulse * 0.15).toFixed(2)})`));
      const steps = 8;
      for (let s = 0; s < steps; s++) {
        const frac = s / steps;
        const y = corner.by + corner.dir * h * frac;
        const alpha = (1 - frac) * pulse * 0.15;
        paint.setColor(Skia.Color(`rgba(255,230,130,${alpha.toFixed(2)})`));
        c.drawCircle(corner.bx, y, w, paint);
      }

      // Core line
      paint.setStrokeWidth(1.5);
      paint.setColor(Skia.Color(`rgba(255,240,180,${(pulse * 0.6).toFixed(2)})`));
      c.drawLine(corner.bx, corner.by, corner.bx, corner.by + corner.dir * h * 0.8, paint);

      // Base spark
      paint.setColor(Skia.Color(`rgba(255,245,200,${(pulse * 0.8).toFixed(2)})`));
      c.drawCircle(corner.bx, corner.by, size * 0.012, paint);
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
LightPillarFlair.displayName = 'LightPillarFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
  canvas: { flex: 1 },
});
