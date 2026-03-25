/**
 * VillagerRevealEffect — 村民阵营揭示特效（Skia + Reanimated 4）
 *
 * 翻牌后在卡片区域渲染宁静夜空系列动画：
 * 1. 卡片光晕 — Skia RadialGradient + Blur，柔和爆发→持续微弱暖色发光
 * 2. 护盾涟漪（2 层）— Skia Circle stroke + Blur，从中心柔和扩散后淡出
 * 3. 萤火虫粒子（16 颗）— Skia Circle + Blur + blendMode="screen"，缓慢漂浮上升
 * 4. 闪烁星点（10 颗）— Skia Circle + Blur，固定位置交替闪烁
 *
 * 萤火虫和星光持续循环，光晕持续保留。
 * 不 import service，不含业务逻辑。
 */
import { Blur, Canvas, Circle, Group, RadialGradient, vec } from '@shopify/react-native-skia';
import React, { useEffect, useMemo } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { SkiaSparkle } from '@/components/RoleRevealEffects/common/effects/SkiaSparkle';
import { CONFIG } from '@/components/RoleRevealEffects/config';

const AE = CONFIG.alignmentEffects;
const SK = CONFIG.skia;

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

/** Gentle shield ripple — Skia expanding ring with Blur */
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

  const r = useDerivedValue(() => {
    const lp = Math.min(1, Math.max(0, (progress.value - startP) / (endP - startP)));
    return baseR * (1 + lp * (maxScale - 1));
  });
  const opacity = useDerivedValue(() => {
    const lp = Math.min(1, Math.max(0, (progress.value - startP) / (endP - startP)));
    if (lp < 0.1) return peakOpacity;
    if (lp < 0.4) return peakOpacity * 0.8;
    return Math.max(0, peakOpacity * (1 - (lp - 0.4) / 0.6));
  });

  return (
    <Circle
      cx={centerX}
      cy={centerY}
      r={r}
      color={color}
      style="stroke"
      strokeWidth={1.5}
      opacity={opacity}
    >
      <Blur blur={4} />
    </Circle>
  );
});

/** Floating firefly — Skia Circle with glow, drifts upward with gentle wobble */
const Firefly = React.memo(function Firefly({
  phase,
  xRatio,
  startYRatio,
  driftRatio,
  wobbleRatio,
  sizeRatio,
  fireflyCycle,
  appear,
  color,
  cardWidth,
  cardHeight,
}: {
  phase: number;
  xRatio: number;
  startYRatio: number;
  driftRatio: number;
  wobbleRatio: number;
  sizeRatio: number;
  fireflyCycle: SharedValue<number>;
  appear: SharedValue<number>;
  color: string;
  cardWidth: number;
  cardHeight: number;
}) {
  const baseX = xRatio * cardWidth;
  const startY = startYRatio * cardHeight;
  const driftHeight = driftRatio * cardHeight;
  const wobbleAmp = wobbleRatio * cardWidth;
  const size = Math.max(1.5, sizeRatio * cardWidth);

  const cx = useDerivedValue(() => {
    const currentPhase = (fireflyCycle.value + phase) % 360;
    return baseX + Math.sin(((currentPhase * Math.PI) / 180) * 3) * wobbleAmp;
  });
  const cy = useDerivedValue(() => {
    const currentPhase = (fireflyCycle.value + phase) % 360;
    const t = currentPhase / 360;
    return startY - t * driftHeight;
  });
  const opacity = useDerivedValue(() => {
    const currentPhase = (fireflyCycle.value + phase) % 360;
    const t = currentPhase / 360;
    let alpha: number;
    if (t < 0.12) alpha = (t / 0.12) * 0.85;
    else if (t < 0.65) alpha = 0.85;
    else alpha = 0.85 * (1 - (t - 0.65) / 0.35);
    return appear.value * Math.max(0, alpha);
  });

  return (
    <Circle cx={cx} cy={cy} r={size} color={color} opacity={opacity}>
      <Blur blur={SK.particleBlur + 1} />
    </Circle>
  );
});

/** Twinkling star — Skia cross-sparkle ✦ with pulsing opacity */
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

  const opacity = useDerivedValue(() => {
    const sinVal = Math.sin(twinkleCycle.value + twinklePhase);
    let alpha: number;
    if (sinVal < -0.2) alpha = 0.05 + ((sinVal + 1) / 0.8) * 0.1;
    else if (sinVal < 0.2) alpha = 0.15 + ((sinVal + 0.2) / 0.4) * 0.35;
    else alpha = 0.5 + ((sinVal - 0.2) / 0.8) * 0.35;
    return appear.value * alpha;
  });

  const isBright = size > 2.5;

  return (
    <Group opacity={opacity}>
      <SkiaSparkle
        x={x}
        y={y}
        r={size}
        color={color}
        bright={isBright}
        glowBlur={SK.particleBlur + 2}
      />
    </Group>
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

  const glowR = useDerivedValue(() => cardWidth * 0.45 * (0.5 + glowIntensity.value * 0.5));
  const glowOpacity = useDerivedValue(() => glowIntensity.value * 0.55);

  const flashOpacity = useDerivedValue(() => {
    const p = progress.value;
    if (p < 0.06) return (p / 0.06) * 0.4;
    if (p < 0.15) return 0.4 * (1 - ((p - 0.06) / 0.09) * 0.6);
    if (p < 0.35) return 0.16 * (1 - (p - 0.15) / 0.2);
    return 0;
  });

  const canvasStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      top: 0,
      left: 0,
      overflow: 'visible' as const,
      width: cardWidth,
      height: cardHeight,
    }),
    [cardWidth, cardHeight],
  );

  return (
    <Canvas style={canvasStyle} pointerEvents="none">
      {/* Persistent card glow */}
      <Group opacity={glowOpacity}>
        <Circle cx={centerX} cy={centerY} r={glowR}>
          <RadialGradient
            c={vec(centerX, centerY)}
            r={cardWidth * 0.45}
            colors={[glowColor, `${primaryColor}50`, `${primaryColor}00`]}
          />
          <Blur blur={SK.glowBlur} />
        </Circle>
      </Group>

      {/* Soft flash overlay */}
      <Group opacity={flashOpacity}>
        <Circle cx={centerX} cy={centerY} r={cardWidth * 0.6}>
          <RadialGradient
            c={vec(centerX, centerY)}
            r={cardWidth * 0.6}
            colors={[`${primaryColor}80`, `${primaryColor}00`]}
          />
          <Blur blur={20} />
        </Circle>
      </Group>

      {/* Shield ripples */}
      <Group blendMode="screen">
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
      </Group>

      {/* Twinkling stars */}
      <Group blendMode="screen">
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
      </Group>

      {/* Floating fireflies */}
      <Group blendMode="screen">
        {FIREFLIES.map((ff, i) => (
          <Firefly
            key={i}
            phase={ff.phase}
            xRatio={ff.xRatio}
            startYRatio={ff.startYRatio}
            driftRatio={ff.driftRatio}
            wobbleRatio={ff.wobbleRatio}
            sizeRatio={ff.sizeRatio}
            fireflyCycle={fireflyCycle}
            appear={appear}
            color={particleColor}
            cardWidth={cardWidth}
            cardHeight={cardHeight}
          />
        ))}
      </Group>
    </Canvas>
  );
};
