/**
 * ThirdRevealEffect — 第三方阵营揭示特效（SVG + Reanimated 4）
 *
 * 翻牌后在卡片区域渲染神秘系列动画：
 * 1. 卡片光晕 — SVG RadialGradient + feGaussianBlur，极亮爆发→持续微弱紫色发光
 * 2. 旋转符文环（2 层）— SVG Path dashed arcs + animated transform，持续旋转
 * 3. 螺旋轨道粒子（30 颗）— SVG Circle + feGaussianBlur，绕中心公转
 * 4. 召唤闪电弧（6 条）— SVG Path + feGaussianBlur，从中心向外辐射的电弧
 * 5. 中心能量核心 — SVG Circle + RadialGradient + feGaussianBlur 脉动
 *
 * 符文环和粒子持续循环，光晕持续保留。
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
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

import { CONFIG } from '@/components/RoleRevealEffects/config';
const AE = CONFIG.alignmentEffects;
const SK = CONFIG.skia;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedPath = Animated.createAnimatedComponent(Path);

// ─── Pre-computed arrays ──────────────────────────────────────────────

const ORBIT_PARTICLES = Array.from({ length: AE.thirdParticleCount }, (_, i) => {
  const r1 = ((i * 73 + 17) % 100) / 100;
  const r2 = ((i * 41 + 31) % 100) / 100;
  return {
    phaseOffset: (i / AE.thirdParticleCount) * 360,
    radiusOffsetRatio: 0.17 * ((i % 3) - 1),
    sizeRatio: (2 + (i % 2)) / 140,
    driftY: (r1 - 0.5) * 8,
    twinklePhase: r2 * Math.PI * 2,
  };
});

const ARC_COUNT = 6;
const ARCS = Array.from({ length: ARC_COUNT }, (_, i) => {
  const angle = (i / ARC_COUNT) * Math.PI * 2;
  return { angle, lengthRatio: 0.25 + ((i * 37 + 11) % 20) / 100 };
});

// ─── Sub-components ──────────────────────────────────────────────────

/** Lightning arc path radiating from center */
const LightningArc = React.memo(function LightningArc({
  angle,
  lengthRatio,
  progress,
  color,
  centerX,
  centerY,
  cardWidth,
}: {
  angle: number;
  lengthRatio: number;
  progress: SharedValue<number>;
  color: string;
  centerX: number;
  centerY: number;
  cardWidth: number;
}) {
  const arcLength = cardWidth * lengthRatio;

  // Pre-compute jagged path segments
  const pathStr = useMemo(() => {
    const segments = 5;
    const segLen = arcLength / segments;
    let d = `M ${centerX} ${centerY}`;
    for (let s = 1; s <= segments; s++) {
      const dist = segLen * s;
      const jag = (((s * 37 + Math.round(angle * 10)) % 20) - 10) * 0.3;
      const px = centerX + Math.cos(angle) * dist + Math.cos(angle + Math.PI / 2) * jag;
      const py = centerY + Math.sin(angle) * dist + Math.sin(angle + Math.PI / 2) * jag;
      d += ` L ${px} ${py}`;
    }
    return d;
  }, [centerX, centerY, angle, arcLength]);

  const animatedProps = useAnimatedProps(() => {
    const p = progress.value;
    let opacity: number;
    if (p < 0.05) opacity = (p / 0.05) * 0.6;
    else if (p < 0.2) opacity = 0.6;
    else opacity = Math.max(0, 0.6 * (1 - (p - 0.2) / 0.3));
    return { opacity };
  });

  return (
    <AnimatedPath
      d={pathStr}
      stroke={color}
      fill="none"
      strokeWidth={1.5}
      filter="url(#arc-blur)"
      animatedProps={animatedProps}
    />
  );
});

// ─── Rune ring as SVG dashed arc path ────────────────────────────────

/** Rotating dashed rune ring */
const RuneRing = React.memo(function RuneRing({
  radius,
  dashOn,
  dashOff,
  strokeWidth,
  rotation,
  appear,
  color,
  centerX,
  centerY,
}: {
  radius: number;
  dashOn: number;
  dashOff: number;
  strokeWidth: number;
  rotation: SharedValue<number>;
  appear: SharedValue<number>;
  color: string;
  centerX: number;
  centerY: number;
}) {
  // Approximate dashed circle using multiple arc segments
  const circumference = 2 * Math.PI * radius;
  const segCount = Math.floor(circumference / (dashOn + dashOff));
  const segAngle = (2 * Math.PI) / Math.max(1, segCount);
  const dashAngle = segAngle * (dashOn / (dashOn + dashOff));

  // Build arc segments as a single Path string
  const pathStr = useMemo(() => {
    let d = '';
    for (let i = 0; i < segCount; i++) {
      const startAngle = i * segAngle;
      const endAngle = startAngle + dashAngle;
      const x1 = centerX + Math.cos(startAngle) * radius;
      const y1 = centerY + Math.sin(startAngle) * radius;
      const x2 = centerX + Math.cos(endAngle) * radius;
      const y2 = centerY + Math.sin(endAngle) * radius;
      d += `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} `;
    }
    return d;
  }, [centerX, centerY, radius, segCount, segAngle, dashAngle]);

  const animatedProps = useAnimatedProps(() => {
    const deg = (rotation.value * Math.PI) / 180;
    return {
      opacity: appear.value * 0.7,
      transform: `translate(${centerX}, ${centerY}) rotate(${(deg * 180) / Math.PI}) translate(${-centerX}, ${-centerY})`,
    };
  });

  return (
    <AnimatedG animatedProps={animatedProps}>
      <Path
        d={pathStr}
        stroke={color}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        filter="url(#rune-blur)"
      />
    </AnimatedG>
  );
});

