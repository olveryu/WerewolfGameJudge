/**
 * GodRevealEffect — 神职阵营揭示特效（SVG + Reanimated 4）
 *
 * 翻牌后在卡片区域渲染圣光系列动画：
 * 1. 卡片光晕 — SVG RadialGradient + feGaussianBlur，极亮爆发→持续微弱金色发光
 * 2. 天降光柱 — SVG 从卡片顶部向上延伸的锥形光束
 * 3. 十字闪光 — SVG Rect + feGaussianBlur，快闪后消失
 * 4. 光环绽放 — 4 层同心 Circle stroke + feGaussianBlur 从中心扩散
 * 5. 圣光粒子 — 24 颗金色光尘 + feGaussianBlur 从中心向四周飘散
 * 6. 底部光晕 — 地面反射的半圆形柔光
 *
 * 情绪签名：瞬间爆发 + "divine intervention" 力量感。
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
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { CONFIG } from '@/components/RoleRevealEffects/config';
const AE = CONFIG.alignmentEffects;
const SK = CONFIG.skia;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

// ─── Pre-computed data ────────────────────────────────────────────────

const HALO_CONFIGS = [
  { startP: 0.06, durationP: 0.4 },
  { startP: 0.12, durationP: 0.48 },
  { startP: 0.18, durationP: 0.56 },
  { startP: 0.25, durationP: 0.6 },
] as const;

const PARTICLE_COUNT = 24;
const GOD_PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
  const r1 = ((i * 73 + 17) % 100) / 100;
  const r2 = ((i * 41 + 31) % 100) / 100;
  const r3 = ((i * 59 + 7) % 100) / 100;
  const r4 = ((i * 37 + 53) % 100) / 100;
  const angle = ((i * 29 + 11) % 360) * (Math.PI / 180);
  const dist = 20 + r1 * 120;
  return {
    angle,
    dist,
    driftX: (r2 - 0.5) * 40,
    driftY: -20 - r3 * 60,
    size: 1 + r4 * 2.5,
    baseAlpha: 0.3 + ((i * 67 + 23) % 70) / 100,
    twinklePhase: ((i * 83 + 11) % 628) / 100,
  };
});

const TWINKLE_CYCLE_MS = 1047;
const PARTICLE_LIFETIME_MS = 5500;
const PARTICLE_START_DELAY_MS = 400;

// ─── Sub-components ───────────────────────────────────────────────────

/** Expanding halo ring */
const GodHalo = React.memo(function GodHalo({
  startP,
  durationP,
  progress,
  color,
  centerX,
  centerY,
  cardWidth,
}: {
  startP: number;
  durationP: number;
  progress: SharedValue<number>;
  color: string;
  centerX: number;
  centerY: number;
  cardWidth: number;
}) {
  const endP = startP + durationP;
  const maxR = cardWidth * 0.8;

  const animatedProps = useAnimatedProps(() => {
    const p = progress.value;
    const lp = Math.min(1, Math.max(0, (p - startP) / (endP - startP)));
    const r = lp * maxR;
    const opacity = lp < 0.3 ? 0.8 : Math.max(0, 0.8 * (1 - (lp - 0.3) / 0.7));
    return { r, opacity };
  });

  return (
    <AnimatedCircle
      cx={centerX}
      cy={centerY}
      stroke={color}
      fill="none"
      strokeWidth={2}
      filter="url(#halo-blur)"
      animatedProps={animatedProps}
    />
  );
});

/** Single god particle driven by shared progress + twinkle */
const GodParticle: React.FC<{
  particle: (typeof GOD_PARTICLES)[number];
  particleProgress: SharedValue<number>;
  twinkleCycle: SharedValue<number>;
  centerX: number;
  centerY: number;
  particleColor: string;
}> = React.memo(({ particle, particleProgress, twinkleCycle, centerX, centerY, particleColor }) => {
  const startX = centerX + Math.cos(particle.angle) * particle.dist * 0.3;
  const startY = centerY + Math.sin(particle.angle) * particle.dist * 0.3;

  const animatedProps = useAnimatedProps(() => {
    const cx = startX + particle.driftX * particleProgress.value;
    const cy = startY + particle.driftY * particleProgress.value;
    const life = 1 - particleProgress.value;
    const flicker = 0.5 + 0.5 * Math.sin(twinkleCycle.value + particle.twinklePhase);
    const opacity = life <= 0 ? 0 : particle.baseAlpha * life * flicker;
    return { cx, cy, opacity };
  });

  return (
    <AnimatedCircle
      r={particle.size}
      fill={particleColor}
      filter="url(#particle-blur)"
      animatedProps={animatedProps}
    />
  );
});
GodParticle.displayName = 'GodParticle';

