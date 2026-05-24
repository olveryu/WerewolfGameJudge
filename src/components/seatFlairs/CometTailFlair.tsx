/**
 * CometTailFlair — 彗星拖尾 (Skia Canvas + Picture)
 *
 * 3 颗彗星在外围环绕，每颗带 8 节渐隐拖尾。
 * 全部通过 useDerivedValue + Picture 在 UI 线程 imperative 绘制。
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
import { StaticCanvas, useFlairStatic } from './FlairStaticContext';

const COMET_COUNT = 3;
const TRAIL_LEN = 8;

// ── Pre-allocated Skia resources ──
const recorder = Skia.PictureRecorder();
const paint = Skia.Paint();

const TRAIL_COLOR = Skia.Color('rgb(180,200,255)');
const HEAD_GLOW_COLOR = Skia.Color('rgb(220,235,255)');
const AURA_BASE = Skia.Color('rgb(160,190,255)');
const AURA_R = 160;
const AURA_G = 190;
const AURA_B = 255;

// Pre-computed comet seeds
const SEEDS = Array.from({ length: COMET_COUNT }, (_, i) => ({
  angle0: (i / COMET_COUNT) * Math.PI * 2,
  phase: i / COMET_COUNT,
  speed: 0.5 + i * 0.15,
}));

export const CometTailFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const isStatic = useFlairStatic();
  const progress = useSharedValue(0);
  const slowProgress = useSharedValue(0);

  useEffect(() => {
    if (isStatic) return;
    progress.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1);
    slowProgress.value = withRepeat(withTiming(1, { duration: 7000, easing: Easing.linear }), -1);
  }, [progress, slowProgress, isStatic]);

  const canvasStyle = useMemo(() => ({ width: size, height: size }), [size]);

  const flairPicture = useDerivedValue(() => {
    'worklet';
    const t = progress.value;
    const st = slowProgress.value;
    const cx = size / 2;
    const cy = size / 2;
    const orbit = size * 0.4;
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
    c.drawCircle(cx, cy, size * 0.4, paint);
    paint.setStyle(0);
    paint.setStrokeWidth(0);

    // ── Comets ──
    for (let i = 0; i < COMET_COUNT; i++) {
      const seed = SEEDS[i]!;
      const angle = seed.angle0 + t * seed.speed * Math.PI * 2;
      const pulse = 0.5 + 0.5 * Math.sin((t * 4 + seed.phase * 6) * Math.PI);

      // Trail dots
      paint.setColor(TRAIL_COLOR);
      for (let j = TRAIL_LEN; j >= 0; j--) {
        const ta = angle - j * 0.12;
        const td = orbit + j * 1;
        const tx = cx + Math.cos(ta) * td;
        const ty = cy + Math.sin(ta) * td;
        const r = j === 0 ? size * 0.02 : Math.max(size * 0.004, size * 0.018 - j * size * 0.002);
        const alpha = j === 0 ? pulse * 0.85 : Math.max(0, pulse * (0.5 - j * 0.05));
        paint.setAlphaf(alpha);
        c.drawCircle(tx, ty, r, paint);
      }

      // Head glow
      const headX = cx + Math.cos(angle) * orbit;
      const headY = cy + Math.sin(angle) * orbit;
      paint.setColor(HEAD_GLOW_COLOR);
      paint.setAlphaf(pulse * 0.3);
      c.drawCircle(headX, headY, size * 0.03, paint);
    }

    paint.setAlphaf(1);
    return recorder.finishRecordingAsPicture();
  });

  return (
    <View style={[styles.wrapper, canvasStyle]}>
      <StaticCanvas style={canvasStyle}>
        <Picture picture={flairPicture} />
      </StaticCanvas>
    </View>
  );
});
CometTailFlair.displayName = 'CometTailFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