/** Single orbit particle */
const OrbitParticle: React.FC<{
  particle: (typeof ORBIT_PARTICLES)[number];
  particleOrbit: SharedValue<number>;
  twinkleCycle: SharedValue<number>;
  appear: SharedValue<number>;
  baseRadius: number;
  centerX: number;
  centerY: number;
  cardWidth: number;
  color: string;
}> = React.memo(
  ({
    particle,
    particleOrbit,
    twinkleCycle,
    appear,
    baseRadius,
    centerX,
    centerY,
    cardWidth,
    color,
  }) => {
    const radiusOffset = particle.radiusOffsetRatio * baseRadius;
    const size = Math.max(1, particle.sizeRatio * cardWidth);
    const wiggleAmp = cardWidth * 0.057;

    const animatedProps = useAnimatedProps(() => {
      const angleDeg = particleOrbit.value + particle.phaseOffset;
      const angleRad = (angleDeg * Math.PI) / 180;
      const r = baseRadius + radiusOffset + Math.sin(angleRad * 3) * wiggleAmp;
      const cx = Math.cos(angleRad) * r + centerX;
      const cy = Math.sin(angleRad) * r + centerY + particle.driftY;
      const flicker = 0.5 + 0.5 * Math.sin(twinkleCycle.value + particle.twinklePhase);
      const opacity = appear.value * 0.7 * flicker;
      return { cx, cy, opacity };
    });

    return <AnimatedCircle r={size} fill={color} animatedProps={animatedProps} />;
  },
);
OrbitParticle.displayName = 'OrbitParticle';

// ─── Main component ──────────────────────────────────────────────────

interface ThirdRevealEffectProps {
  cardWidth: number;
  cardHeight: number;
  animate: boolean;
  primaryColor: string;
  glowColor: string;
  particleColor: string;
}

