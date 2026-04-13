/**
 * SonicWaveFlair — 音波震荡
 *
 * 5 道青绿色声波环从中心向外脉冲扩散，带频率调制抖动。
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

const WAVE_COUNT = 5;
const SEGS = 48;

export const SonicWaveFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1);
  }, [progress]);

  const recorder = useMemo(() => Skia.PictureRecorder(), []);
  const paint = useMemo(() => {
    const p = Skia.Paint();
    p.setStyle(1); // Stroke
    return p;
  }, []);

  const picture = useDerivedValue(() => {
    'worklet';
    const c = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));
    const cx = size / 2;
    const cy = size / 2;
    const t = progress.value;

    for (let i = 0; i < WAVE_COUNT; i++) {
      const wt = (t * 1.2 + i / WAVE_COUNT) % 1;
      const radius = size * 0.12 + wt * size * 0.36;
      const alpha = (1 - wt) * 0.55;

      paint.setStrokeWidth(1.5 * (1 - wt * 0.5));
      paint.setColor(Skia.Color(`rgba(80,200,180,${alpha.toFixed(2)})`));

      // Draw wobbled ring as line segments
      for (let s = 0; s < SEGS; s++) {
        const a0 = (s / SEGS) * Math.PI * 2;
        const a1 = ((s + 1) / SEGS) * Math.PI * 2;
        const w0 = 1 + 0.06 * Math.sin(a0 * 8 + t * Math.PI * 12 + i * 2);
        const w1 = 1 + 0.06 * Math.sin(a1 * 8 + t * Math.PI * 12 + i * 2);
        c.drawLine(
          cx + Math.cos(a0) * radius * w0,
          cy + Math.sin(a0) * radius * w0,
          cx + Math.cos(a1) * radius * w1,
          cy + Math.sin(a1) * radius * w1,
          paint,
        );
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
SonicWaveFlair.displayName = 'SonicWaveFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
  canvas: { flex: 1 },
});
