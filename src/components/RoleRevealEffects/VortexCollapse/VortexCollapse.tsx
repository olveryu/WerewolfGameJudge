/**
 * VortexCollapse - 虚空坍缩揭示动画（Skia + Reanimated 4 + Gesture Handler）
 *
 * 视觉设计：星际穿越 / 黑洞风格 — 深空背景 + 星云 + 旋涡中心 + 事件视界 +
 * 螺旋臂 + 80 轨道粒子 + 20 碎片 + 进度环 + 坍缩爆炸粒子。
 * 交互：画圈手势驱动旋转加速，spin 累计达 100% → 临界坍缩 → 爆发揭示。
 *
 * Skia 负责：深空 + 星云 + 事件视界 + 螺旋臂 + 轨道粒子/碎片 + 进度环 + 爆炸粒子。
 * Reanimated 负责：阶段切换 + 卡片入场。
 * Gesture Handler 负责：`Gesture.Pan()` 画圈累加 spin。
 * 不 import service，不含业务逻辑。
 */
import {
  Blur,
  Canvas,
  Circle,
  Group,
  Path,
  RadialGradient,
  Rect,
  vec,
} from '@shopify/react-native-skia';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  Easing,
  makeMutable,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AlignmentRevealOverlay } from '@/components/RoleRevealEffects/common/AlignmentRevealOverlay';
import { RevealBurst } from '@/components/RoleRevealEffects/common/effects/RevealBurst';
import { HintWithWarning } from '@/components/RoleRevealEffects/common/HintWithWarning';
import { RoleCardContent } from '@/components/RoleRevealEffects/common/RoleCardContent';
import { CONFIG } from '@/components/RoleRevealEffects/config';
import {
  useAutoTimeout,
  useRevealLifecycle,
} from '@/components/RoleRevealEffects/hooks/useRevealLifecycle';
import type { RoleRevealEffectProps } from '@/components/RoleRevealEffects/types';
import { createAlignmentThemes } from '@/components/RoleRevealEffects/types';
import { triggerHaptic } from '@/components/RoleRevealEffects/utils/haptics';
import { useColors } from '@/theme';

// ─── Visual constants ──────────────────────────────────────────────────
const BG_GRADIENT = ['#030008', '#050012', '#030008'] as const;

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;

const VC = CONFIG.vortexCollapse;

function hslString(h: number, s: number, l: number, a: number) {
  return `hsla(${h},${s}%,${l}%,${a})`;
}

// ─── Pre-computed static data ──────────────────────────────────────────

/** Background stars */
const BG_STARS = Array.from({ length: 60 }, (_, i) => ({
  x: (Math.sin(i * 7.7) * 0.5 + 0.5) * SCREEN_W,
  y: (Math.cos(i * 4.3) * 0.5 + 0.5) * SCREEN_H,
  phase: i,
}));

/** Nebula clouds (static positions) */
const NEBULAE = [
  { x: SCREEN_W * 0.3, y: SCREEN_H * 0.3, r: 200, hue: 260 },
  { x: SCREEN_W * 0.7, y: SCREEN_H * 0.6, r: 180, hue: 300 },
  { x: SCREEN_W * 0.5, y: SCREEN_H * 0.2, r: 150, hue: 230 },
];

/** Orbital particles */
const ORBITAL_PARTICLES = Array.from({ length: VC.particleCount }, (_, i) => {
  const r1 = ((i * 73 + 17) % 1000) / 1000;
  const r2 = ((i * 41 + 31) % 1000) / 1000;
  const r3 = ((i * 59 + 7) % 1000) / 1000;
  const r4 = ((i * 83 + 11) % 1000) / 1000;
  const r5 = ((i * 97 + 53) % 1000) / 1000;
  return {
    angle: r1 * Math.PI * 2,
    dist: 40 + r2 * 140,
    speed: 0.5 + r3 * 1.5,
    radius: 1 + r4 * 2.5,
    hue: 200 + r5 * 100,
    alpha: 0.3 + r4 * 0.5,
  };
});

