/**
 * LunarHaloFlair — 月华光环
 *
 * 3 条新月弧光带绕头像旋转，端点带辉光球，底层柔和月光辐射。
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

const ARC_COUNT = 3;

export const LunarHaloFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1);
  }, [progress]);

  const recorder = useMemo(() => Skia.PictureRecorder(), []);
  const paint = useMemo(() => {
    const p = Skia.Paint();
    p.setStrokeWidth(2.5);
    return p;
  }, []);

  const picture = useDerivedValue(() => {
    'worklet';
    const c = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));
    const cx = size / 2;
    const cy = size / 2;
    const orbit = size * 0.42;
    const t = progress.value;

    for (let i = 0; i < ARC_COUNT; i++) {
      const angle = t * Math.PI * 2 + i * ((Math.PI * 2) / ARC_COUNT);
      const pulse = 0.4 + 0.6 * Math.sin((t * 4 + i) * Math.PI);
      const r = orbit - i * size * 0.02;
      const arcSpan = Math.PI * 0.6;

      // Draw arc as line segments (Skia drawArc alternative)
      const segs = 16;
      paint.setStrokeWidth(3 - i * 0.5);
      paint.setColor(Skia.Color(`rgba(180,200,255,${(pulse * 0.5).toFixed(2)})`));
      for (let s = 0; s < segs; s++) {
        const a0 = angle + (s / segs) * arcSpan;
        const a1 = angle + ((s + 1) / segs) * arcSpan;
        const x0 = cx + Math.cos(a0) * r;
        const y0 = cy + Math.sin(a0) * r;
        const x1 = cx + Math.cos(a1) * r;
        const y1 = cy + Math.sin(a1) * r;
        c.drawLine(x0, y0, x1, y1, paint);
      }

      // Glow dot at arc endpoint
      const ex = cx + Math.cos(angle + arcSpan) * r;
      const ey = cy + Math.sin(angle + arcSpan) * r;
      paint.setColor(Skia.Color(`rgba(200,220,255,${(pulse * 0.7).toFixed(2)})`));
      c.drawCircle(ex, ey, size * 0.02, paint);
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
LunarHaloFlair.displayName = 'LunarHaloFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
  canvas: { flex: 1 },
});
