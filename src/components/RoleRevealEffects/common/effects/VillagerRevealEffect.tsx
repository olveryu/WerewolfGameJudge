/**
 * VillagerRevealEffect — 村民阵营揭示特效（SVG + Reanimated 4）
 *
 * 翻牌后在卡片区域渲染宁静夜空系列动画：
 * 1. 卡片光晕 — SVG RadialGradient + feGaussianBlur，柔和爆发→持续微弱暖色发光
 * 2. 护盾涟漪（2 层）— SVG Circle stroke + feGaussianBlur，从中心柔和扩散后淡出
 * 3. 萤火虫粒子（16 颗）— SVG Circle + feGaussianBlur，缓慢漂浮上升
 * 4. 闪烁星点（10 颗）— SVG Circle/Line + feGaussianBlur，固定位置交替闪烁
 *
 * 萤火虫和星光持续循环，光晕持续保留。
 * 不 import service，不含业务逻辑。
 */
import React, { useEffect, useMemo } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  FeGaussianBlur,
  Filter,
  G,
  Line,
  RadialGradient,
  Stop,
} from 'react-native-svg';

import { CONFIG } from '@/components/RoleRevealEffects/config';
const AE = CONFIG.alignmentEffects;
const SK = CONFIG.skia;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

// ─── Pre-computed arrays ──────────────────────────────────────────────

/** Shield ripple configs — gentler than wolf shockwaves */
const RIPPLE_CONFIGS = [
  { startP: 0.05, durationP: 0.45, maxScale: 2.5, peakOpacity: 0.25 },
  { startP: 0.18, durationP: 0.47, maxScale: 3, peakOpacity: 0.15 },
] as const;

const FIREFLIES = Array.from({ length: AE.villagerFireflyCount }, (_, i) => {
  const phase = (i / AE.villagerFireflyCount) * 360;
  const xRatio = 0.08 + ((i * 61 + 17) % 84) / 100;
  const startYRatio = 0.55 + ((i * 37 + 11) % 40) / 100;
  const driftRatio = 0.35 + ((i * 23 + 7) % 30) / 100;
  const wobbleRatio = 0.03 + ((i * 13 + 3) % 40) / 1000;
  const sizeRatio = (2 + (i % 3)) / 320;
  return { phase, xRatio, startYRatio, driftRatio, wobbleRatio, sizeRatio };
});

const STARS = Array.from({ length: AE.villagerStarCount }, (_, i) => {
  const angle = (i / AE.villagerStarCount) * Math.PI * 2 + ((i * 0.3) % 0.6);
  const rRatio = 0.32 + ((i * 17 + 5) % 18) / 100;
  const xRatio = 0.5 + Math.cos(angle) * rRatio;
  const yRatio = 0.42 + Math.sin(angle) * rRatio * 0.75;
  const sizeRatio = (1.5 + (i % 3)) / 320;
  const twinklePhase = ((i * 83 + 11) % 628) / 100;
  return { xRatio, yRatio, sizeRatio, twinklePhase };
});

// ─── Sub-components ──────────────────────────────────────────────────

/** Gentle shield ripple — SVG expanding ring with feGaussianBlur */
const ShieldRipple = React.memo(function ShieldRipple({
  startP,
  durationP,
  maxScale,
  peakOpacity,
  progress,
  color,
  centerX,
  centerY,
  cardWidth,
}: {
  startP: number;
  durationP: number;
  maxScale: number;
  peakOpacity: number;
  progress: SharedValue<number>;
  color: string;
  centerX: number;
  centerY: number;
  cardWidth: number;
}) {
  const baseR = cardWidth * 0.12;
  const endP = startP + durationP;

  const animatedProps = useAnimatedProps(() => {
    const lp = Math.min(1, Math.max(0, (progress.value - startP) / (endP - startP)));
    const r = baseR * (1 + lp * (maxScale - 1));
    let opacity: number;
    if (lp < 0.1) opacity = peakOpacity;
    else if (lp < 0.4) opacity = peakOpacity * 0.8;
    else opacity = Math.max(0, peakOpacity * (1 - (lp - 0.4) / 0.6));
    return { r, opacity };
  });

  return (
    <AnimatedCircle
      cx={centerX}
      cy={centerY}
      stroke={color}
      fill="none"
      strokeWidth={1.5}
      filter="url(#ripple-blur)"
      animatedProps={animatedProps}
    />
  );
});