/** Debris chunks */
const DEBRIS_CHUNKS = Array.from({ length: VC.debrisCount }, (_, i) => {
  const r1 = ((i * 43 + 19) % 1000) / 1000;
  const r2 = ((i * 67 + 37) % 1000) / 1000;
  const r3 = ((i * 89 + 13) % 1000) / 1000;
  const r4 = ((i * 31 + 53) % 1000) / 1000;
  return {
    angle: r1 * Math.PI * 2,
    dist: 100 + r2 * 150,
    speed: 0.3 + r3 * 0.9,
    size: 3 + r4 * 5,
    hue: 20 + ((i * 17) % 30),
    alpha: 0.2 + r4 * 0.3,
  };
});

/** Burst explosion particles */
const BURST_PARTICLES = Array.from({ length: VC.burstParticleCount }, (_, i) => {
  const angle = (((i * 73 + 17) % 1000) / 1000) * Math.PI * 2;
  const speed = 4 + ((i * 31) % 100) / 10;
  const r1 = ((i * 43 + 19) % 100) / 100;
  return {
    id: i,
    angle,
    speed,
    radius: 2 + r1 * 4,
    hue: 200 + ((i * 17) % 120),
    decayRate: 0.008 + r1 * 0.01,
  };
});

// ─── Types ──────────────────────────────────────────────────────────────
type Phase = 'atmosphere' | 'idle' | 'collapse' | 'revealed';

// ─── Sub-components ─────────────────────────────────────────────────────

/** Nebula glow cloud */
interface NebulaCloudProps {
  nebula: (typeof NEBULAE)[number];
  time: SharedValue<number>;
}

const NebulaCloud: React.FC<NebulaCloudProps> = React.memo(({ nebula, time }) => {
  const opacity = useDerivedValue(() => 0.08 + Math.sin(time.value * 0.3 + nebula.hue) * 0.03);

  return (
    <Circle cx={nebula.x} cy={nebula.y} r={nebula.r} opacity={opacity}>
      <RadialGradient
        c={vec(nebula.x, nebula.y)}
        r={nebula.r}
        colors={[
          hslString(nebula.hue, 60, 20, 0.08),
          hslString(nebula.hue, 40, 15, 0.03),
          'transparent',
        ]}
        positions={[0, 0.5, 1]}
      />
    </Circle>
  );
});
NebulaCloud.displayName = 'NebulaCloud';

/** Background star with twinkle */
interface BgStarProps {
  star: (typeof BG_STARS)[number];
  time: SharedValue<number>;
}

const BgStar: React.FC<BgStarProps> = React.memo(({ star, time }) => {
  const opacity = useDerivedValue(() => 0.15 + Math.sin(time.value * 2 + star.phase) * 0.1);

  return (
    <Rect
      x={star.x}
      y={star.y}
      width={1}
      height={1}
      color="rgba(180,180,220,0.3)"
      opacity={opacity}
    />
  );
});
BgStar.displayName = 'BgStar';

/** Burst particle */
interface BurstParticleProps {
  particle: (typeof BURST_PARTICLES)[number];
  cx: number;
  cy: number;
  progress: SharedValue<number>;
}

const BurstParticle: React.FC<BurstParticleProps> = React.memo(({ particle, cx, cy, progress }) => {
  const px = useDerivedValue(
    () => cx + Math.cos(particle.angle) * particle.speed * 25 * progress.value,
  );
  const py = useDerivedValue(() => {
    const linearY = cy + Math.sin(particle.angle) * particle.speed * 25 * progress.value;
    return linearY + progress.value * progress.value * 15;
  });
  const opacity = useDerivedValue(() => {
    const p = progress.value;
    if (p < 0.1) return p / 0.1;
    return Math.max(0, 1 - (p - 0.1) / 0.9);
  });
  const r = useDerivedValue(() => particle.radius * Math.max(0, 1 - progress.value * 0.5));
  const glowR = useDerivedValue(() => r.value * 2);

  const color = hslString(particle.hue, 80, 60, 1);
  const glowColor = hslString(particle.hue, 80, 60, 0.25);

  return (
    <Group opacity={opacity}>
      <Circle cx={px} cy={py} r={r} color={color} />
      <Circle cx={px} cy={py} r={glowR} color={glowColor}>
        <Blur blur={3} />
      </Circle>
    </Group>
  );
});
BurstParticle.displayName = 'BurstParticle';

