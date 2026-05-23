/**
 * LegendaryShimmer — 传说头像框专属动效层 (Skia Canvas + Picture)
 *
 * 三层动效叠加：
 * 1. 环绕光弧（orbiting arc）：金色光弧沿边框轨道匀速旋转（两对光点对向运动）
 * 2. 外围脉冲辉光（glow pulse）：金色发光呼吸（圆角矩形描边 opacity）
 * 3. 角落星尘（corner sparkles）：四角交替闪烁的光点
 *
 * 全部通过 useDerivedValue + Picture 在 UI 线程 imperative 绘制，
 * 替代 9 个 SVG AnimatedComponent。Web + Native 行为一致。
 */
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import { memo, useEffect, useMemo } from 'react';
import {
  Easing,
  ReduceMotion,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

// ── Pre-allocated Skia resources ──
const recorder = Skia.PictureRecorder();
const paint = Skia.Paint();

const ORBIT_COLOR = Skia.Color('#FFD700');
const LEAD_COLOR = Skia.Color('#FFFDE8');
const SPARKLE_COLOR = Skia.Color('#FFD700');
const GLOW_GOLD = Skia.Color('#FFD700');

/** 环绕光弧旋转周期（ms） */
const ORBIT_DURATION = 3000;
/** 辉光呼吸周期（ms） */
const GLOW_DURATION = 3200;
/** 星尘闪烁周期（ms） */
const SPARKLE_DURATION = 2400;

/**
 * 计算矩形边框周长上某一比例位置的坐标。
 * `t` ∈ [0,1) 沿顺时针从左上角 (x0,y0) 出发。
 */
function perimeterPoint(
  t: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
): { x: number; y: number } {
  'worklet';
  const perimeter = 2 * (w + h);
  let d = (((t % 1) + 1) % 1) * perimeter;
  if (d < w) return { x: x0 + d, y: y0 };
  d -= w;
  if (d < h) return { x: x0 + w, y: y0 + d };
  d -= h;
  if (d < w) return { x: x0 + w - d, y: y0 + h };
  d -= w;
  return { x: x0, y: y0 + h - d };
}

interface LegendaryShimmerProps {
  /** SVG 总尺寸（含 viewBox 外扩，= avatar size * 116/100） */
  size: number;
  /** 主边框圆角（viewBox 单位） */
  rx: number;
}

export const LegendaryShimmer = memo<LegendaryShimmerProps>(({ size, rx }) => {
  const orbit = useSharedValue(0);
  const glow = useSharedValue(0);
  const sparkle = useSharedValue(0);

  useEffect(() => {
    orbit.value = withRepeat(
      withTiming(1, { duration: ORBIT_DURATION, easing: Easing.linear }),
      -1,
      false,
      undefined,
      ReduceMotion.Never,
    );
    glow.value = withRepeat(
      withTiming(1, { duration: GLOW_DURATION, easing: Easing.linear }),
      -1,
      false,
      undefined,
      ReduceMotion.Never,
    );
    sparkle.value = withRepeat(
      withTiming(1, { duration: SPARKLE_DURATION, easing: Easing.linear }),
      -1,
      false,
      undefined,
      ReduceMotion.Never,
    );
  }, [orbit, glow, sparkle]);

  const canvasStyle = useMemo(() => ({ width: size, height: size }), [size]);
  // ViewBox maps 116×116 logical units → size pixels
  const scale = size / 116;

  const shimmerPicture = useDerivedValue(() => {
    'worklet';
    const s = scale;
    const c = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));

    // ── 1. Orbiting light arcs ──
    // Perimeter in viewBox coords: rect at (-2,-2) size 104×104, offset by 8 for viewBox origin
    const periX0 = (-2 + 8) * s;
    const periY0 = (-2 + 8) * s;
    const periW = 104 * s;
    const periH = 104 * s;

    // Trail 1
    const pt0 = perimeterPoint(orbit.value - 0.04, periX0, periY0, periW, periH);
    paint.setColor(ORBIT_COLOR);
    paint.setAlphaf(0.35);
    c.drawCircle(pt0.x, pt0.y, 3 * s, paint);

    // Lead 1
    const pt1 = perimeterPoint(orbit.value, periX0, periY0, periW, periH);
    paint.setColor(LEAD_COLOR);
    paint.setAlphaf(0.7);
    c.drawCircle(pt1.x, pt1.y, 4 * s, paint);

    // Trail 2
    const pt2 = perimeterPoint(orbit.value + 0.46, periX0, periY0, periW, periH);
    paint.setColor(ORBIT_COLOR);
    paint.setAlphaf(0.25);
    c.drawCircle(pt2.x, pt2.y, 2.5 * s, paint);

    // Lead 2
    const pt3 = perimeterPoint(orbit.value + 0.5, periX0, periY0, periW, periH);
    paint.setColor(LEAD_COLOR);
    paint.setAlphaf(0.5);
    c.drawCircle(pt3.x, pt3.y, 3.5 * s, paint);

    // ── 2. Glow pulse (border stroke) ──
    const glowAlpha = 0.1 + Math.sin(glow.value * Math.PI * 2) * 0.13;
    paint.setColor(GLOW_GOLD);
    paint.setAlphaf(glowAlpha);
    paint.setStyle(1);
    paint.setStrokeWidth(5 * s);
    const rrect = Skia.RRectXY(
      Skia.XYWHRect((-3 + 8) * s, (-3 + 8) * s, 106 * s, 106 * s),
      (rx + 2) * s,
      (rx + 2) * s,
    );
    c.drawRRect(rrect, paint);
    paint.setStyle(0);
    paint.setStrokeWidth(0);

    // ── 3. Corner sparkles ──
    const corners = [
      { cx: (4 + 8) * s, cy: (4 + 8) * s },
      { cx: (96 + 8) * s, cy: (4 + 8) * s },
      { cx: (96 + 8) * s, cy: (96 + 8) * s },
      { cx: (4 + 8) * s, cy: (96 + 8) * s },
    ];
    for (let i = 0; i < 4; i++) {
      const t = (sparkle.value + i * 0.25) % 1;
      const alpha = Math.max(0, Math.sin(t * Math.PI * 2)) * 0.75;
      const r = (1.2 + Math.sin(t * Math.PI * 2) * 1.0) * s;
      if (alpha > 0) {
        paint.setColor(SPARKLE_COLOR);
        paint.setAlphaf(alpha);
        c.drawCircle(corners[i]!.cx, corners[i]!.cy, r, paint);
      }
    }

    paint.setAlphaf(1);
    return recorder.finishRecordingAsPicture();
  });

  return (
    <Canvas style={canvasStyle}>
      <Picture picture={shimmerPicture} />
    </Canvas>
  );
});
LegendaryShimmer.displayName = 'LegendaryShimmer';
