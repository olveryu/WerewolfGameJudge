/**
 * FireRingFlair — 烈焰之环 (Skia Canvas + Picture)
 *
 * 8 颗火焰粒子沿头像边缘环形运动，红→橙→黄渐变，带拖尾。
 * 背景层：LegendaryAura 多层辉光 + 色温偏移轨道环。
 * 全部通过 useDerivedValue + Picture 在 UI 线程 imperative 绘制，
 * 单一 Canvas 节点替代原先 34 个 SVG AnimatedCircle。
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

const N = 8;
const TRAIL = 3;

// ── Pre-allocated Skia resources ──
const recorder = Skia.PictureRecorder();
const paint = Skia.Paint();

// Pre-convert particle colors to SkColor (avoids string construction per frame)
const SKIA_COLORS = [
  Skia.Color('rgb(220,40,0)'),
  Skia.Color('rgb(240,120,0)'),
  Skia.Color('rgb(255,180,30)'),
  Skia.Color('rgb(220,60,0)'),
  Skia.Color('rgb(240,100,10)'),
  Skia.Color('rgb(255,160,20)'),
  Skia.Color('rgb(200,30,0)'),
  Skia.Color('rgb(240,140,0)'),
];

// LegendaryAura constants
const AURA_BASE = Skia.Color('rgb(240,80,0)');
const AURA_R = 240;
const AURA_G = 80;
const AURA_B = 0;

export const FireRingFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const isStatic = useFlairStatic();
  const progress = useSharedValue(0);
  const slowProgress = useSharedValue(0);

  useEffect(() => {
    if (isStatic) return;
    progress.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1);
    slowProgress.value = withRepeat(withTiming(1, { duration: 7000, easing: Easing.linear }), -1);
  }, [progress, slowProgress, isStatic]);

  const canvasStyle = useMemo(() => ({ width: size, height: size }), [size]);

  const flairPicture = useDerivedValue(() => {
    'worklet';
    const t = progress.value;
    const st = slowProgress.value;
    const cx = size / 2;
    const cy = size / 2;
    const c = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));

    // ── LegendaryAura: multi-layer radial glow (smooth falloff) ──
    const breathe = 0.03 + 0.07 * (0.5 + 0.5 * Math.sin(st * Math.PI * 2));
    paint.setColor(AURA_BASE);
    paint.setAlphaf(breathe * 0.3);
    c.drawCircle(cx, cy, size * 0.4, paint);
    paint.setAlphaf(breathe * 0.6);
    c.drawCircle(cx, cy, size * 0.3, paint);
    paint.setAlphaf(breathe);
    c.drawCircle(cx, cy, size * 0.2, paint);

    // ── LegendaryAura: orbit ring with hue shift ──
    const ringBreath = 0.05 + 0.07 * (0.5 + 0.5 * Math.cos(st * Math.PI * 2 + 1));
    const shift = Math.sin(st * Math.PI * 2) * 20;
    const nr = Math.max(0, Math.min(255, Math.round(AURA_R + shift)));
    const nb = Math.max(0, Math.min(255, Math.round(AURA_B - shift)));
    paint.setColor(Skia.Color(`rgb(${nr},${AURA_G},${nb})`));
    paint.setAlphaf(ringBreath);
    paint.setStyle(1); // Stroke
    paint.setStrokeWidth(size * 0.015);
    c.drawCircle(cx, cy, size * 0.42, paint);
    paint.setStyle(0); // Fill
    paint.setStrokeWidth(0);

    // ── Fire particles ──
    const orbit = size * 0.42;
    const baseR = size * 0.02;
    for (let i = 0; i < N; i++) {
      const color = SKIA_COLORS[i % SKIA_COLORS.length]!;
      paint.setColor(color);
      const baseAngle = (i / N) * Math.PI * 2 + t * Math.PI * 2;
      for (let trail = TRAIL; trail >= 0; trail--) {
        const trailAngle = baseAngle - trail * 0.08;
        const x = cx + Math.cos(trailAngle) * orbit;
        const y = cy + Math.sin(trailAngle) * orbit;
        const alphaScale = trail === 0 ? 1 : (1 - trail / (TRAIL + 1)) * 0.5;
        const rScale = trail === 0 ? 1 : 1 - trail * 0.2;
        paint.setAlphaf(alphaScale * 0.75);
        c.drawCircle(x, y, baseR * rScale, paint);
      }
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
FireRingFlair.displayName = 'FireRingFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
