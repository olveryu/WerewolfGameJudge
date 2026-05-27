/**
 * ShadowClawFlair — Shadow Claw (Skia Canvas + Picture)
 *
 * 4 sets of three purple claw marks scratch inward from the four corners, with pulse animation and tip sparks.
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

// ── Pre-allocated Skia resources ──
const recorder = Skia.PictureRecorder();
const paint = Skia.Paint();

const SCRATCH_COLOR = Skia.Color('rgb(120,40,160)');
const SPARK_COLOR = Skia.Color('rgb(180,100,220)');
const AURA_BASE = Skia.Color('rgb(100,30,140)');
const AURA_R = 100;
const AURA_G = 30;
const AURA_B = 140;

// Claw origins: 4 corners pointing inward
const CLAWS = [
  { oxFrac: 0.05, oyFrac: 0.05, dx: 1, dy: 1 },
  { oxFrac: 0.95, oyFrac: 0.05, dx: -1, dy: 1 },
  { oxFrac: 0.05, oyFrac: 0.95, dx: 1, dy: -1 },
  { oxFrac: 0.95, oyFrac: 0.95, dx: -1, dy: -1 },
];

export const ShadowClawFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);
  const slowProgress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 3500, easing: Easing.linear }), -1);
    slowProgress.value = withRepeat(withTiming(1, { duration: 7000, easing: Easing.linear }), -1);
  }, [progress, slowProgress]);

  const canvasStyle = useMemo(() => ({ width: size, height: size }), [size]);

  const flairPicture = useDerivedValue(() => {
    'worklet';
    const t = progress.value;
    const st = slowProgress.value;
    const cx = size / 2;
    const cy = size / 2;
    const c = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));

    // ── LegendaryAura ──
    const breathe = 0.03 + 0.07 * (0.5 + 0.5 * Math.sin(st * Math.PI * 2));
    paint.setColor(AURA_BASE);
    paint.setAlphaf(breathe * 0.3);
    c.drawCircle(cx, cy, size * 0.4, paint);
    paint.setAlphaf(breathe * 0.6);
    c.drawCircle(cx, cy, size * 0.3, paint);
    paint.setAlphaf(breathe);
    c.drawCircle(cx, cy, size * 0.2, paint);

    // Orbit ring
    const ringBreath = 0.05 + 0.07 * (0.5 + 0.5 * Math.cos(st * Math.PI * 2 + 1));
    const shift = Math.sin(st * Math.PI * 2) * 20;
    const nr = Math.max(0, Math.min(255, Math.round(AURA_R + shift)));
    const nb = Math.max(0, Math.min(255, Math.round(AURA_B - shift)));
    paint.setColor(Skia.Color(`rgb(${nr},${AURA_G},${nb})`));
    paint.setAlphaf(ringBreath);
    paint.setStyle(1);
    paint.setStrokeWidth(size * 0.015);
    c.drawCircle(cx, cy, size * 0.35, paint);
    paint.setStyle(0);
    paint.setStrokeWidth(0);

    // ── Claw scratches ──
    paint.setStyle(1);
    paint.setStrokeCap(1); // Round
    for (let ci = 0; ci < 4; ci++) {
      const claw = CLAWS[ci]!;
      const ox = claw.oxFrac * size;
      const oy = claw.oyFrac * size;
      const pulse = 0.3 + 0.7 * Math.abs(Math.sin((t * 2 + ci * 0.8) * Math.PI));
      const len = size * 0.18 * pulse;

      // 3 scratch lines per claw (offset perpendicular)
      for (let s = 0; s < 3; s++) {
        const offset = (s - 1) * size * 0.03;
        const sx = ox + claw.dy * offset;
        const sy = oy + -claw.dx * offset;
        const ex = sx + claw.dx * len;
        const ey = sy + claw.dy * len;

        paint.setColor(SCRATCH_COLOR);
        paint.setAlphaf(pulse * (0.6 - s * 0.1));
        paint.setStrokeWidth(2 - s * 0.4);
        c.drawLine(sx, sy, ex, ey, paint);
      }

      // Spark at tip
      const tipX = ox + claw.dx * len;
      const tipY = oy + claw.dy * len;
      paint.setColor(SPARK_COLOR);
      paint.setAlphaf(pulse * 0.6);
      paint.setStyle(0);
      c.drawCircle(tipX, tipY, size * 0.012, paint);
      paint.setStyle(1);
    }

    paint.setStyle(0);
    paint.setAlphaf(1);
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
ShadowClawFlair.displayName = 'ShadowClawFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
