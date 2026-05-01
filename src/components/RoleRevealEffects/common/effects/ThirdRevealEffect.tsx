/**
 * ThirdRevealEffect — 第三方阵营揭示特效（Skia + Reanimated 4）
 *
 * 翻牌后在卡片区域渲染神秘系列动画：
 * 1. 卡片光晕 — Skia RadialGradient + Blur，极亮爆发→持续微弱紫色发光
 * 2. 旋转符文环（2 层）— Skia Circle stroke + dashPathEffect，持续旋转
 * 3. 螺旋轨道粒子（30 颗）— Skia Circle + Blur + blendMode="screen"，绕中心公转
 * 4. 召唤闪电弧（6 条）— Skia Path + Blur，从中心向外辐射的电弧
 * 5. 中心能量核心 — Skia Circle + RadialGradient + Blur 脉动
 *
 * 符文环和粒子持续循环，光晕持续保留。
 * 不 import service，不含业务逻辑。
 */
import {
  Blur,
  Canvas,
  Circle,
  Group,
  Paint,
  Path,
  Picture,
  RadialGradient,
  Skia,
  vec,
} from '@shopify/react-native-skia';
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

import { CONFIG } from '@/components/RoleRevealEffects/config';
const AE = CONFIG.alignmentEffects;
const SK = CONFIG.skia;

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

// ── Immediate-mode Skia resources (reused across frames) ──
const orbitRecorder = Skia.PictureRecorder();
const orbitPaint = Skia.Paint();

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

  const opacity = useDerivedValue(() => {
    const p = progress.value;
    if (p < 0.05) return (p / 0.05) * 0.6;
    if (p < 0.2) return 0.6;
    return Math.max(0, 0.6 * (1 - (p - 0.2) / 0.3));
  });

  return (
    <Path path={pathStr} color={color} style="stroke" strokeWidth={1.5} opacity={opacity}>
      <Blur blur={2} />
    </Path>
  );
});

// ─── Rune ring as Skia circle stroke ─────────────────────────────────

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

  const opacity = useDerivedValue(() => appear.value * 0.7);

  // Rotation is applied via Group transform
  const transform = useDerivedValue(() => [{ rotate: (rotation.value * Math.PI) / 180 }]);

  return (
    <Group transform={transform} origin={vec(centerX, centerY)} opacity={opacity}>
      <Path path={pathStr} color={color} style="stroke" strokeWidth={strokeWidth} strokeCap="round">
        <Blur blur={1} />
      </Path>
    </Group>
  );
});

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

  // ── Derived values ──
  const glowR = useDerivedValue(() => cardWidth * 0.5 * (0.5 + glowIntensity.value * 0.5));
  const glowOpacity = useDerivedValue(() => glowIntensity.value * 0.65);

  // Central energy core pulsating
  const coreR = useDerivedValue(() => cardWidth * 0.06 * (0.7 + corePulse.value * 0.3));
  const coreGlowR = useDerivedValue(() => cardWidth * 0.15 * (0.6 + corePulse.value * 0.4));
  const coreOpacity = useDerivedValue(() => appear.value * (0.4 + corePulse.value * 0.3));

  // Outer ring radius: ~60% of cardWidth
  const outerRingR = cardWidth * 0.52;
  // Inner ring: ~85% of outer
  const innerRingR = outerRingR * 0.82;

  // ── Orbit particles: Immediate Mode via Picture API ──
  // Replaces 30 OrbitParticle components (90 useDerivedValue per frame) with 1.
  const baseRadius = cardWidth * 0.35;
  const orbitPicture = useDerivedValue(() => {
    'worklet';
    const c = orbitRecorder.beginRecording(Skia.XYWHRect(0, 0, cardWidth, cardHeight));
    const skColor = Skia.Color(particleColor);
    for (let i = 0; i < ORBIT_PARTICLES.length; i++) {
      const p = ORBIT_PARTICLES[i]!;
      const radiusOffset = p.radiusOffsetRatio * baseRadius;
      const size = Math.max(1, p.sizeRatio * cardWidth);
      const wiggleAmp = cardWidth * 0.057;
      const angleDeg = particleOrbit.value + p.phaseOffset;
      const angleRad = (angleDeg * Math.PI) / 180;
      const r = baseRadius + radiusOffset + Math.sin(angleRad * 3) * wiggleAmp;
      const cx = Math.cos(angleRad) * r + centerX;
      const cy = Math.sin(angleRad) * r + centerY + p.driftY;
      const flicker = 0.5 + 0.5 * Math.sin(twinkleCycle.value + p.twinklePhase);
      const opacity = appear.value * 0.7 * flicker;
      orbitPaint.setColor(skColor);
      orbitPaint.setAlphaf(opacity);
      c.drawCircle(cx, cy, size, orbitPaint);
    }
    return orbitRecorder.finishRecordingAsPicture();
  });

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
    <Canvas style={canvasStyle}>
      {/* Persistent card glow */}
      <Group opacity={glowOpacity}>
        <Circle cx={centerX} cy={centerY} r={glowR}>
          <RadialGradient
            c={vec(centerX, centerY)}
            r={cardWidth * 0.5}
            colors={[glowColor, `${primaryColor}60`, `${primaryColor}00`]}
          />
          <Blur blur={SK.glowBlur} />
        </Circle>
      </Group>

      {/* Lightning arcs — brief flash at reveal */}
      <Group blendMode="screen">
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
      </Group>

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
      <Group opacity={coreOpacity}>
        {/* Outer glow */}
        <Circle cx={centerX} cy={centerY} r={coreGlowR}>
          <RadialGradient
            c={vec(centerX, centerY)}
            r={cardWidth * 0.15}
            colors={[`${glowColor}80`, `${primaryColor}00`]}
          />
          <Blur blur={10} />
        </Circle>
        {/* Core orb */}
        <Circle cx={centerX} cy={centerY} r={coreR} color={glowColor}>
          <Blur blur={4} />
        </Circle>
      </Group>

      {/* Orbit particles — Picture API with group-level blur */}
      <Group
        blendMode="screen"
        layer={
          <Paint>
            <Blur blur={SK.particleBlur} />
          </Paint>
        }
      >
        <Picture picture={orbitPicture} />
      </Group>
    </Canvas>
  );
};
