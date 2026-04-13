/**
 * IceCrystalFlair — 冰晶棱镜
 *
 * 6 颗旋转六边形冰晶分布在外围，脉冲闪烁，细线连接中心。
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
const HEX_SIDES = 6;

export const IceCrystalFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1);
  }, [progress]);

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
    const dist = size * 0.32;
    const hexR = size * 0.04;
    const t = progress.value;

    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 2 + t * Math.PI * 0.5;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      const pulse = 0.3 + 0.7 * Math.abs(Math.sin((t * 3 + i * 0.5) * Math.PI));

      // Draw hexagon edges
      paint.setStrokeWidth(1.2);
      paint.setColor(Skia.Color(`rgba(150,220,255,${(pulse * 0.7).toFixed(2)})`));
      for (let h = 0; h < HEX_SIDES; h++) {
        const ha0 = (h / HEX_SIDES) * Math.PI * 2 - Math.PI / 2 + t * Math.PI;
        const ha1 = ((h + 1) / HEX_SIDES) * Math.PI * 2 - Math.PI / 2 + t * Math.PI;
        c.drawLine(
          x + Math.cos(ha0) * hexR,
          y + Math.sin(ha0) * hexR,
          x + Math.cos(ha1) * hexR,
          y + Math.sin(ha1) * hexR,
          paint,
        );
      }

      // Center dot
      paint.setColor(Skia.Color(`rgba(200,240,255,${(pulse * 0.8).toFixed(2)})`));
      c.drawCircle(x, y, size * 0.01, paint);

      // Connecting line to center (very faint)
      paint.setStrokeWidth(0.5);
      paint.setColor(Skia.Color(`rgba(150,220,255,${(pulse * 0.1).toFixed(2)})`));
      c.drawLine(cx, cy, x, y, paint);
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
IceCrystalFlair.displayName = 'IceCrystalFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
  canvas: { flex: 1 },
});