// ─── Main component ───────────────────────────────────────────────────

interface GodRevealEffectProps {
  cardWidth: number;
  cardHeight: number;
  animate: boolean;
  primaryColor: string;
  glowColor: string;
  particleColor: string;
}

export const GodRevealEffect: React.FC<GodRevealEffectProps> = ({
  cardWidth,
  cardHeight,
  animate,
  primaryColor,
  glowColor,
  particleColor,
}) => {
  const progress = useSharedValue(0);
  const glowIntensity = useSharedValue(0);
  const particleProgress = useSharedValue(0);
  const twinkleCycle = useSharedValue(0);
  const centerX = cardWidth / 2;
  const centerY = cardHeight * 0.42;

  useEffect(() => {
    if (!animate) return;

    // Main progress 0→1 over 2.5s
    progress.value = withDelay(
      AE.effectStartDelay,
      withTiming(1, { duration: 2500, easing: Easing.out(Easing.quad) }),
    );

    // Card glow: burst → persist
    glowIntensity.value = withDelay(
      AE.effectStartDelay,
      withSequence(
        withTiming(1, { duration: 375, easing: Easing.out(Easing.cubic) }),
        withTiming(0.6, { duration: 625, easing: Easing.out(Easing.quad) }),
        withTiming(0.35, { duration: 1500, easing: Easing.out(Easing.quad) }),
      ),
    );

    // Particle life: 0→1 over 5.5s after delay
    particleProgress.value = withDelay(
      AE.effectStartDelay + PARTICLE_START_DELAY_MS,
      withTiming(1, { duration: PARTICLE_LIFETIME_MS, easing: Easing.linear }),
    );

    // Twinkle cycle: repeating
    twinkleCycle.value = withDelay(
      AE.effectStartDelay + PARTICLE_START_DELAY_MS,
      withRepeat(
        withTiming(Math.PI * 2, { duration: TWINKLE_CYCLE_MS, easing: Easing.linear }),
        -1,
      ),
    );
  }, [animate, progress, glowIntensity, particleProgress, twinkleCycle]);

  // ── Animated props ──
  const glowGroupProps = useAnimatedProps(() => ({
    opacity: glowIntensity.value * 0.7,
  }));
  const glowCircleProps = useAnimatedProps(() => ({
    r: cardWidth * 0.5 * (0.5 + glowIntensity.value * 0.5),
  }));

  // Light pillar (tapers upward from card top)
  const pillarGroupProps = useAnimatedProps(() => {
    const p = progress.value;
    let opacity: number;
    if (p < 0.05) opacity = p / 0.05;
    else if (p < 0.3) opacity = 1;
    else opacity = Math.max(0.15, 1 - (p - 0.3) / 0.7);
    return { opacity };
  });
  const pillarRectProps = useAnimatedProps(() => {
    const p = progress.value;
    return { height: Math.min(1, p / 0.15) * cardHeight * 0.8 };
  });

  // Cross flash
  const crossHGroupProps = useAnimatedProps(() => {
    const p = progress.value;
    const opacity = p < 0.08 ? p / 0.08 : Math.max(0, 1 - (p - 0.08) / 0.3);
    const scaleX = Math.min(2, (p / 0.08) * 2);
    return {
      opacity,
      transform: `translate(${centerX}, ${centerY}) scale(${scaleX}, 1) translate(${-centerX}, ${-centerY})`,
    };
  });
  const crossVGroupProps = useAnimatedProps(() => {
    const p = progress.value;
    const opacity = p < 0.08 ? p / 0.08 : Math.max(0, 1 - (p - 0.08) / 0.3);
    const scaleY = Math.min(2, (p / 0.08) * 2);
    return {
      opacity,
      transform: `translate(${centerX}, ${centerY}) scale(1, ${scaleY}) translate(${-centerX}, ${-centerY})`,
    };
  });

  // Bottom ground glow
  const groundGroupProps = useAnimatedProps(() => {
    const p = progress.value;
    return { opacity: p < 0.2 ? (p / 0.2) * 0.25 : 0.25 };
  });

  const barThickness = Math.max(3, cardWidth * 0.025);

  // Gradient stop colors
  const glowStop1 = `${primaryColor}60`;
  const glowStop2 = `${primaryColor}00`;
  const groundStop1 = `${primaryColor}40`;
  const groundStop2 = `${primaryColor}00`;

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
          id="god-glow-grad"
          cx={centerX}
          cy={centerY}
          r={cardWidth * 0.5}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={glowColor} />
          <Stop offset="0.5" stopColor={glowStop1} />
          <Stop offset="1" stopColor={glowStop2} />
        </RadialGradient>
        <RadialGradient
          id="god-ground-grad"
          cx={centerX}
          cy={cardHeight}
          r={cardWidth * 0.6}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={groundStop1} />
          <Stop offset="1" stopColor={groundStop2} />
        </RadialGradient>
        <Filter id="glow-blur" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={SK.glowBlur} />
        </Filter>
        <Filter id="pillar-blur" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={15} />
        </Filter>
        <Filter id="cross-blur" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={10} />
        </Filter>
        <Filter id="halo-blur" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={6} />
        </Filter>
        <Filter id="ground-blur" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={20} />
        </Filter>
        <Filter id="particle-blur" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={SK.particleBlur} />
        </Filter>
      </Defs>

      {/* Persistent card glow */}
      <AnimatedG animatedProps={glowGroupProps}>
        <AnimatedCircle
          cx={centerX}
          cy={centerY}
          fill="url(#god-glow-grad)"
          filter="url(#glow-blur)"
          animatedProps={glowCircleProps}
        />
      </AnimatedG>

      {/* Light pillar — upward from card center */}
      <AnimatedG animatedProps={pillarGroupProps}>
        <AnimatedRect
          x={centerX - cardWidth * 0.15}
          y={0}
          width={cardWidth * 0.3}
          fill={primaryColor}
          filter="url(#pillar-blur)"
          animatedProps={pillarRectProps}
        />
      </AnimatedG>

      {/* Cross flash — horizontal */}
      <AnimatedG animatedProps={crossHGroupProps}>
        <Rect
          x={centerX - cardWidth}
          y={centerY - barThickness / 2}
          width={cardWidth * 2}
          height={barThickness}
          fill={particleColor}
          filter="url(#cross-blur)"
        />
      </AnimatedG>

      {/* Cross flash — vertical */}
      <AnimatedG animatedProps={crossVGroupProps}>
        <Rect
          x={centerX - barThickness / 2}
          y={centerY - cardHeight}
          width={barThickness}
          height={cardHeight * 2}
          fill={particleColor}
          filter="url(#cross-blur)"
        />
      </AnimatedG>

      {/* Expanding halos (4 layers) */}
      <G>
        {HALO_CONFIGS.map((cfg, i) => (
          <GodHalo
            key={i}
            startP={cfg.startP}
            durationP={cfg.durationP}
            progress={progress}
            color={primaryColor}
            centerX={centerX}
            centerY={centerY}
            cardWidth={cardWidth}
          />
        ))}
      </G>

      {/* Bottom ground glow */}
      <AnimatedG animatedProps={groundGroupProps}>
        <Circle
          cx={centerX}
          cy={cardHeight}
          r={cardWidth * 0.6}
          fill="url(#god-ground-grad)"
          filter="url(#ground-blur)"
        />
      </AnimatedG>

      {/* Gold sparkle particles */}
      <G>
        {GOD_PARTICLES.map((particle, i) => (
          <GodParticle
            key={i}
            particle={particle}
            particleProgress={particleProgress}
            twinkleCycle={twinkleCycle}
            centerX={centerX}
            centerY={centerY}
            particleColor={particleColor}
          />
        ))}
      </G>
    </Svg>
  );
};