/** Single firefly particle */
const Firefly: React.FC<{
  ff: (typeof FIREFLIES)[number];
  fireflyCycle: SharedValue<number>;
  appear: SharedValue<number>;
  cardWidth: number;
  cardHeight: number;
  color: string;
}> = React.memo(({ ff, fireflyCycle, appear, cardWidth, cardHeight, color }) => {
  const baseX = ff.xRatio * cardWidth;
  const startY = ff.startYRatio * cardHeight;
  const driftHeight = ff.driftRatio * cardHeight;
  const wobbleAmp = ff.wobbleRatio * cardWidth;
  const size = Math.max(1.5, ff.sizeRatio * cardWidth);

  const animatedProps = useAnimatedProps(() => {
    const currentPhase = (fireflyCycle.value + ff.phase) % 360;
    const t = currentPhase / 360;
    const cx = baseX + Math.sin(((currentPhase * Math.PI) / 180) * 3) * wobbleAmp;
    const cy = startY - t * driftHeight;
    let alpha: number;
    if (t < 0.12) alpha = (t / 0.12) * 0.85;
    else if (t < 0.65) alpha = 0.85;
    else alpha = 0.85 * (1 - (t - 0.65) / 0.35);
    const opacity = appear.value * Math.max(0, alpha);
    return { cx, cy, opacity };
  });

  return <AnimatedCircle r={size} fill={color} animatedProps={animatedProps} />;
});
Firefly.displayName = 'Firefly';

/** Twinkling star — inline SVG cross-sparkle ✦ with pulsing opacity */
const TwinkleStar = React.memo(function TwinkleStar({
  xRatio,
  yRatio,
  sizeRatio,
  twinklePhase,
  twinkleCycle,
  appear,
  color,
  cardWidth,
  cardHeight,
}: {
  xRatio: number;
  yRatio: number;
  sizeRatio: number;
  twinklePhase: number;
  twinkleCycle: SharedValue<number>;
  appear: SharedValue<number>;
  color: string;
  cardWidth: number;
  cardHeight: number;
}) {
  const x = xRatio * cardWidth;
  const y = yRatio * cardHeight;
  const size = Math.max(1.5, sizeRatio * cardWidth);
  const isBright = size > 2.5;

  const vLen = size * 3.5;
  const hLen = size * 2.5;
  const dLen = size * 2;
  const sw = isBright ? 1.2 : 0.8;
  const glowR = size * 4;

  const animatedProps = useAnimatedProps(() => {
    const sinVal = Math.sin(twinkleCycle.value + twinklePhase);
    let alpha: number;
    if (sinVal < -0.2) alpha = 0.05 + ((sinVal + 1) / 0.8) * 0.1;
    else if (sinVal < 0.2) alpha = 0.15 + ((sinVal + 0.2) / 0.4) * 0.35;
    else alpha = 0.5 + ((sinVal - 0.2) / 0.8) * 0.35;
    return { opacity: appear.value * alpha };
  });

  return (
    <AnimatedG animatedProps={animatedProps}>
      {/* Soft glow halo */}
      <Circle cx={x} cy={y} r={glowR} fill={color} filter="url(#star-glow)" />
      {/* Vertical spike */}
      <Line
        x1={x}
        y1={y - vLen}
        x2={x}
        y2={y + vLen}
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
      />
      {/* Horizontal spike */}
      <Line
        x1={x - hLen}
        y1={y}
        x2={x + hLen}
        y2={y}
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
      />
      {/* Diagonal spikes for 8-pointed ✦ */}
      {isBright && (
        <>
          <Line
            x1={x - dLen}
            y1={y - dLen}
            x2={x + dLen}
            y2={y + dLen}
            stroke={color}
            strokeWidth={sw * 0.6}
            strokeLinecap="round"
          />
          <Line
            x1={x + dLen}
            y1={y - dLen}
            x2={x - dLen}
            y2={y + dLen}
            stroke={color}
            strokeWidth={sw * 0.6}
            strokeLinecap="round"
          />
        </>
      )}
      {/* Center dot */}
      <Circle cx={x} cy={y} r={size * 0.3} fill={color} />
    </AnimatedG>
  );
});

// ─── Main component ──────────────────────────────────────────────────

interface VillagerRevealEffectProps {
  cardWidth: number;
  cardHeight: number;
  animate: boolean;
  primaryColor: string;
  glowColor: string;
  particleColor: string;
}

