/**
 * GodRevealEffect — 神职阵营揭示特效（Skia + Reanimated 4）
 *
 * 翻牌后在卡片区域渲染圣光系列动画：
 * 1. 卡片光晕 — Skia RadialGradient + Blur，极亮爆发→持续微弱金色发光
 * 2. 天降光柱 — Skia 从卡片顶部向上延伸的锥形光束（blendMode="screen"）
 * 3. 十字闪光 — Skia Rect + Blur + screen blend，快闪后消失
 * 4. 光环绽放 — 4 层同心 Circle stroke + Blur 从中心扩散
 * 5. 圣光粒子 — 24 颗金色光尘 + Blur 从中心向四周飘散
 * 6. 底部光晕 — 地面反射的半圆形柔光
 *
 * 情绪签名：瞬间爆发 + "divine intervention" 力量感。
 * 不 import service，不含业务逻辑。
 */
import {
  Blur,
  Canvas,
  Circle,
  Group,
  Paint,
  Picture,
  RadialGradient,
  Rect,
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

// ── Immediate-mode Skia resources (reused across frames) ──
const godParticleRecorder = Skia.PictureRecorder();
const godParticlePaint = Skia.Paint();

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

  const r = useDerivedValue(() => {
    const p = progress.value;
    const lp = Math.min(1, Math.max(0, (p - startP) / (endP - startP)));
    return lp * maxR;
  });
  const opacity = useDerivedValue(() => {
    const p = progress.value;
    const lp = Math.min(1, Math.max(0, (p - startP) / (endP - startP)));
    if (lp < 0.3) return 0.8;
    return Math.max(0, 0.8 * (1 - (lp - 0.3) / 0.7));
  });

  return (
    <Circle
      cx={centerX}
      cy={centerY}
      r={r}
      color={color}
      style="stroke"
      strokeWidth={2}
      opacity={opacity}
    >
      <Blur blur={6} />
    </Circle>
  );
});

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

  // ── Derived values ──
  const glowR = useDerivedValue(() => cardWidth * 0.5 * (0.5 + glowIntensity.value * 0.5));
  const glowOpacity = useDerivedValue(() => glowIntensity.value * 0.7);

  // Light pillar (tapers upward from card top)
  const pillarOpacity = useDerivedValue(() => {
    const p = progress.value;
    if (p < 0.05) return p / 0.05;
    if (p < 0.3) return 1;
    return Math.max(0.15, 1 - (p - 0.3) / 0.7);
  });
  const pillarHeight = useDerivedValue(() => {
    const p = progress.value;
    return Math.min(1, p / 0.15) * cardHeight * 0.8;
  });

  // Cross flash
  const crossOpacity = useDerivedValue(() => {
    const p = progress.value;
    if (p < 0.08) return p / 0.08;
    return Math.max(0, 1 - (p - 0.08) / 0.3);
  });
  const crossScaleXTransform = useDerivedValue(() => [
    { scaleX: Math.min(2, (progress.value / 0.08) * 2) },
  ]);
  const crossScaleYTransform = useDerivedValue(() => [
    { scaleY: Math.min(2, (progress.value / 0.08) * 2) },
  ]);

  // Bottom ground glow
  const groundOpacity = useDerivedValue(() => {
    const p = progress.value;
    if (p < 0.2) return (p / 0.2) * 0.25;
    return 0.25;
  });

  const barThickness = Math.max(3, cardWidth * 0.025);

  // ── Gold sparkle particles: Immediate Mode via Picture API ──
  // Replaces 24 GodParticle components (72 useDerivedValue per frame) with 1.
  const particlePicture = useDerivedValue(() => {
    'worklet';
    const c = godParticleRecorder.beginRecording(Skia.XYWHRect(0, 0, cardWidth, cardHeight));
    const skColor = Skia.Color(particleColor);
    for (let i = 0; i < GOD_PARTICLES.length; i++) {
      const p = GOD_PARTICLES[i];
      const startX = centerX + Math.cos(p.angle) * p.dist * 0.3;
      const startY = centerY + Math.sin(p.angle) * p.dist * 0.3;
      const cx = startX + p.driftX * particleProgress.value;
      const cy = startY + p.driftY * particleProgress.value;
      const life = 1 - particleProgress.value;
      if (life <= 0) continue;
      const flicker = 0.5 + 0.5 * Math.sin(twinkleCycle.value + p.twinklePhase);
      const opacity = p.baseAlpha * life * flicker;
      godParticlePaint.setColor(skColor);
      godParticlePaint.setAlphaf(opacity);
      c.drawCircle(cx, cy, p.size, godParticlePaint);
    }
    return godParticleRecorder.finishRecordingAsPicture();
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
            r={cardWidth * 0.5}
            colors={[glowColor, `${primaryColor}60`, `${primaryColor}00`]}
          />
          <Blur blur={SK.glowBlur} />
        </Circle>
      </Group>

      {/* Light pillar — upward from card center */}
      <Group opacity={pillarOpacity} blendMode="screen">
        <Rect
          x={centerX - cardWidth * 0.15}
          y={0}
          width={cardWidth * 0.3}
          height={pillarHeight}
          color={primaryColor}
        >
          <Blur blur={15} />
        </Rect>
      </Group>

      {/* Cross flash — horizontal */}
      <Group
        opacity={crossOpacity}
        transform={crossScaleXTransform}
        origin={vec(centerX, centerY)}
        blendMode="screen"
      >
        <Rect
          x={centerX - cardWidth}
          y={centerY - barThickness / 2}
          width={cardWidth * 2}
          height={barThickness}
          color={particleColor}
        >
          <Blur blur={10} />
        </Rect>
      </Group>

      {/* Cross flash — vertical */}
      <Group
        opacity={crossOpacity}
        transform={crossScaleYTransform}
        origin={vec(centerX, centerY)}
        blendMode="screen"
      >
        <Rect
          x={centerX - barThickness / 2}
          y={centerY - cardHeight}
          width={barThickness}
          height={cardHeight * 2}
          color={particleColor}
        >
          <Blur blur={10} />
        </Rect>
      </Group>

      {/* Expanding halos (4 layers) */}
      <Group blendMode="screen">
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
      </Group>

      {/* Bottom ground glow */}
      <Group opacity={groundOpacity}>
        <Circle cx={centerX} cy={cardHeight} r={cardWidth * 0.6}>
          <RadialGradient
            c={vec(centerX, cardHeight)}
            r={cardWidth * 0.6}
            colors={[`${primaryColor}40`, `${primaryColor}00`]}
          />
          <Blur blur={20} />
        </Circle>
      </Group>

      {/* Gold sparkle particles — Picture API with group-level blur */}
      <Group
        blendMode="screen"
        layer={
          <Paint>
            <Blur blur={SK.particleBlur} />
          </Paint>
        }
      >
        <Picture picture={particlePicture} />
      </Group>
    </Canvas>
  );
};