/** Debris chunk with derived position */
interface DebrisChunkProps {
  debris: (typeof DEBRIS_CHUNKS)[number];
  xSV: SharedValue<number>;
  ySV: SharedValue<number>;
  opacitySV: SharedValue<number>;
}

const DebrisChunk: React.FC<DebrisChunkProps> = React.memo(({ debris, xSV, ySV, opacitySV }) => {
  const x = useDerivedValue(() => xSV.value - debris.size / 2);
  const y = useDerivedValue(() => ySV.value - debris.size / 2);

  return (
    <Rect
      x={x}
      y={y}
      width={debris.size}
      height={debris.size}
      color={hslString(debris.hue, 40, 30, 1)}
      opacity={opacitySV}
    />
  );
});
DebrisChunk.displayName = 'DebrisChunk';

// ─── Main component ─────────────────────────────────────────────────────

export const VortexCollapse: React.FC<RoleRevealEffectProps> = ({
  role,
  onComplete,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'vortex-collapse',
}) => {
  const themeColors = useColors();
  const alignmentThemes = useMemo(() => createAlignmentThemes(themeColors), [themeColors]);
  const theme = alignmentThemes[role.alignment];

  const common = CONFIG.common;
  const cardWidth = Math.min(SCREEN_W * common.cardWidthRatio, common.cardMaxWidth);
  const cardHeight = cardWidth * common.cardAspectRatio;

  const cx = SCREEN_W / 2;
  const cy = SCREEN_H * 0.45;

  const [phase, setPhase] = useState<Phase>('atmosphere');
  const { fireComplete } = useRevealLifecycle({
    onComplete,
    revealHoldDurationMs: VC.revealHoldDuration,
  });

  // ── Spin tracking (JS-side for rAF loop, shared value for progress ring) ──
  const spinRef = useRef(0);
  const spinVelRef = useRef(0);
  const collapsedRef = useRef(false);
  const lastAngleRef = useRef<number | null>(null);
  const spinSV = useSharedValue(0); // 0..1 for progress display
  const rafRef = useRef<number | null>(null);
  const t0Ref = useRef(0);

  // ── Animation shared values ──
  const timeSV = useSharedValue(0);
  const burstProgress = useSharedValue(0);
  const canvasOpacity = useSharedValue(1);
  const cardScale = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const flashOpacity = useSharedValue(0);

  // ── Particle state (mutated in rAF) ──
  const particlesRef = useRef(ORBITAL_PARTICLES.map((p) => ({ ...p })));
  const debrisRef = useRef(DEBRIS_CHUNKS.map((d) => ({ ...d })));

  // ── Skia shared values for rAF-driven rendering ──
  // Vortex center glow
  const vortexGlowR = useSharedValue(60);
  const vortexGlowOpacity = useSharedValue(0.4);
  const eventHorizonR = useSharedValue(12);
  const eventHorizonRingR = useSharedValue(14);
  const eventHorizonRingOpacity = useSharedValue(0.3);

  // Spiral arm paths (3 arms, rebuilt each frame)
  const spiralPathSV = useSharedValue('');

  // Orbital particle positions (flat arrays for Skia)
  const particleXSV = useRef(ORBITAL_PARTICLES.map(() => makeMutable(0))).current;
  const particleYSV = useRef(ORBITAL_PARTICLES.map(() => makeMutable(0))).current;
  const particleOpacitySV = useRef(ORBITAL_PARTICLES.map((p) => makeMutable(p.alpha))).current;

  // Debris positions
  const debrisXSV = useRef(DEBRIS_CHUNKS.map(() => makeMutable(0))).current;
  const debrisYSV = useRef(DEBRIS_CHUNKS.map(() => makeMutable(0))).current;
  const debrisOpacitySV = useRef(DEBRIS_CHUNKS.map((d) => makeMutable(d.alpha))).current;

  // Progress ring
  const progressArcPath = useSharedValue('');
  const progressPercent = useSharedValue('0%');

  // ── Phase transitions ──
  const enterRevealed = useCallback(() => setPhase('revealed'), []);

  const doCollapse = useCallback(() => {
    if (collapsedRef.current) return;
    collapsedRef.current = true;
    setPhase('collapse');

    if (enableHaptics) triggerHaptic('heavy', true);

    // Flash
    flashOpacity.value = withSequence(
      withTiming(0.8, { duration: 100 }),
      withTiming(0, { duration: 500 }),
    );

    // Burst particles
    burstProgress.value = withTiming(1, {
      duration: VC.burstDuration,
      easing: Easing.out(Easing.cubic),
    });

    // Fade canvas
    canvasOpacity.value = withDelay(200, withTiming(0, { duration: 400 }));

    // Card reveal
    cardScale.value = withDelay(
      VC.cardRevealDelay,
      withTiming(
        1,
        {
          duration: VC.cardRevealDuration,
          easing: Easing.out(Easing.back(1.15)),
        },
        (finished) => {
          'worklet';
          if (finished) runOnJS(enterRevealed)();
        },
      ),
    );
    cardOpacity.value = withDelay(
      VC.cardRevealDelay,
      withTiming(1, { duration: VC.cardRevealDuration }),
    );
  }, [
    enableHaptics,
    flashOpacity,
    burstProgress,
    canvasOpacity,
    cardScale,
    cardOpacity,
    enterRevealed,
  ]);

  // ── Build spiral arm path ──
  const buildSpiralPath = useCallback(
    (totalSpin: number, intensity: number): string => {
      let d = '';
      for (let arm = 0; arm < 3; arm++) {
        for (let s = 0; s < 80; s++) {
          const a = totalSpin + arm * ((Math.PI * 2) / 3) + s * 0.08;
          const dist = 15 + s * (1.5 + intensity);
          const px = cx + Math.cos(a) * dist;
          const py = cy + Math.sin(a) * dist;
          if (s === 0) d += `M${px} ${py} `;
          else d += `L${px} ${py} `;
        }
      }
      return d;
    },
    [cx, cy],
  );

  // ── Build progress arc SVG path ──
  const buildProgressArc = useCallback(
    (progress: number): string => {
      if (progress <= 0) return '';
      const ringCy = cy + 140;
      const r = 30;
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + progress * Math.PI * 2;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = ringCy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = ringCy + r * Math.sin(endAngle);
      const largeArc = progress > 0.5 ? 1 : 0;
      return `M${x1} ${y1} A${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
    },
    [cx, cy],
  );

  // ── rAF loop ──
  const updateLoop = useCallback(
    (timestamp: number) => {
      if (collapsedRef.current) return;

      const t = (timestamp - t0Ref.current) / 1000;
      timeSV.value = t;

      // Decay spin velocity
      spinVelRef.current *= 0.96;
      const totalSpin = t * 0.5 + spinVelRef.current * 20;
      const intensity = Math.min(1, spinRef.current / VC.collapseThreshold);

      // Update shared value for UI
      spinSV.value = intensity;

      // Vortex center glow
      vortexGlowR.value = 60 + intensity * 40;
      vortexGlowOpacity.value = 0.4 + intensity * 0.3;
      eventHorizonR.value = 12 + intensity * 8;
      eventHorizonRingR.value = 14 + intensity * 8;
      eventHorizonRingOpacity.value = 0.3 + intensity * 0.4;

      // Spiral arms
      spiralPathSV.value = buildSpiralPath(totalSpin, intensity);

      // Update orbital particles
      const particles = particlesRef.current;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.angle += (p.speed + spinVelRef.current) * 0.02;
        const pullD = Math.max(10, p.dist - intensity * 1.5);
        p.dist += (pullD - p.dist) * 0.01;
        particleXSV[i].value = cx + Math.cos(p.angle + totalSpin * 0.3) * p.dist;
        particleYSV[i].value = cy + Math.sin(p.angle + totalSpin * 0.3) * p.dist;
        particleOpacitySV[i].value = p.alpha * (0.5 + intensity * 0.5);
      }

      // Update debris
      const debris = debrisRef.current;
      for (let i = 0; i < debris.length; i++) {
        const d = debris[i];
        d.angle += (d.speed + spinVelRef.current * 0.5) * 0.015;
        debrisXSV[i].value = cx + Math.cos(d.angle + totalSpin * 0.2) * d.dist;
        debrisYSV[i].value = cy + Math.sin(d.angle + totalSpin * 0.2) * d.dist;
      }

      // Progress arc
      progressArcPath.value = buildProgressArc(intensity);
      progressPercent.value = Math.round(intensity * 100) + '%';

      rafRef.current = requestAnimationFrame(updateLoop);
    },
    [
      timeSV,
      spinSV,
      vortexGlowR,
      vortexGlowOpacity,
      eventHorizonR,
      eventHorizonRingR,
      eventHorizonRingOpacity,
      spiralPathSV,
      particleXSV,
      particleYSV,
      particleOpacitySV,
      debrisXSV,
      debrisYSV,
      progressArcPath,
      progressPercent,
      cx,
      cy,
      buildSpiralPath,
      buildProgressArc,
    ],
  );

  // ── Init ──
  useEffect(() => {
    if (reducedMotion) {
      cardScale.value = 1;
      cardOpacity.value = 1;
      canvasOpacity.value = 0;
      setPhase('revealed');
      return;
    }

    t0Ref.current = performance.now();

    // Time cycle for nebula/star twinkle
    timeSV.value = withRepeat(
      withTiming(1000, { duration: 1000 * 1000, easing: Easing.linear }),
      -1,
    );

    // Atmosphere → idle
    const timer = setTimeout(() => {
      setPhase('idle');
      rafRef.current = requestAnimationFrame(updateLoop);
    }, VC.atmosphereDuration);

    return () => {
      clearTimeout(timer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [reducedMotion, timeSV, cardScale, cardOpacity, canvasOpacity, updateLoop]);

  // ── Auto-timeout ──
  const autoTrigger = useCallback(() => {
    spinRef.current = VC.collapseThreshold;
    spinSV.value = 1;
    doCollapse();
  }, [spinSV, doCollapse]);
  const autoTimeoutWarning = useAutoTimeout(phase === 'idle', autoTrigger);

  // ── Pan gesture callbacks (named for runOnJS) ──
  const handlePanUpdate = useCallback(
    (angle: number) => {
      if (phase !== 'idle') return;
      if (lastAngleRef.current !== null) {
        let delta = angle - lastAngleRef.current;
        if (delta > Math.PI) delta -= Math.PI * 2;
        if (delta < -Math.PI) delta += Math.PI * 2;
        spinVelRef.current += Math.abs(delta) * 0.015;
        spinRef.current += Math.abs(delta) / (Math.PI * 2);

        if (enableHaptics && spinRef.current % 0.1 < 0.02) {
          triggerHaptic('light', true);
        }

        if (spinRef.current >= VC.collapseThreshold && !collapsedRef.current) {
          doCollapse();
        }
      }
      lastAngleRef.current = angle;
    },
    [phase, enableHaptics, doCollapse],
  );

  const handlePanEnd = useCallback(() => {
    lastAngleRef.current = null;
  }, []);

  // ── Pan gesture (draw circles) ──
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onUpdate((e) => {
          'worklet';
          const dx = e.x - cx;
          const dy = e.y - cy;
          const currentAngle = Math.atan2(dy, dx);
          runOnJS(handlePanUpdate)(currentAngle);
        })
        .onEnd(() => {
          'worklet';
          runOnJS(handlePanEnd)();
        })
        .enabled(phase === 'idle'),
    [cx, cy, phase, handlePanUpdate, handlePanEnd],
  );

  // ── Animated styles ──
  const canvasContainerStyle = useAnimatedStyle(() => ({
    opacity: canvasOpacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  return (
    <View style={styles.container} testID={`${testIDPrefix}-container`}>
      {/* Deep space background */}
      <LinearGradient
        colors={[...BG_GRADIENT]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <GestureDetector gesture={panGesture}>
        <Animated.View style={[StyleSheet.absoluteFill, canvasContainerStyle]}>
          <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            {/* ── Nebula clouds ── */}
            {NEBULAE.map((n, i) => (
              <NebulaCloud key={`neb-${i}`} nebula={n} time={timeSV} />
            ))}

            {/* ── Background stars ── */}
            {BG_STARS.map((s, i) => (
              <BgStar key={`bstar-${i}`} star={s} time={timeSV} />
            ))}

            {/* ── Vortex center glow ── */}
            <Circle cx={cx} cy={cy} r={vortexGlowR} opacity={vortexGlowOpacity}>
              <RadialGradient
                c={vec(cx, cy)}
                r={100}
                colors={[hslString(270, 80, 60, 0.4), hslString(260, 70, 40, 0.15), 'transparent']}
                positions={[0, 0.3, 1]}
              />
            </Circle>

            {/* ── Event horizon (black center) ── */}
            <Circle cx={cx} cy={cy} r={eventHorizonR} color="#000000" />
            <Circle
              cx={cx}
              cy={cy}
              r={eventHorizonRingR}
              style="stroke"
              strokeWidth={2}
              color={hslString(270, 90, 70, 0.5)}
              opacity={eventHorizonRingOpacity}
            />

            {/* ── Spiral arms ── */}
            <Path
              path={spiralPathSV}
              style="stroke"
              strokeWidth={2}
              color={hslString(260, 60, 60, 0.12)}
            />

            {/* ── Orbital particles ── */}
            {ORBITAL_PARTICLES.map((_, i) => (
              <Circle
                key={`op-${i}`}
                cx={particleXSV[i]}
                cy={particleYSV[i]}
                r={ORBITAL_PARTICLES[i].radius}
                color={hslString(ORBITAL_PARTICLES[i].hue, 70, 60, 1)}
                opacity={particleOpacitySV[i]}
              />
            ))}

            {/* ── Debris chunks ── */}
            {DEBRIS_CHUNKS.map((d, i) => (
              <DebrisChunk
                key={`deb-${i}`}
                debris={d}
                xSV={debrisXSV[i]}
                ySV={debrisYSV[i]}
                opacitySV={debrisOpacitySV[i]}
              />
            ))}

            {/* ── Progress ring ── */}
            <Circle
              cx={cx}
              cy={cy + 140}
              r={30}
              style="stroke"
              strokeWidth={1}
              color="rgba(150,100,255,0.2)"
            />
            <Path
              path={progressArcPath}
              style="stroke"
              strokeWidth={3}
              color={hslString(270, 80, 70, 0.6)}
              strokeCap="round"
            />

            {/* ── Burst particles (on collapse) ── */}
            {phase === 'collapse' &&
              BURST_PARTICLES.map((p) => (
                <BurstParticle
                  key={`bp-${p.id}`}
                  particle={p}
                  cx={cx}
                  cy={cy}
                  progress={burstProgress}
                />
              ))}
          </Canvas>

          {/* Progress percent text (RN for crisp rendering) */}
          {phase === 'idle' && (
            <View
              style={[styles.percentContainer, { top: cy + 130, left: cx - 30 }]}
              pointerEvents="none"
            >
              <Animated.Text style={styles.percentText}>
                {/* Driven by progressPercent string via polling — simplified to static for now */}
              </Animated.Text>
            </View>
          )}
        </Animated.View>
      </GestureDetector>

      {/* Flash overlay */}
      <Animated.View style={[styles.flash, flashStyle, styles.flashBg]} pointerEvents="none" />

      {/* Hint */}
      <HintWithWarning
        hintText={
          phase === 'atmosphere'
            ? '🌀 虚空凝聚中…'
            : phase === 'idle'
              ? '🌀 画圈加速旋转漩涡'
              : phase === 'collapse'
                ? '💥 虚空坍缩！'
                : null
        }
        showWarning={autoTimeoutWarning}
      />

      {/* Revealed card */}
      {(phase === 'collapse' || phase === 'revealed') && (
        <Animated.View style={[styles.cardWrapper, cardStyle]}>
          <View style={styles.cardInner}>
            <RoleCardContent
              roleId={role.id as RoleId}
              width={cardWidth}
              height={cardHeight}
              revealMode
              revealGradient={theme.revealGradient}
              animateEntrance={phase === 'revealed'}
            />
            <RevealBurst trigger={phase === 'revealed'} color={theme.glowColor} />
            {phase === 'revealed' && (
              <AlignmentRevealOverlay
                alignment={role.alignment}
                theme={theme}
                cardWidth={cardWidth}
                cardHeight={cardHeight}
                animate={!reducedMotion}
                onComplete={fireComplete}
              />
            )}
          </View>
        </Animated.View>
      )}
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  flash: { ...StyleSheet.absoluteFillObject },
  flashBg: { backgroundColor: 'rgba(150,100,255,0.8)' },
  cardWrapper: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInner: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  percentContainer: {
    position: 'absolute',
    width: 60,
    alignItems: 'center',
  },
  percentText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
});
