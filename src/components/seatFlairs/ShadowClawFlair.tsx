/**
 * ShadowClawFlair — 暗影之爪
 *
 * 4 组三道紫色爪痕从四角向内抓入，带脉冲动画和尖端火花。
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

const CLAW_COUNT = 4;
const SCRATCH_COUNT = 3;

export const ShadowClawFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 3500, easing: Easing.linear }), -1);
  }, [progress]);

  const claws = useMemo(
    () => [
      { ox: size * 0.05, oy: size * 0.05, dx: 1, dy: 1 },
      { ox: size * 0.95, oy: size * 0.05, dx: -1, dy: 1 },
      { ox: size * 0.05, oy: size * 0.95, dx: 1, dy: -1 },
      { ox: size * 0.95, oy: size * 0.95, dx: -1, dy: -1 },
    ],
    [size],
  );

  const recorder = useMemo(() => Skia.PictureRecorder(), []);
  const paint = useMemo(() => {
    const p = Skia.Paint();
    p.setStrokeWidth(2);
    return p;
  }, []);

  const picture = useDerivedValue(() => {
    'worklet';
    const c = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));
    const t = progress.value;

    for (let ci = 0; ci < CLAW_COUNT; ci++) {
      const claw = claws[ci];
      const pulse = 0.3 + 0.7 * Math.abs(Math.sin((t * 2 + ci * 0.8) * Math.PI));

      for (let s = 0; s < SCRATCH_COUNT; s++) {
        const offset = (s - 1) * size * 0.03;
        const len = size * 0.18 * pulse;
        const sx = claw.ox + (s === 1 ? 0 : claw.dy * offset);
        const sy = claw.oy + (s === 1 ? 0 : -claw.dx * offset);
        const ex = sx + claw.dx * len;
        const ey = sy + claw.dy * len;

        paint.setStrokeWidth(2 - s * 0.4);
        paint.setColor(Skia.Color(`rgba(120,40,160,${(pulse * (0.6 - s * 0.1)).toFixed(2)})`));
        c.drawLine(sx, sy, ex, ey, paint);
      }

      // Spark at tip
      const tipX = claw.ox + claw.dx * size * 0.18 * pulse;
      const tipY = claw.oy + claw.dy * size * 0.18 * pulse;
      paint.setColor(Skia.Color(`rgba(180,100,220,${(pulse * 0.6).toFixed(2)})`));
      c.drawCircle(tipX, tipY, size * 0.012, paint);
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
ShadowClawFlair.displayName = 'ShadowClawFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
  canvas: { flex: 1 },
});
