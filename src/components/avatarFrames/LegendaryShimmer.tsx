/**
 * LegendaryShimmer — 传说头像框专属动效层
 *
 * 三层动效叠加：
 * 1. 环绕光弧（orbiting arc）：金色光弧沿边框轨道匀速旋转（两对光点对向运动）
 * 2. 外围脉冲辉光（glow pulse）：金色发光呼吸（SVG Rect opacity）
 * 3. 角落星尘（corner sparkles）：四角交替闪烁的光点（SVG Circle opacity+r）
 *
 * 全部通过 Reanimated `useAnimatedProps` 驱动 SVG 数值属性（cx/cy/opacity/r），
 * 在 UI 线程执行，不阻塞 JS 线程。Web + Native 行为一致。
 */
import { memo, useEffect, useId } from 'react';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** 环绕光弧旋转周期（ms） */
const ORBIT_DURATION = 3000;
/** 辉光呼吸周期（ms） */
const GLOW_DURATION = 3200;
/** 星尘闪烁周期（ms） */
const SPARKLE_DURATION = 2400;

interface LegendaryShimmerProps {
  /** SVG 总尺寸（含 viewBox 外扩，= avatar size * 116/100） */
  size: number;
  /** 主边框圆角（viewBox 单位） */
  rx: number;
}

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
  // Normalize t to [0,1)
  let d = (((t % 1) + 1) % 1) * perimeter;
  if (d < w) return { x: x0 + d, y: y0 }; // top edge
  d -= w;
  if (d < h) return { x: x0 + w, y: y0 + d }; // right edge
  d -= h;
  if (d < w) return { x: x0 + w - d, y: y0 + h }; // bottom edge
  d -= w;
  return { x: x0, y: y0 + h - d }; // left edge
}

export const LegendaryShimmer = memo<LegendaryShimmerProps>(({ size, rx }) => {
  // ── Shared values ─────────────────────────────────────────────────────
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

  // ── Gradient ID (stable per instance) ─────────────────────────────────
  const uid = useId();
  const glowId = `lgw${uid}`;

  // ── 1. Orbiting light arc — two pairs of circles chasing along border
  // Lead circle (bright, warm white)
  const orbitLeadProps = useAnimatedProps(() => {
    'worklet';
    const pt = perimeterPoint(orbit.value, -2, -2, 104, 104);
    return { cx: pt.x, cy: pt.y, opacity: 0.7, r: 4 } as Record<string, number>;
  });
  // Trail circle (dimmer gold, slightly behind)
  const orbitTrailProps = useAnimatedProps(() => {
    'worklet';
    const pt = perimeterPoint(orbit.value - 0.04, -2, -2, 104, 104);
    return { cx: pt.x, cy: pt.y, opacity: 0.35, r: 3 } as Record<string, number>;
  });
  // Secondary lead (opposite side, for symmetry)
  const orbitLead2Props = useAnimatedProps(() => {
    'worklet';
    const pt = perimeterPoint(orbit.value + 0.5, -2, -2, 104, 104);
    return { cx: pt.x, cy: pt.y, opacity: 0.5, r: 3.5 } as Record<string, number>;
  });
  // Secondary trail
  const orbitTrail2Props = useAnimatedProps(() => {
    'worklet';
    const pt = perimeterPoint(orbit.value + 0.46, -2, -2, 104, 104);
    return { cx: pt.x, cy: pt.y, opacity: 0.25, r: 2.5 } as Record<string, number>;
  });

  // ── 2. Glow pulse (outer border opacity) ──────────────────────────────
  const glowProps = useAnimatedProps(() => {
    'worklet';
    const t = glow.value;
    const alpha = 0.1 + Math.sin(t * Math.PI * 2) * 0.13;
    return { opacity: alpha, strokeWidth: 5 } as Record<string, number>;
  });

  // ── 3. Corner sparkles — 4 points, staggered phase ───────────────────
  const sparkle0Props = useAnimatedProps(() => {
    'worklet';
    const t = sparkle.value;
    const alpha = Math.max(0, Math.sin(t * Math.PI * 2)) * 0.75;
    const r = 1.2 + Math.sin(t * Math.PI * 2) * 1.0;
    return { opacity: alpha, r } as Record<string, number>;
  });
  const sparkle1Props = useAnimatedProps(() => {
    'worklet';
    const t = (sparkle.value + 0.25) % 1;
    const alpha = Math.max(0, Math.sin(t * Math.PI * 2)) * 0.75;
    const r = 1.2 + Math.sin(t * Math.PI * 2) * 1.0;
    return { opacity: alpha, r } as Record<string, number>;
  });
  const sparkle2Props = useAnimatedProps(() => {
    'worklet';
    const t = (sparkle.value + 0.5) % 1;
    const alpha = Math.max(0, Math.sin(t * Math.PI * 2)) * 0.75;
    const r = 1.2 + Math.sin(t * Math.PI * 2) * 1.0;
    return { opacity: alpha, r } as Record<string, number>;
  });
  const sparkle3Props = useAnimatedProps(() => {
    'worklet';
    const t = (sparkle.value + 0.75) % 1;
    const alpha = Math.max(0, Math.sin(t * Math.PI * 2)) * 0.75;
    const r = 1.2 + Math.sin(t * Math.PI * 2) * 1.0;
    return { opacity: alpha, r } as Record<string, number>;
  });

  const sparkleAnimProps = [sparkle0Props, sparkle1Props, sparkle2Props, sparkle3Props];

  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={glowId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F5A623" stopOpacity={1} />
          <Stop offset="0.5" stopColor="#FFD700" stopOpacity={1} />
          <Stop offset="1" stopColor="#F5A623" stopOpacity={1} />
        </LinearGradient>
      </Defs>

      {/* Layer 1: Orbiting light arcs — two pairs of circles chasing along border */}
      <AnimatedCircle animatedProps={orbitTrailProps} fill="#FFD700" />
      <AnimatedCircle animatedProps={orbitLeadProps} fill="#FFFDE8" />
      <AnimatedCircle animatedProps={orbitTrail2Props} fill="#FFD700" />
      <AnimatedCircle animatedProps={orbitLead2Props} fill="#FFFDE8" />

      {/* Layer 2: Glow pulse — animated gold border */}
      <AnimatedRect
        animatedProps={glowProps}
        x={-3}
        y={-3}
        width={106}
        height={106}
        rx={rx + 2}
        fill="none"
        stroke={`url(#${glowId})`}
      />

      {/* Layer 3: Corner sparkles */}
      <AnimatedCircle animatedProps={sparkleAnimProps[0]} cx={4} cy={4} fill="#FFD700" />
      <AnimatedCircle animatedProps={sparkleAnimProps[1]} cx={96} cy={4} fill="#FFD700" />
      <AnimatedCircle animatedProps={sparkleAnimProps[2]} cx={96} cy={96} fill="#FFD700" />
      <AnimatedCircle animatedProps={sparkleAnimProps[3]} cx={4} cy={96} fill="#FFD700" />
    </Svg>
  );
});
LegendaryShimmer.displayName = 'LegendaryShimmer';