export const VillagerRevealEffect: React.FC<VillagerRevealEffectProps> = ({
  cardWidth,
  cardHeight,
  animate,
  primaryColor,
  glowColor,
  particleColor,
}) => {
  const progress = useSharedValue(0);
  const appear = useSharedValue(0);
  const glowIntensity = useSharedValue(0);
  const fireflyCycle = useSharedValue(0);
  const twinkleCycle = useSharedValue(0);
  const centerX = cardWidth / 2;
  const centerY = cardHeight * 0.42;

  useEffect(() => {
    if (!animate) return;

    progress.value = withDelay(
      AE.effectStartDelay,
      withTiming(1, { duration: 2500, easing: Easing.out(Easing.quad) }),
    );

    appear.value = withDelay(
      AE.effectStartDelay + 300,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) }),
    );

    glowIntensity.value = withDelay(
      AE.effectStartDelay,
      withSequence(
        withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }),
        withTiming(0.5, { duration: 600, easing: Easing.out(Easing.quad) }),
        withTiming(0.25, { duration: 1500, easing: Easing.out(Easing.quad) }),
      ),
    );

    fireflyCycle.value = withDelay(
      AE.effectStartDelay,
      withRepeat(
        withTiming(360, {
          duration: AE.villagerFireflyDuration,
          easing: Easing.linear,
        }),
        -1,
      ),
    );

    twinkleCycle.value = withDelay(
      AE.effectStartDelay,
      withRepeat(
        withTiming(Math.PI * 2, {
          duration: AE.villagerTwinkleDuration,
          easing: Easing.linear,
        }),
        -1,
      ),
    );
  }, [animate, progress, appear, glowIntensity, fireflyCycle, twinkleCycle]);

  // ── Animated props ──
  const glowGroupProps = useAnimatedProps(() => ({
    opacity: glowIntensity.value * 0.55,
  }));
  const glowCircleProps = useAnimatedProps(() => ({
    r: cardWidth * 0.45 * (0.5 + glowIntensity.value * 0.5),
  }));

  const flashGroupProps = useAnimatedProps(() => {
    const p = progress.value;
    let opacity: number;
    if (p < 0.06) opacity = (p / 0.06) * 0.4;
    else if (p < 0.15) opacity = 0.4 * (1 - ((p - 0.06) / 0.09) * 0.6);
    else if (p < 0.35) opacity = 0.16 * (1 - (p - 0.15) / 0.2);
    else opacity = 0;
    return { opacity };
  });

  // Gradient stop colors
  const glowStop1 = `${primaryColor}50`;
  const glowStop2 = `${primaryColor}00`;
  const flashStop1 = `${primaryColor}80`;
  const flashStop2 = `${primaryColor}00`;

  const canvasStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      top: 0,
      left: 0,
      overflow: 'visible' as const,
      width: cardWidth,
      height: cardHeight,
      pointerEvents: 'none' as const,
    }),
    [cardWidth, cardHeight],
  );

  return (
    <Svg style={canvasStyle} width={cardWidth} height={cardHeight}>
      <Defs>
        <RadialGradient
          id="v-glow-grad"
          cx={centerX}
          cy={centerY}
          r={cardWidth * 0.45}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={glowColor} />
          <Stop offset="0.5" stopColor={glowStop1} />
          <Stop offset="1" stopColor={glowStop2} />
        </RadialGradient>
        <RadialGradient
          id="v-flash-grad"
          cx={centerX}
          cy={centerY}
          r={cardWidth * 0.6}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={flashStop1} />
          <Stop offset="1" stopColor={flashStop2} />
        </RadialGradient>
        <Filter id="v-glow-blur" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={SK.glowBlur} />
        </Filter>
        <Filter id="flash-blur" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={20} />
        </Filter>
        <Filter id="ripple-blur" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={4} />
        </Filter>
        <Filter id="star-glow" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={SK.particleBlur + 2} />
        </Filter>
        <Filter id="firefly-blur" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={SK.particleBlur + 1} />
        </Filter>
      </Defs>

      {/* Persistent card glow */}
      <AnimatedG animatedProps={glowGroupProps}>
        <AnimatedCircle
          cx={centerX}
          cy={centerY}
          fill="url(#v-glow-grad)"
          filter="url(#v-glow-blur)"
          animatedProps={glowCircleProps}
        />
      </AnimatedG>

      {/* Soft flash overlay */}
      <AnimatedG animatedProps={flashGroupProps}>
        <Circle
          cx={centerX}
          cy={centerY}
          r={cardWidth * 0.6}
          fill="url(#v-flash-grad)"
          filter="url(#flash-blur)"
        />
      </AnimatedG>

      {/* Shield ripples */}
      <G>
        {RIPPLE_CONFIGS.map((cfg, i) => (
          <ShieldRipple
            key={i}
            startP={cfg.startP}
            durationP={cfg.durationP}
            maxScale={cfg.maxScale}
            peakOpacity={cfg.peakOpacity}
            progress={progress}
            color={glowColor}
            centerX={centerX}
            centerY={centerY}
            cardWidth={cardWidth}
          />
        ))}
      </G>

      {/* Twinkling stars */}
      <G>
        {STARS.map((star, i) => (
          <TwinkleStar
            key={i}
            xRatio={star.xRatio}
            yRatio={star.yRatio}
            sizeRatio={star.sizeRatio}
            twinklePhase={star.twinklePhase}
            twinkleCycle={twinkleCycle}
            appear={appear}
            color={particleColor}
            cardWidth={cardWidth}
            cardHeight={cardHeight}
          />
        ))}
      </G>

      {/* Floating fireflies */}
      <G filter="url(#firefly-blur)">
        {FIREFLIES.map((ff, i) => (
          <Firefly
            key={i}
            ff={ff}
            fireflyCycle={fireflyCycle}
            appear={appear}
            cardWidth={cardWidth}
            cardHeight={cardHeight}
            color={particleColor}
          />
        ))}
      </G>
    </Svg>
  );
};