export const ThirdRevealEffect: React.FC<ThirdRevealEffectProps> = ({
  cardWidth,
  cardHeight,
  animate,
  primaryColor,
  glowColor,
  particleColor,
}) => {
  const appear = useSharedValue(0);
  const glowIntensity = useSharedValue(0);
  const progress = useSharedValue(0);
  const outerRotation = useSharedValue(0);
  const innerRotation = useSharedValue(0);
  const particleOrbit = useSharedValue(0);
  const twinkleCycle = useSharedValue(0);
  const corePulse = useSharedValue(0);
  const centerX = cardWidth / 2;
  const centerY = cardHeight * 0.42;

  useEffect(() => {
    if (!animate) return;

    // Main progress 0→1 over 2.5s
    progress.value = withDelay(
      AE.effectStartDelay,
      withTiming(1, { duration: 2500, easing: Easing.out(Easing.quad) }),
    );

    // Elements appear
    appear.value = withDelay(
      AE.effectStartDelay + 300,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) }),
    );

    // Card glow: peak → medium → persist
    glowIntensity.value = withDelay(
      AE.effectStartDelay,
      withSequence(
        withTiming(1, { duration: 375, easing: Easing.out(Easing.cubic) }),
        withTiming(0.6, { duration: 625, easing: Easing.out(Easing.quad) }),
        withTiming(0.3, { duration: 1500, easing: Easing.out(Easing.quad) }),
      ),
    );

    // Outer ring clockwise rotation (12s cycle)
    outerRotation.value = withDelay(
      AE.effectStartDelay,
      withRepeat(
        withTiming(360, { duration: AE.thirdRuneRotationDuration, easing: Easing.linear }),
        -1,
      ),
    );

    // Inner ring counter-clockwise (8s cycle)
    innerRotation.value = withDelay(
      AE.effectStartDelay,
      withRepeat(
        withTiming(-360, { duration: AE.thirdInnerRingDuration, easing: Easing.linear }),
        -1,
      ),
    );

    // Particle orbit (6s cycle)
    particleOrbit.value = withDelay(
      AE.effectStartDelay,
      withRepeat(withTiming(360, { duration: AE.thirdOrbitDuration, easing: Easing.linear }), -1),
    );

    // Twinkle cycle for particle flicker
    twinkleCycle.value = withDelay(
      AE.effectStartDelay,
      withRepeat(withTiming(Math.PI * 2, { duration: 1200, easing: Easing.linear }), -1),
    );

    // Core pulse (continuous breathing)
    corePulse.value = withDelay(
      AE.effectStartDelay + 500,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
      ),
    );
  }, [
    animate,
    appear,
    glowIntensity,
    progress,
    outerRotation,
    innerRotation,
    particleOrbit,
    twinkleCycle,
    corePulse,
  ]);

  // ── Animated props ──
  const glowGroupProps = useAnimatedProps(() => ({
    opacity: glowIntensity.value * 0.65,
  }));
  const glowCircleProps = useAnimatedProps(() => ({
    r: cardWidth * 0.5 * (0.5 + glowIntensity.value * 0.5),
  }));

  // Central energy core pulsating
  const coreGroupProps = useAnimatedProps(() => ({
    opacity: appear.value * (0.4 + corePulse.value * 0.3),
  }));
  const coreOrbProps = useAnimatedProps(() => ({
    r: cardWidth * 0.06 * (0.7 + corePulse.value * 0.3),
  }));
  const coreGlowProps = useAnimatedProps(() => ({
    r: cardWidth * 0.15 * (0.6 + corePulse.value * 0.4),
  }));

  // Outer ring radius: ~60% of cardWidth
  const outerRingR = cardWidth * 0.52;
  // Inner ring: ~85% of outer
  const innerRingR = outerRingR * 0.82;
  const baseRadius = cardWidth * 0.35;

  // Gradient stop colors
  const glowStop1 = `${primaryColor}60`;
  const glowStop2 = `${primaryColor}00`;
  const coreGlowStop1 = `${glowColor}80`;
  const coreGlowStop2 = `${primaryColor}00`;

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
          id="t-glow-grad"
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
          id="t-core-glow-grad"
          cx={centerX}
          cy={centerY}
          r={cardWidth * 0.15}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={coreGlowStop1} />
          <Stop offset="1" stopColor={coreGlowStop2} />
        </RadialGradient>
        <Filter id="t-glow-blur" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={SK.glowBlur} />
        </Filter>
        <Filter id="arc-blur" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={2} />
        </Filter>
        <Filter id="rune-blur" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={1} />
        </Filter>
        <Filter id="core-blur" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={4} />
        </Filter>
        <Filter id="core-glow-blur" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={10} />
        </Filter>
        <Filter id="orbit-blur" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={SK.particleBlur} />
        </Filter>
      </Defs>

      {/* Persistent card glow */}
      <AnimatedG animatedProps={glowGroupProps}>
        <AnimatedCircle
          cx={centerX}
          cy={centerY}
          fill="url(#t-glow-grad)"
          filter="url(#t-glow-blur)"
          animatedProps={glowCircleProps}
        />
      </AnimatedG>

      {/* Lightning arcs — brief flash at reveal */}
      <G>
        {ARCS.map((arc, i) => (
          <LightningArc
            key={i}
            angle={arc.angle}
            lengthRatio={arc.lengthRatio}
            progress={progress}
            color={particleColor}
            centerX={centerX}
            centerY={centerY}
            cardWidth={cardWidth}
          />
        ))}
      </G>

      {/* Outer rune ring — clockwise */}
      <RuneRing
        radius={outerRingR}
        dashOn={6}
        dashOff={12}
        strokeWidth={1}
        rotation={outerRotation}
        appear={appear}
        color={glowColor}
        centerX={centerX}
        centerY={centerY}
      />

      {/* Inner rune ring — counter-clockwise */}
      <RuneRing
        radius={innerRingR}
        dashOn={3}
        dashOff={8}
        strokeWidth={1}
        rotation={innerRotation}
        appear={appear}
        color={primaryColor}
        centerX={centerX}
        centerY={centerY}
      />

      {/* Central energy core */}
      <AnimatedG animatedProps={coreGroupProps}>
        {/* Outer glow */}
        <AnimatedCircle
          cx={centerX}
          cy={centerY}
          fill="url(#t-core-glow-grad)"
          filter="url(#core-glow-blur)"
          animatedProps={coreGlowProps}
        />
        {/* Core orb */}
        <AnimatedCircle
          cx={centerX}
          cy={centerY}
          fill={glowColor}
          filter="url(#core-blur)"
          animatedProps={coreOrbProps}
        />
      </AnimatedG>

      {/* Orbit particles */}
      <G filter="url(#orbit-blur)">
        {ORBIT_PARTICLES.map((particle, i) => (
          <OrbitParticle
            key={i}
            particle={particle}
            particleOrbit={particleOrbit}
            twinkleCycle={twinkleCycle}
            appear={appear}
            baseRadius={baseRadius}
            centerX={centerX}
            centerY={centerY}
            cardWidth={cardWidth}
            color={particleColor}
          />
        ))}
      </G>
    </Svg>
  );
};
