/**
 * OceanWaveFlair — ocean wave swell (Skia Canvas + Picture)
 *
 * 3 horizontal sine waves surge upward from the bottom with different phases/amplitudes, with crest spray particles.
 * All drawn imperatively on the UI thread via useDerivedValue + Picture.
 */
import { Picture, Skia } from '@shopify/react-native-skia';
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
import { ResilientCanvas } from './ResilientCanvas';

const WAVE_COUNT = 3;
const STEPS = 8;

// ── Pre-allocated Skia resources ──
const recorder = Skia.PictureRecorder();
const paint = Skia.Paint();
const path = Skia.Path.Make();

const WAVE_COLOR = Skia.Color('rgb(60,140,200)');
const CREST_COLOR = Skia.Color('rgb(180,220,255)');
const SPRAY_COLOR = Skia.Color('rgb(220,240,255)');

// Pre-computed seeds
const SEEDS = Array.from({ length: WAVE_COUNT }, (_, i) => ({
  yBase: 0.75 + i * 0.08,
  amplitude: 0.03 + i * 0.01,
  phase: i / WAVE_COUNT,
  freq: 2 + i,
}));

export const OceanWaveFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1);
  }, [progress]);

  const canvasStyle = useMemo(() => ({ width: size, height: size }), [size]);

  const flairPicture = useDerivedValue(() => {
    'worklet';
    const t = progress.value;
    const c = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));

    for (let w = 0; w < WAVE_COUNT; w++) {
      const seed = SEEDS[w]!;
      const tw = (t + seed.phase) % 1;
      const yOff = seed.yBase * size - tw * size * 0.05;
      const alpha = 0.15 + Math.sin(tw * Math.PI * 2) * 0.05;

      // Wave path
      path.reset();
      path.moveTo(0, yOff);
      for (let s = 1; s <= STEPS; s++) {
        const x = (s / STEPS) * size;
        const y =
          yOff +
          Math.sin((s / STEPS) * Math.PI * seed.freq + tw * Math.PI * 4) * seed.amplitude * size;
        path.lineTo(x, y);
      }
      paint.setColor(WAVE_COLOR);
      paint.setAlphaf(alpha);
      paint.setStyle(1);
      paint.setStrokeWidth(size * 0.015);
      paint.setStrokeCap(1);
      c.drawPath(path, paint);

      // Crest
      const peakX = size * (0.3 + tw * 0.4);
      const peakY = yOff - seed.amplitude * size;
      const crestAlpha = Math.max(0, Math.sin(tw * Math.PI * 4) * 0.4);
      paint.setColor(CREST_COLOR);
      paint.setAlphaf(crestAlpha);
      paint.setStyle(0);
      c.drawCircle(peakX, peakY, size * 0.012, paint);

      // Spray
      const sprayX = peakX + size * 0.03;
      const sprayY = peakY - size * 0.02;
      const sprayAlpha = Math.max(0, Math.sin(tw * Math.PI * 4) * 0.25);
      paint.setColor(SPRAY_COLOR);
      paint.setAlphaf(sprayAlpha);
      c.drawCircle(sprayX, sprayY, size * 0.006, paint);
    }

    paint.setAlphaf(1);
    paint.setStyle(0);
    paint.setStrokeWidth(0);
    return recorder.finishRecordingAsPicture();
  });

  return (
    <View style={[styles.wrapper, canvasStyle]}>
      <ResilientCanvas style={canvasStyle}>
        <Picture picture={flairPicture} />
      </ResilientCanvas>
    </View>
  );
});
OceanWaveFlair.displayName = 'OceanWaveFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
