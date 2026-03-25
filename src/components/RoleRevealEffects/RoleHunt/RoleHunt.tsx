/**
 * RoleHunt - 角色猎场揭示动画（Skia + Reanimated 4）
 *
 * 动画流程：多个角色幽灵排列在屏幕上（Flexbox 网格） → 玩家逐个点击捕获 →
 * 未命中的幽灵消散（烟雾效果）→ 命中目标角色时全屏庆祝 → 揭示角色卡。
 *
 * Skia Canvas 负责：
 *   - 飘动雾气粒子（半透明模糊圆形，缓慢漂移）
 *   - 浮动萤火虫光球（小 Circle 柔和闪烁 + 缓慢位移）
 *   - 命中时径向光线爆发（从命中位置向外扩散射线 + 冲击波环）
 *   - 全屏闪光 overlay
 *
 * Reanimated 负责：幽灵漂浮/捕获动画、阶段切换、卡牌揭示。
 * Flexbox 保证幽灵永远在可视区内。
 * 不 import service，不含业务逻辑。
 */
import {
  Blur,
  Canvas,
  Circle,
  Group,
  Line,
  Path,
  RadialGradient,
  Rect,
  vec,
} from '@shopify/react-native-skia';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { isValidRoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  Easing,
  interpolate,
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
import { AtmosphericBackground } from '@/components/RoleRevealEffects/common/effects/AtmosphericBackground';
import { RevealBurst } from '@/components/RoleRevealEffects/common/effects/RevealBurst';
import { SkiaSparkle } from '@/components/RoleRevealEffects/common/effects/SkiaSparkle';
import { RoleCardContent } from '@/components/RoleRevealEffects/common/RoleCardContent';
import { CONFIG } from '@/components/RoleRevealEffects/config';
import type { RoleData, RoleRevealEffectProps } from '@/components/RoleRevealEffects/types';
import { createAlignmentThemes } from '@/components/RoleRevealEffects/types';
import { triggerHaptic } from '@/components/RoleRevealEffects/utils/haptics';
import { CELEBRATION_EMOJIS } from '@/config/emojiTokens';
import { useColors } from '@/theme';
import { getRoleBadge } from '@/utils/roleBadges';

// ─── Visual constants ──────────────────────────────────────────────────
/** Background gradient: deep haunted forest green-black */
const BG_GRADIENT = ['#060d0a', '#0a1610', '#040a07'] as const;

const HUNT_COLORS = {
  /** Fog overlay */
  fog: 'rgba(20, 25, 40, 0.88)',
  /** Ghost glow border pulse */
  ghostGlow: 'rgba(140, 180, 255, 0.4)',
  ghostGlowBright: 'rgba(180, 220, 255, 0.7)',
  /** Miss flash */
  missFlash: 'rgba(255, 80, 80, 0.5)',
  /** Hit flash */
  hitFlash: 'rgba(100, 255, 150, 0.6)',
  /** Hint text */
  hintText: 'rgba(255, 255, 255, 0.85)',
  /** Ghost name text */
  ghostName: '#D0D8FF',
  /** Ghost body background */
  ghostBodyBg: 'rgba(100, 130, 200, 0.12)',
  ghostBodyBorder: 'rgba(140, 170, 255, 0.25)',
  /** Fog particle colors — bright visible clouds */
  fogParticle: [
    'rgba(140, 170, 230, 0.55)',
    'rgba(120, 155, 215, 0.45)',
    'rgba(160, 185, 240, 0.50)',
  ] as const,
  /** Mid-layer fog — wide luminous bands */
  midFog: [
    'rgba(80, 120, 200, 0.40)',
    'rgba(100, 140, 210, 0.35)',
    'rgba(90, 130, 205, 0.38)',
    'rgba(110, 150, 220, 0.32)',
  ] as const,
  /** Firefly colors — bright glowing orbs */
  firefly: [
    'rgba(180, 220, 255, 0.8)',
    'rgba(150, 200, 255, 0.7)',
    'rgba(200, 230, 255, 0.9)',
    'rgba(100, 180, 255, 0.7)',
    'rgba(180, 255, 220, 0.6)',
  ] as const,
  /** Hit burst ray color */
  burstRay: 'rgba(255, 255, 200, 0.8)',
  /** Hit shockwave ring */
  shockwave: 'rgba(200, 230, 255, 0.6)',
  /** Moon glow */
  moonGlow: 'rgba(200, 220, 255, 0.3)',
  /** Paw print */
  pawPrint: 'rgba(120, 150, 200, 0.15)',
  /** Radar pulse */
  radarPulse: 'rgba(100, 200, 255, 0.25)',
  /** Crosshair */
  crosshair: 'rgba(100, 255, 150, 0.6)',
  /** Vignette edge */
  vignetteEdge: 'rgba(0, 0, 0, 0.7)',
  /** Dense bottom fog */
  bottomFog: 'rgba(15, 20, 35, 0.6)',
  /** Capture spiral ring */
  captureSpiralRing: 'rgba(100, 255, 180, 0.5)',
  /** Star colors */
  star: 'rgba(230, 240, 255, 1)',
  starDim: 'rgba(190, 210, 250, 0.7)',
  /** Light thread between ghosts */
  lightThread: 'rgba(140, 180, 255, 0.35)',
} as const;

// ─── Extended props ─────────────────────────────────────────────────────
interface RoleHuntProps extends RoleRevealEffectProps {
  /** All roles in the game (used to create ghost targets) */
  allRoles?: RoleData[];
}

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;

/** Paw print positions scattered in the background */
const PAW_PRINTS = Array.from({ length: 8 }, (_) => ({
  x: SCREEN_W * 0.1 + Math.random() * SCREEN_W * 0.8,
  y: SCREEN_H * 0.1 + Math.random() * SCREEN_H * 0.8,
  rotation: Math.random() * 360,
  size: 18 + Math.random() * 10,
}));

/** Tree branch silhouette data (rendered via Skia Path) */
const TREE_BRANCHES = [
  { x: -10, y: 20, rotation: 15 },
  { x: SCREEN_W - 40, y: 30, rotation: -20 },
  { x: 10, y: 60, rotation: 30 },
  { x: SCREEN_W - 50, y: 70, rotation: -10 },
];

/** Build a forking branch silhouette Path string from base (0,0) */
function buildBranchPath(scale: number): string {
  const s = scale;
  // Main stem + two forking sub-branches
  return (
    `M 0 0 L ${6 * s} ${-18 * s} L ${10 * s} ${-30 * s} ` +
    `M ${6 * s} ${-18 * s} L ${18 * s} ${-22 * s} L ${24 * s} ${-28 * s} ` +
    `M ${6 * s} ${-18 * s} L ${-4 * s} ${-28 * s} L ${-8 * s} ${-36 * s} ` +
    `M ${10 * s} ${-30 * s} L ${16 * s} ${-38 * s} ` +
    `M ${10 * s} ${-30 * s} L ${4 * s} ${-40 * s}`
  );
}

/** Build a paw-print Path string (palm + 4 toe pads) */
function buildPawPath(size: number): string {
  const s = size / 20;
  // Central palm pad (ellipse approximation via arcs)
  const palmRx = 5 * s;
  const palmRy = 6 * s;
  const palm = `M ${-palmRx} 0 A ${palmRx} ${palmRy} 0 1 0 ${palmRx} 0 A ${palmRx} ${palmRy} 0 1 0 ${-palmRx} 0 `;
  // 4 toe pads (small circles above the palm)
  const toeR = 2.2 * s;
  const toes = [
    { dx: -5 * s, dy: -8 * s },
    { dx: -1.5 * s, dy: -10 * s },
    { dx: 2 * s, dy: -10 * s },
    { dx: 5.5 * s, dy: -8 * s },
  ]
    .map(
      (t) =>
        `M ${t.dx - toeR} ${t.dy} A ${toeR} ${toeR} 0 1 0 ${t.dx + toeR} ${t.dy} A ${toeR} ${toeR} 0 1 0 ${t.dx - toeR} ${t.dy} `,
    )
    .join('');
  return palm + toes;
}

// ─── Ghost data ─────────────────────────────────────────────────────────
interface GhostData {
  id: number;
  role: RoleData;
  isTarget: boolean;
  driftX: number;
  driftY: number;
  driftDuration: number;
  offsetX: number;
  offsetY: number;
  /** Phase offset for glow pulse (radians) */
  glowPhaseOffset: number;
}

// ─── Fog particle data ──────────────────────────────────────────────────
interface FogParticleData {
  id: number;
  startX: number;
  y: number;
  radius: number;
  color: string;
  driftSpeed: number;
  bobAmplitude: number;
  bobDuration: number;
}

function generateFogParticles(w: number, h: number): FogParticleData[] {
  const count = 8;
  const particles: FogParticleData[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      id: i,
      startX: Math.random() * w,
      y: h * 0.2 + Math.random() * h * 0.6,
      radius: 60 + Math.random() * 80,
      color: HUNT_COLORS.fogParticle[i % HUNT_COLORS.fogParticle.length],
      driftSpeed: 4000 + Math.random() * 3000,
      bobAmplitude: 15 + Math.random() * 20,
      bobDuration: 3000 + Math.random() * 2000,
    });
  }
  return particles;
}

// ─── Firefly data ───────────────────────────────────────────────────────
interface FireflyData {
  id: number;
  baseX: number;
  baseY: number;
  radius: number;
  color: string;
  driftRadius: number;
  driftDuration: number;
  flickerDuration: number;
}

function generateFireflies(w: number, h: number): FireflyData[] {
  const count = 12;
  const fireflies: FireflyData[] = [];
  for (let i = 0; i < count; i++) {
    fireflies.push({
      id: i,
      baseX: w * 0.05 + Math.random() * w * 0.9,
      baseY: h * 0.1 + Math.random() * h * 0.8,
      radius: 3 + Math.random() * 5,
      color: HUNT_COLORS.firefly[i % HUNT_COLORS.firefly.length],
      driftRadius: 25 + Math.random() * 50,
      driftDuration: 3500 + Math.random() * 4000,
      flickerDuration: 1200 + Math.random() * 2000,
    });
  }
  return fireflies;
}

// ─── Hit burst ray data ─────────────────────────────────────────────────
interface BurstRayData {
  angle: number;
  length: number;
}

function generateBurstRays(): BurstRayData[] {
  const count = 12;
  const rays: BurstRayData[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
    rays.push({ angle, length: 60 + Math.random() * 80 });
  }
  return rays;
}

// ─── Skia sub-components ────────────────────────────────────────────────

/** Fog particle: large blurry circle drifting horizontally + bobbing vertically */
interface SkiaFogParticleProps {
  particle: FogParticleData;
  screenWidth: number;
  drift: SharedValue<number>;
  bob: SharedValue<number>;
  masterOpacity: SharedValue<number>;
}

/** Single blob in a fog cloud cluster — extracted to avoid hooks inside .map() */
interface SkiaFogBlobProps {
  x: SharedValue<number>;
  y: SharedValue<number>;
  dx: number;
  dy: number;
  r: number;
  color: string;
}

const SkiaFogBlob: React.FC<SkiaFogBlobProps> = React.memo(({ x, y, dx, dy, r, color }) => {
  const cx = useDerivedValue(() => x.value + dx);
  const cy = useDerivedValue(() => y.value + dy);
  return (
    <Circle cx={cx} cy={cy} r={r} color={color}>
      <Blur blur={r * 0.55} />
    </Circle>
  );
});
SkiaFogBlob.displayName = 'SkiaFogBlob';

const SkiaFogParticle: React.FC<SkiaFogParticleProps> = ({
  particle,
  screenWidth,
  drift,
  bob,
  masterOpacity,
}) => {
  const x = useDerivedValue(() => {
    const base = particle.startX + interpolate(drift.value, [0, 1], [0, screenWidth * 0.4]);
    return (base % (screenWidth + particle.radius * 2)) - particle.radius;
  });
  const y = useDerivedValue(
    () =>
      particle.y + interpolate(bob.value, [0, 1], [-particle.bobAmplitude, particle.bobAmplitude]),
  );
  const opacity = useDerivedValue(() => masterOpacity.value);

  // Sub-blob offsets: cluster of overlapping circles to form an irregular cloud
  const r = particle.radius;
  const blobOffsets = useMemo(
    () => [
      { dx: 0, dy: 0, scale: 1.0 },
      { dx: r * 0.55, dy: -r * 0.18, scale: 0.75 },
      { dx: -r * 0.5, dy: r * 0.15, scale: 0.8 },
      { dx: r * 0.3, dy: r * 0.3, scale: 0.6 },
      { dx: -r * 0.35, dy: -r * 0.25, scale: 0.65 },
    ],
    [r],
  );

  return (
    <Group opacity={opacity} transform={[{ scaleX: 1.6 }]}>
      {blobOffsets.map((blob, i) => (
        <SkiaFogBlob
          key={i}
          x={x}
          y={y}
          dx={blob.dx}
          dy={blob.dy}
          r={r * blob.scale}
          color={particle.color}
        />
      ))}
    </Group>
  );
};

/** Firefly: small glowing dot with gentle drift and flicker */
interface SkiaFireflyProps {
  firefly: FireflyData;
  drift: SharedValue<number>;
  flicker: SharedValue<number>;
  masterOpacity: SharedValue<number>;
}

const SkiaFirefly: React.FC<SkiaFireflyProps> = ({ firefly, drift, flicker, masterOpacity }) => {
  const x = useDerivedValue(
    () => firefly.baseX + Math.cos(drift.value * Math.PI * 2) * firefly.driftRadius,
  );
  const y = useDerivedValue(
    () => firefly.baseY + Math.sin(drift.value * Math.PI * 2 * 0.7) * firefly.driftRadius * 0.6,
  );
  const opacity = useDerivedValue(
    () => masterOpacity.value * interpolate(flicker.value, [0, 0.5, 1], [0.3, 1, 0.3]),
  );
  // Outer glow (larger, dimmer)
  const glowOpacity = useDerivedValue(() => opacity.value * 0.3);

  return (
    <Group>
      <Group opacity={glowOpacity}>
        <Circle cx={x} cy={y} r={firefly.radius * 6} color={firefly.color}>
          <Blur blur={8} />
        </Circle>
      </Group>
      <Group opacity={opacity}>
        <Circle cx={x} cy={y} r={firefly.radius} color={firefly.color}>
          <Blur blur={1} />
        </Circle>
      </Group>
    </Group>
  );
};

/** Hit burst: radial rays + shockwave ring expanding from hit position */
interface SkiaBurstProps {
  cx: number;
  cy: number;
  rays: BurstRayData[];
  progress: SharedValue<number>;
}

const SkiaBurst: React.FC<SkiaBurstProps> = ({ cx, cy, rays, progress }) => {
  const opacity = useDerivedValue(() => Math.max(0, 1 - progress.value));
  const scale = useDerivedValue(() => progress.value);
  // Shockwave ring
  const ringRadius = useDerivedValue(() => 10 + scale.value * 120);
  const ringOpacity = useDerivedValue(() => Math.max(0, 0.8 - progress.value * 0.8));

  return (
    <Group opacity={opacity}>
      {rays.map((ray, i) => {
        const ex = cx + Math.cos(ray.angle) * ray.length;
        const ey = cy + Math.sin(ray.angle) * ray.length;
        return (
          <Line
            key={`ray-${i}`}
            p1={vec(cx, cy)}
            p2={vec(ex, ey)}
            color={HUNT_COLORS.burstRay}
            style="stroke"
            strokeWidth={2.5}
            strokeCap="round"
          />
        );
      })}
      <Group opacity={ringOpacity}>
        <Circle
          cx={cx}
          cy={cy}
          r={ringRadius}
          color={HUNT_COLORS.shockwave}
          style="stroke"
          strokeWidth={3}
        />
      </Group>
    </Group>
  );
};

/** Skia moon with halo glow and soft light beams */
interface SkiaMoonProps {
  x: number;
  y: number;
  glowPulse: SharedValue<number>;
}

const SkiaMoon: React.FC<SkiaMoonProps> = React.memo(({ x, y, glowPulse }) => {
  const haloRadius = useDerivedValue(() => 38 + glowPulse.value * 12);
  const haloOpacity = useDerivedValue(() => 0.12 + glowPulse.value * 0.1);
  const beamOpacity = useDerivedValue(() => 0.04 + glowPulse.value * 0.06);

  return (
    <Group>
      {/* Outer halo glow */}
      <Group opacity={haloOpacity}>
        <Circle cx={x} cy={y} r={haloRadius}>
          <RadialGradient
            c={vec(x, y)}
            r={55}
            colors={['rgba(220, 235, 255, 0.5)', 'rgba(180, 210, 255, 0.15)', 'transparent']}
          />
          <Blur blur={18} />
        </Circle>
      </Group>

      {/* Light beams radiating downward */}
      <Group opacity={beamOpacity}>
        <Line
          p1={vec(x, y + 20)}
          p2={vec(x - 80, y + 250)}
          color="rgba(200, 220, 255, 0.4)"
          style="stroke"
          strokeWidth={12}
          strokeCap="round"
        >
          <Blur blur={15} />
        </Line>
        <Line
          p1={vec(x, y + 20)}
          p2={vec(x + 40, y + 220)}
          color="rgba(200, 220, 255, 0.35)"
          style="stroke"
          strokeWidth={10}
          strokeCap="round"
        >
          <Blur blur={12} />
        </Line>
        <Line
          p1={vec(x, y + 20)}
          p2={vec(x - 30, y + 200)}
          color="rgba(200, 220, 255, 0.3)"
          style="stroke"
          strokeWidth={8}
          strokeCap="round"
        >
          <Blur blur={10} />
        </Line>
      </Group>

      {/* Moon body — bright disk */}
      <Circle cx={x} cy={y} r={18} color="rgba(230, 240, 255, 0.92)">
        <Blur blur={1} />
      </Circle>
      {/* Shadow to create crescent shape */}
      <Circle cx={x + 8} cy={y - 3} r={15} color={BG_GRADIENT[0]} />
    </Group>
  );
});
SkiaMoon.displayName = 'SkiaMoon';

/** Skia concentric rings expanding on capture hit */
interface SkiaCaptureSpiralProps {
  cx: number;
  cy: number;
  scale: SharedValue<number>;
  opacity: SharedValue<number>;
}

const SkiaCaptureSpiral: React.FC<SkiaCaptureSpiralProps> = React.memo(
  ({ cx, cy, scale, opacity }) => {
    const op = useDerivedValue(() => opacity.value * 0.6);
    const outerR = useDerivedValue(() => scale.value * 120);
    const midR = useDerivedValue(() => scale.value * 78);
    const innerR = useDerivedValue(() => scale.value * 42);

    return (
      <Group opacity={op}>
        <Circle
          cx={cx}
          cy={cy}
          r={outerR}
          color={HUNT_COLORS.captureSpiralRing}
          style="stroke"
          strokeWidth={2}
        >
          <Blur blur={3} />
        </Circle>
        <Circle
          cx={cx}
          cy={cy}
          r={midR}
          color={HUNT_COLORS.captureSpiralRing}
          style="stroke"
          strokeWidth={1.5}
        >
          <Blur blur={2} />
        </Circle>
        <Circle
          cx={cx}
          cy={cy}
          r={innerR}
          color={HUNT_COLORS.captureSpiralRing}
          style="stroke"
          strokeWidth={1}
        >
          <Blur blur={1} />
        </Circle>
      </Group>
    );
  },
);
SkiaCaptureSpiral.displayName = 'SkiaCaptureSpiral';

// ─── Starfield data ───────────────────────────────────────────────────────
interface StarData {
  x: number;
  y: number;
  r: number;
  /** Phase offset for twinkle (0–1) */
  phase: number;
  bright: boolean;
}

function generateStars(w: number, h: number): StarData[] {
  const count = 40;
  const stars: StarData[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * w,
      y: Math.random() * h * 0.65,
      r: 1 + Math.random() * 2.5,
      phase: Math.random(),
      bright: Math.random() > 0.4,
    });
  }
  return stars;
}

/** Twinkling star — uses a shared pulse value with per-star phase offset */
interface SkiaStarProps {
  star: StarData;
  twinkle: SharedValue<number>;
}

const SkiaStar: React.FC<SkiaStarProps> = React.memo(({ star, twinkle }) => {
  const opacity = useDerivedValue(() => {
    const t = (twinkle.value + star.phase) % 1;
    const pulse = 0.5 + Math.sin(t * Math.PI * 2) * 0.5;
    return star.bright ? pulse : pulse * 0.7;
  });

  const color = star.bright ? HUNT_COLORS.star : HUNT_COLORS.starDim;

  return (
    <Group opacity={opacity}>
      <SkiaSparkle
        x={star.x}
        y={star.y}
        r={star.r}
        color={color}
        glowColor={HUNT_COLORS.starDim}
        bright={star.bright}
        glowBlur={star.bright ? 6 : 4}
        strokeScale={star.bright ? 1.5 : 1}
      />
    </Group>
  );
});
SkiaStar.displayName = 'SkiaStar';

/** Light thread line connecting two points with soft glow */
interface SkiaLightThreadProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  pulse: SharedValue<number>;
  phase: number;
}

const SkiaLightThread: React.FC<SkiaLightThreadProps> = React.memo(
  ({ x1, y1, x2, y2, pulse, phase }) => {
    const opacity = useDerivedValue(() => {
      const t = (pulse.value + phase) % 1;
      return 0.15 + Math.sin(t * Math.PI * 2) * 0.15;
    });

    return (
      <Group opacity={opacity}>
        <Line
          p1={vec(x1, y1)}
          p2={vec(x2, y2)}
          color={HUNT_COLORS.lightThread}
          style="stroke"
          strokeWidth={1.5}
          strokeCap="round"
        >
          <Blur blur={4} />
        </Line>
      </Group>
    );
  },
);
SkiaLightThread.displayName = 'SkiaLightThread';

// ─── Mid-layer fog data ────────────────────────────────────────────────
interface MidFogData {
  id: number;
  cx: number;
  cy: number;
  radius: number;
  color: string;
}

function generateMidFog(w: number, h: number): MidFogData[] {
  return [
    { id: 0, cx: w * 0.15, cy: h * 0.35, radius: 130, color: HUNT_COLORS.midFog[0] },
    { id: 1, cx: w * 0.6, cy: h * 0.25, radius: 160, color: HUNT_COLORS.midFog[1] },
    { id: 2, cx: w * 0.85, cy: h * 0.55, radius: 140, color: HUNT_COLORS.midFog[2] },
    { id: 3, cx: w * 0.4, cy: h * 0.65, radius: 150, color: HUNT_COLORS.midFog[3] },
  ];
}

// ─── Light thread grid positions (connect ghosts pairwise) ───────────
interface ThreadData {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  phase: number;
}

/** Generate thread connections between ghost grid positions */
function generateThreads(ghostCount: number, screenW: number, screenH: number): ThreadData[] {
  // Approximate ghost grid positions (3 columns)
  const cols = 3;
  const rows = Math.ceil(ghostCount / cols);
  const cellW = screenW / cols;
  const topPad = screenH * 0.22;
  const botPad = screenH * 0.12;
  const gridH = screenH - topPad - botPad;
  const cellH = gridH / Math.max(rows, 1);

  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < ghostCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.push({
      x: cellW * (col + 0.5),
      y: topPad + cellH * (row + 0.5),
    });
  }

  // Connect adjacent positions (horizontal + vertical neighbors)
  const threads: ThreadData[] = [];
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const dx = Math.abs(positions[i].x - positions[j].x);
      const dy = Math.abs(positions[i].y - positions[j].y);
      // Only connect neighbors (within 1.5 cells distance)
      if (dx < cellW * 1.6 && dy < cellH * 1.6) {
        threads.push({
          x1: positions[i].x,
          y1: positions[i].y,
          x2: positions[j].x,
          y2: positions[j].y,
          phase: (i + j) * 0.12,
        });
      }
    }
  }
  return threads;
}

// ─── Self-animating ghost (Flexbox positioned, transform = drift only) ──
interface AnimatedGhostProps {
  ghost: GhostData;
  onCapture: (id: number) => void;
  state: 'floating' | 'captured-miss' | 'captured-hit' | 'hidden';
  enableHaptics: boolean;
}

const AnimatedGhost: React.FC<AnimatedGhostProps> = React.memo(
  ({ ghost, onCapture, state, enableHaptics }) => {
    const driftProgress = useSharedValue(0);
    const fadeOut = useSharedValue(1);
    const captureScale = useSharedValue(1);
    const bobProgress = useSharedValue(0);
    const glowPulse = useSharedValue(0);

    const badgeSource = isValidRoleId(ghost.role.id) ? getRoleBadge(ghost.role.id) : undefined;

    // Start floating animation — each ghost has unique driftDuration for natural desync
    useEffect(() => {
      driftProgress.value = withRepeat(
        withSequence(
          withTiming(1, { duration: ghost.driftDuration, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: ghost.driftDuration, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );

      bobProgress.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1500 + ghost.id * 100, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1500 + ghost.id * 100, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );

      // Glow pulse with phase offset per ghost
      glowPulse.value = withDelay(
        ghost.glowPhaseOffset * 400,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
            withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          false,
        ),
      );
    }, [
      driftProgress,
      bobProgress,
      glowPulse,
      ghost.driftDuration,
      ghost.id,
      ghost.glowPhaseOffset,
    ]);

    // Handle capture animation
    useEffect(() => {
      if (state === 'captured-miss') {
        // Miss: scale up slightly + rotate + fade + scaleY compress (smoke dissolve)
        captureScale.value = withSequence(
          withTiming(1.3, { duration: 120 }),
          withTiming(0.6, { duration: 350, easing: Easing.out(Easing.cubic) }),
        );
        fadeOut.value = withDelay(
          80,
          withTiming(0, { duration: 450, easing: Easing.out(Easing.cubic) }),
        );
      } else if (state === 'captured-hit') {
        captureScale.value = withSequence(
          withTiming(1.6, { duration: 200, easing: Easing.out(Easing.back(2)) }),
          withTiming(0, { duration: 300, easing: Easing.in(Easing.cubic) }),
        );
      }
    }, [state, captureScale, fadeOut]);

    // Breathing opacity + glow border color
    const animStyle = useAnimatedStyle(() => {
      const breathOpacity = interpolate(glowPulse.value, [0, 1], [0.65, 1]);
      return {
        transform: [
          {
            translateX:
              ghost.offsetX +
              interpolate(driftProgress.value, [0, 1], [-ghost.driftX, ghost.driftX]),
          },
          {
            translateY:
              ghost.offsetY +
              interpolate(driftProgress.value, [0, 1], [-ghost.driftY, ghost.driftY]) +
              interpolate(bobProgress.value, [0, 1], [0, -10]),
          },
          { scale: captureScale.value },
        ],
        opacity: fadeOut.value * breathOpacity,
      };
    });

    // Glow border pulsing style — enhanced with bigger shadow spread
    const bodyStyle = useAnimatedStyle(() => {
      const borderAlpha = interpolate(glowPulse.value, [0, 1], [0.25, 0.65]);
      const shadowAlpha = interpolate(glowPulse.value, [0, 1], [0.2, 0.6]);
      return {
        borderColor: `rgba(140, 180, 255, ${borderAlpha})`,
        shadowColor: `rgba(140, 180, 255, ${shadowAlpha})`,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: interpolate(glowPulse.value, [0, 1], [8, 28]),
      };
    });

    // Inner ectoplasm glow pulsing behind badge
    const ectoGlowStyle = useAnimatedStyle(() => {
      const alpha = interpolate(glowPulse.value, [0, 1], [0.03, 0.18]);
      return {
        backgroundColor: `rgba(140, 180, 255, ${alpha})`,
      };
    });

    if (state === 'hidden') return null;

    const handlePress = () => {
      if (state !== 'floating') return;
      if (enableHaptics) triggerHaptic('medium', true);
      onCapture(ghost.id);
    };

    return (
      <View style={styles.ghostCell}>
        <Animated.View style={animStyle}>
          <Pressable onPress={handlePress} style={styles.ghostTouchable}>
            <Animated.View style={[styles.ghostBody, bodyStyle]}>
              <Animated.View style={[styles.ghostEctoGlow, ectoGlowStyle]} pointerEvents="none" />
              {badgeSource ? (
                <Image source={badgeSource} resizeMode="contain" style={styles.ghostBadge} />
              ) : (
                <Text style={styles.ghostFallbackEmoji}>{'👻'}</Text>
              )}
              <Text style={styles.ghostName}>{ghost.role.name}</Text>
            </Animated.View>
          </Pressable>
        </Animated.View>
      </View>
    );
  },
);
AnimatedGhost.displayName = 'AnimatedGhost';

// ─── Celebration particle ───────────────────────────────────────────────
interface CelebrationParticleConfig {
  id: number;
  targetX: number;
  targetY: number;
  emoji: string;
  duration: number;
}

const CelebrationParticle: React.FC<CelebrationParticleConfig> = React.memo(
  ({ targetX, targetY, emoji, duration }) => {
    const progress = useSharedValue(0);

    useEffect(() => {
      progress.value = withTiming(1, {
        duration,
        easing: Easing.out(Easing.cubic),
      });
    }, [duration, progress]);

    const animStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: progress.value * targetX },
        { translateY: progress.value * targetY },
        { scale: interpolate(progress.value, [0, 0.2, 0.4, 1], [0, 1.4, 1.1, 0]) },
        { rotate: `${progress.value * 180}deg` },
      ],
      opacity: interpolate(progress.value, [0, 0.5, 1], [1, 0.7, 0]),
    }));

    return (
      <Animated.View style={[styles.celebrationParticle, animStyle]}>
        <Text style={styles.celebrationEmoji}>{emoji}</Text>
      </Animated.View>
    );
  },
);
CelebrationParticle.displayName = 'CelebrationParticle';

// ─── Ghost generation helper ────────────────────────────────────────────
function generateGhosts(targetRole: RoleData, allRoles: RoleData[]): GhostData[] {
  const uniqueMap = new Map<string, RoleData>();
  for (const r of allRoles) {
    uniqueMap.set(r.id, r);
  }
  uniqueMap.set(targetRole.id, targetRole);

  const unique = Array.from(uniqueMap.values());

  // Shuffle using Fisher-Yates
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }

  const maxGhosts = 7;
  let selected: RoleData[];
  if (unique.length <= maxGhosts) {
    selected = unique;
  } else {
    const withoutTarget = unique.filter((r) => r.id !== targetRole.id);
    selected = [targetRole, ...withoutTarget.slice(0, maxGhosts - 1)];
    for (let i = selected.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [selected[i], selected[j]] = [selected[j], selected[i]];
    }
  }

  return selected.map((role, index) => ({
    id: index,
    role,
    isTarget: role.id === targetRole.id,
    driftX: 6 + Math.random() * 10,
    driftY: 4 + Math.random() * 8,
    driftDuration: 2000 + Math.random() * 1500,
    offsetX: (Math.random() - 0.5) * 30,
    offsetY: (Math.random() - 0.5) * 24,
    glowPhaseOffset: index,
  }));
}

// ─── Main component ─────────────────────────────────────────────────────
export const RoleHunt: React.FC<RoleHuntProps> = ({
  role,
  onComplete,
  allRoles,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'role-hunt',
}) => {
  const colors = useColors();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const alignmentThemes = useMemo(() => createAlignmentThemes(colors), [colors]);
  const theme = alignmentThemes[role.alignment];
  const common = CONFIG.common;
  const config = CONFIG.roleHunt;

  const [phase, setPhase] = useState<'hunting' | 'capturing' | 'revealing' | 'revealed'>('hunting');
  const [autoTimeoutWarning, setAutoTimeoutWarning] = useState(false);
  const [ghostStates, setGhostStates] = useState<
    Record<number, 'floating' | 'captured-miss' | 'captured-hit' | 'hidden'>
  >({});
  const [celebrations, setCelebrations] = useState<CelebrationParticleConfig[]>([]);
  const [hitBurstPos, setHitBurstPos] = useState<{ x: number; y: number } | null>(null);
  const onCompleteCalledRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSelectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Generate ghosts once at mount
  const ghosts = useRef(generateGhosts(role, allRoles ?? [role])).current;

  // Pre-generate Skia atmosphere data
  const [fogParticles] = useState(() => generateFogParticles(screenWidth, screenHeight));
  const [fireflies] = useState(() => generateFireflies(screenWidth, screenHeight));
  const [burstRays] = useState(() => generateBurstRays());
  const [stars] = useState(() => generateStars(screenWidth, screenHeight));
  const [midFogData] = useState(() => generateMidFog(screenWidth, screenHeight));
  const [threads] = useState(() => generateThreads(7, screenWidth, screenHeight));

  // Initialize ghost states
  useEffect(() => {
    const initial: Record<number, 'floating'> = {};
    for (const g of ghosts) {
      initial[g.id] = 'floating';
    }
    setGhostStates(initial);
  }, [ghosts]);

  // Clean up timers
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (autoSelectTimerRef.current) clearTimeout(autoSelectTimerRef.current);
    };
  }, []);

  // ── Shared values ──
  const cardScale = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const fogOpacity = useSharedValue(1);
  const hintOpacity = useSharedValue(1);
  const atmosphereOpacity = useSharedValue(1);
  const hitFlashOpacity = useSharedValue(0);
  const burstProgress = useSharedValue(0);

  // ── New shared values for enhanced visuals ──
  const moonGlowPulse = useSharedValue(0);
  const radarPulse = useSharedValue(0);
  const crosshairPulse = useSharedValue(0);
  const captureNetOpacity = useSharedValue(0);
  const captureNetScale = useSharedValue(0);
  const starTwinkle = useSharedValue(0);

  // Derived values for Skia
  const radarRadius = useDerivedValue(() => radarPulse.value * 180);
  const radarOpacity = useDerivedValue(() => Math.max(0, 1 - radarPulse.value));

  // Fog particle shared values (8 particles × 2 values each)
  const fogDrift0 = useSharedValue(0);
  const fogDrift1 = useSharedValue(0);
  const fogDrift2 = useSharedValue(0);
  const fogDrift3 = useSharedValue(0);
  const fogDrift4 = useSharedValue(0);
  const fogDrift5 = useSharedValue(0);
  const fogDrift6 = useSharedValue(0);
  const fogDrift7 = useSharedValue(0);
  const fogDrifts = useMemo(
    () => [fogDrift0, fogDrift1, fogDrift2, fogDrift3, fogDrift4, fogDrift5, fogDrift6, fogDrift7],
    [fogDrift0, fogDrift1, fogDrift2, fogDrift3, fogDrift4, fogDrift5, fogDrift6, fogDrift7],
  );

  const fogBob0 = useSharedValue(0);
  const fogBob1 = useSharedValue(0);
  const fogBob2 = useSharedValue(0);
  const fogBob3 = useSharedValue(0);
  const fogBob4 = useSharedValue(0);
  const fogBob5 = useSharedValue(0);
  const fogBob6 = useSharedValue(0);
  const fogBob7 = useSharedValue(0);
  const fogBobs = useMemo(
    () => [fogBob0, fogBob1, fogBob2, fogBob3, fogBob4, fogBob5, fogBob6, fogBob7],
    [fogBob0, fogBob1, fogBob2, fogBob3, fogBob4, fogBob5, fogBob6, fogBob7],
  );

  // Firefly shared values (12 fireflies × 2 values each)
  const ffDrift0 = useSharedValue(0);
  const ffDrift1 = useSharedValue(0);
  const ffDrift2 = useSharedValue(0);
  const ffDrift3 = useSharedValue(0);
  const ffDrift4 = useSharedValue(0);
  const ffDrift5 = useSharedValue(0);
  const ffDrift6 = useSharedValue(0);
  const ffDrift7 = useSharedValue(0);
  const ffDrift8 = useSharedValue(0);
  const ffDrift9 = useSharedValue(0);
  const ffDrift10 = useSharedValue(0);
  const ffDrift11 = useSharedValue(0);
  const ffDrifts = useMemo(
    () => [
      ffDrift0,
      ffDrift1,
      ffDrift2,
      ffDrift3,
      ffDrift4,
      ffDrift5,
      ffDrift6,
      ffDrift7,
      ffDrift8,
      ffDrift9,
      ffDrift10,
      ffDrift11,
    ],
    [
      ffDrift0,
      ffDrift1,
      ffDrift2,
      ffDrift3,
      ffDrift4,
      ffDrift5,
      ffDrift6,
      ffDrift7,
      ffDrift8,
      ffDrift9,
      ffDrift10,
      ffDrift11,
    ],
  );

  const ffFlicker0 = useSharedValue(0);
  const ffFlicker1 = useSharedValue(0);
  const ffFlicker2 = useSharedValue(0);
  const ffFlicker3 = useSharedValue(0);
  const ffFlicker4 = useSharedValue(0);
  const ffFlicker5 = useSharedValue(0);
  const ffFlicker6 = useSharedValue(0);
  const ffFlicker7 = useSharedValue(0);
  const ffFlicker8 = useSharedValue(0);
  const ffFlicker9 = useSharedValue(0);
  const ffFlicker10 = useSharedValue(0);
  const ffFlicker11 = useSharedValue(0);
  const ffFlickers = useMemo(
    () => [
      ffFlicker0,
      ffFlicker1,
      ffFlicker2,
      ffFlicker3,
      ffFlicker4,
      ffFlicker5,
      ffFlicker6,
      ffFlicker7,
      ffFlicker8,
      ffFlicker9,
      ffFlicker10,
      ffFlicker11,
    ],
    [
      ffFlicker0,
      ffFlicker1,
      ffFlicker2,
      ffFlicker3,
      ffFlicker4,
      ffFlicker5,
      ffFlicker6,
      ffFlicker7,
      ffFlicker8,
      ffFlicker9,
      ffFlicker10,
      ffFlicker11,
    ],
  );

  const cardWidth = Math.min(screenWidth * common.cardWidthRatio, common.cardMaxWidth);
  const cardHeight = cardWidth * common.cardAspectRatio;

  // ── Start atmosphere animations ──
  useEffect(() => {
    if (reducedMotion) return;

    // Fog particles: continuous horizontal drift + vertical bob
    fogParticles.forEach((p, i) => {
      fogDrifts[i].value = withRepeat(
        withTiming(1, { duration: p.driftSpeed, easing: Easing.linear }),
        -1,
        false,
      );
      fogBobs[i].value = withRepeat(
        withSequence(
          withTiming(1, { duration: p.bobDuration, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: p.bobDuration, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    });

    // Fireflies: orbital drift + flicker
    fireflies.forEach((f, i) => {
      ffDrifts[i].value = withRepeat(
        withTiming(1, { duration: f.driftDuration, easing: Easing.linear }),
        -1,
        false,
      );
      ffFlickers[i].value = withRepeat(
        withSequence(
          withTiming(1, { duration: f.flickerDuration, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: f.flickerDuration, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    });
  }, [reducedMotion, fogParticles, fireflies, fogDrifts, fogBobs, ffDrifts, ffFlickers]);

  // ── Enhanced atmosphere animations ──
  useEffect(() => {
    if (reducedMotion) return;

    // Moon glow pulse
    moonGlowPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );

    // Radar pulse (continuous expanding rings)
    radarPulse.value = withRepeat(
      withTiming(1, { duration: 2500, easing: Easing.out(Easing.cubic) }),
      -1,
    );

    // Crosshair pulse
    crosshairPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.5, { duration: 800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );

    // Star twinkle (continuous 0→1 cycle, shared by all stars via phase offset)
    starTwinkle.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1);
  }, [reducedMotion, moonGlowPulse, radarPulse, crosshairPulse, starTwinkle]);

  // Auto-select: if user doesn't find the target in time, auto-capture it
  useEffect(() => {
    if (reducedMotion) return;
    const warningTimer = setTimeout(
      () => setAutoTimeoutWarning(true),
      CONFIG.common.autoTimeout - CONFIG.common.autoTimeoutWarningLeadTime,
    );
    autoSelectTimerRef.current = setTimeout(() => {
      if (phase !== 'hunting') return;
      const target = ghosts.find((g) => g.isTarget);
      if (target) {
        handleCapture(target.id);
      }
    }, CONFIG.common.autoTimeout);

    return () => {
      clearTimeout(warningTimer);
      if (autoSelectTimerRef.current) clearTimeout(autoSelectTimerRef.current);
      setAutoTimeoutWarning(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run on mount
  }, []);

  // Hint text fade
  useEffect(() => {
    if (reducedMotion) return;
    hintOpacity.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [hintOpacity, reducedMotion]);

  const createCelebrations = useCallback(() => {
    const configs: CelebrationParticleConfig[] = [];
    const count = 28;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const distance = 60 + Math.random() * 180;
      configs.push({
        id: i,
        targetX: Math.cos(angle) * distance,
        targetY: Math.sin(angle) * distance - 20,
        emoji: CELEBRATION_EMOJIS[i % CELEBRATION_EMOJIS.length],
        duration: 500 + Math.random() * 500,
      });
    }
    setCelebrations(configs);
  }, []);

  const startReveal = useCallback(() => {
    setPhase('revealing');
    createCelebrations();
    if (enableHaptics) triggerHaptic('heavy', true);

    // Fade fog + atmosphere
    fogOpacity.value = withTiming(0.2, { duration: 500 });
    atmosphereOpacity.value = withTiming(0, { duration: 600 });

    // Card entrance
    cardOpacity.value = withTiming(1, { duration: 300 });
    cardScale.value = withTiming(
      1,
      { duration: 400, easing: Easing.out(Easing.back(1.5)) },
      (finished) => {
        'worklet';
        if (finished) runOnJS(setPhase)('revealed');
      },
    );
  }, [cardScale, cardOpacity, fogOpacity, atmosphereOpacity, createCelebrations, enableHaptics]);

  const handleCapture = useCallback(
    (ghostId: number) => {
      const ghost = ghosts.find((g) => g.id === ghostId);
      if (!ghost) return;

      if (ghost.isTarget) {
        // Hit! Mark captured and start reveal
        setGhostStates((prev) => {
          const next = { ...prev };
          for (const g of ghosts) {
            if (g.id === ghostId) {
              next[g.id] = 'captured-hit';
            } else if (next[g.id] === 'floating') {
              next[g.id] = 'captured-miss';
            }
          }
          return next;
        });
        if (enableHaptics) triggerHaptic('success', true);

        // Trigger Skia hit burst at screen center (ghost position approximation)
        setHitBurstPos({ x: screenWidth / 2, y: screenHeight * 0.45 });
        burstProgress.value = 0;
        burstProgress.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });

        // Full-screen flash
        hitFlashOpacity.value = withSequence(
          withTiming(0.5, { duration: 80 }),
          withTiming(0, { duration: 400 }),
        );

        // Capture net animation
        captureNetScale.value = 0;
        captureNetOpacity.value = 1;
        captureNetScale.value = withTiming(1, {
          duration: 300,
          easing: Easing.out(Easing.back(1.2)),
        });
        captureNetOpacity.value = withDelay(400, withTiming(0, { duration: 300 }));

        // Delay reveal to let hit animation play
        const timer = setTimeout(() => startReveal(), config.hitRevealDelay);
        holdTimerRef.current = timer;
      } else {
        // Miss — dissolve this ghost with miss flash
        setGhostStates((prev) => ({ ...prev, [ghostId]: 'captured-miss' }));
        if (enableHaptics) triggerHaptic('light', true);

        // Subtle miss flash
        hitFlashOpacity.value = withSequence(
          withTiming(0.15, { duration: 50 }),
          withTiming(0, { duration: 200 }),
        );
      }
    },
    [
      ghosts,
      startReveal,
      enableHaptics,
      config.hitRevealDelay,
      screenWidth,
      screenHeight,
      burstProgress,
      hitFlashOpacity,
      captureNetScale,
      captureNetOpacity,
    ],
  );

  // Glow border done → onComplete
  const handleGlowComplete = useCallback(() => {
    if (onCompleteCalledRef.current) return;
    onCompleteCalledRef.current = true;
    holdTimerRef.current = setTimeout(() => onComplete(), config.revealHoldDuration);
  }, [onComplete, config.revealHoldDuration]);

  // Reduced motion: skip straight to reveal
  useEffect(() => {
    if (!reducedMotion) return;
    cardOpacity.value = 1;
    cardScale.value = 1;
    fogOpacity.value = 0;
    setPhase('revealed');
    holdTimerRef.current = setTimeout(() => {
      if (onCompleteCalledRef.current) return;
      onCompleteCalledRef.current = true;
      onComplete();
    }, config.revealHoldDuration);
  }, [reducedMotion, cardOpacity, cardScale, fogOpacity, onComplete, config.revealHoldDuration]);

  // ── Animated styles ──
  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const fogStyle = useAnimatedStyle(() => ({
    opacity: fogOpacity.value,
  }));

  const hintStyle = useAnimatedStyle(() => ({
    opacity: hintOpacity.value,
  }));

  const hitFlashStyle = useAnimatedStyle(() => ({
    opacity: hitFlashOpacity.value,
  }));

  const crosshairStyle = useAnimatedStyle(() => ({
    opacity: crosshairPulse.value,
  }));

  return (
    <View testID={`${testIDPrefix}-container`} style={styles.container}>
      {/* Immersive dark background */}
      <LinearGradient
        colors={[...BG_GRADIENT]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <AtmosphericBackground color={theme.primaryColor} animate={!reducedMotion} />

      {/* Skia atmosphere layer: fog particles + fireflies + hit burst */}
      {!reducedMotion && (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          {/* Vignette — dark edges */}
          <Rect x={0} y={0} width={screenWidth} height={screenHeight}>
            <RadialGradient
              c={vec(screenWidth / 2, screenHeight / 2)}
              r={Math.max(screenWidth, screenHeight) * 0.7}
              colors={['transparent', HUNT_COLORS.vignetteEdge]}
            />
          </Rect>

          {/* Starfield — twinkling points */}
          {stars.map((s, i) => (
            <SkiaStar key={`star-${i}`} star={s} twinkle={starTwinkle} />
          ))}

          {/* Light threads connecting ghost positions */}
          {threads.map((t, i) => (
            <SkiaLightThread
              key={`thread-${i}`}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              pulse={starTwinkle}
              phase={t.phase}
            />
          ))}

          {/* Radar pulse (expanding rings from center) */}
          <Group opacity={radarOpacity}>
            <Circle
              cx={screenWidth / 2}
              cy={screenHeight * 0.45}
              r={radarRadius}
              color={HUNT_COLORS.radarPulse}
              style="stroke"
              strokeWidth={1.5}
            >
              <Blur blur={2} />
            </Circle>
          </Group>

          {/* Skia tree branch silhouettes at top corners */}
          {TREE_BRANCHES.map((branch, i) => (
            <Group
              key={`branch-${i}`}
              transform={[
                { translateX: branch.x + 15 },
                { translateY: branch.y + 30 },
                { rotate: (branch.rotation * Math.PI) / 180 },
              ]}
            >
              <Path
                path={buildBranchPath(1.2)}
                color="rgba(10, 20, 15, 0.6)"
                style="stroke"
                strokeWidth={2.5}
                strokeCap="round"
                strokeJoin="round"
              />
              <Path
                path={buildBranchPath(1.2)}
                color="rgba(30, 60, 40, 0.25)"
                style="stroke"
                strokeWidth={5}
                strokeCap="round"
                strokeJoin="round"
              >
                <Blur blur={3} />
              </Path>
            </Group>
          ))}

          {/* Skia paw prints scattered in background */}
          {PAW_PRINTS.map((paw, i) => (
            <Group
              key={`paw-${i}`}
              transform={[
                { translateX: paw.x },
                { translateY: paw.y },
                { rotate: (paw.rotation * Math.PI) / 180 },
              ]}
            >
              <Path path={buildPawPath(paw.size)} color={HUNT_COLORS.pawPrint} />
            </Group>
          ))}

          {/* Skia moon with halo and light beams */}
          <SkiaMoon x={screenWidth - 50} y={65} glowPulse={moonGlowPulse} />

          {/* Dense bottom fog — multiple rolling bands */}
          <Circle
            cx={screenWidth * 0.1}
            cy={screenHeight * 0.9}
            r={200}
            color={HUNT_COLORS.bottomFog}
          >
            <Blur blur={60} />
          </Circle>
          <Circle
            cx={screenWidth * 0.3}
            cy={screenHeight * 0.95}
            r={180}
            color={HUNT_COLORS.bottomFog}
          >
            <Blur blur={55} />
          </Circle>
          <Circle
            cx={screenWidth * 0.5}
            cy={screenHeight * 0.97}
            r={220}
            color="rgba(12, 16, 30, 0.55)"
          >
            <Blur blur={65} />
          </Circle>
          <Circle cx={screenWidth * 0.7} cy={screenHeight} r={190} color={HUNT_COLORS.bottomFog}>
            <Blur blur={50} />
          </Circle>
          <Circle
            cx={screenWidth * 0.9}
            cy={screenHeight * 0.92}
            r={170}
            color="rgba(18, 22, 38, 0.5)"
          >
            <Blur blur={55} />
          </Circle>

          {/* Mid-layer fog — large soft blobs between background and ghosts */}
          {midFogData.map((mf) => (
            <Circle key={`midfog-${mf.id}`} cx={mf.cx} cy={mf.cy} r={mf.radius} color={mf.color}>
              <Blur blur={mf.radius * 0.45} />
            </Circle>
          ))}

          {/* Capture spiral rings on hit */}
          {hitBurstPos && (
            <SkiaCaptureSpiral
              cx={hitBurstPos.x}
              cy={hitBurstPos.y}
              scale={captureNetScale}
              opacity={captureNetOpacity}
            />
          )}

          {/* Fog particles */}
          {fogParticles.map((p, i) => (
            <SkiaFogParticle
              key={`fog-${p.id}`}
              particle={p}
              screenWidth={screenWidth}
              drift={fogDrifts[i]}
              bob={fogBobs[i]}
              masterOpacity={atmosphereOpacity}
            />
          ))}
          {/* Fireflies */}
          {fireflies.map((f, i) => (
            <SkiaFirefly
              key={`ff-${f.id}`}
              firefly={f}
              drift={ffDrifts[i]}
              flicker={ffFlickers[i]}
              masterOpacity={atmosphereOpacity}
            />
          ))}
          {/* Hit burst rays */}
          {hitBurstPos && (
            <SkiaBurst
              cx={hitBurstPos.x}
              cy={hitBurstPos.y}
              rays={burstRays}
              progress={burstProgress}
            />
          )}
        </Canvas>
      )}

      {/* Fog overlay */}
      <Animated.View style={[styles.fogOverlay, fogStyle]} pointerEvents="none" />

      {/* Tree branches + paw prints now rendered via Skia canvas above */}

      {/* Crosshair reticle */}
      {phase === 'hunting' && !reducedMotion && (
        <Animated.View style={[styles.crosshair, crosshairStyle]} pointerEvents="none">
          <Text style={styles.crosshairText}>⊕</Text>
        </Animated.View>
      )}

      {/* Hit flash overlay */}
      <Animated.View
        style={[styles.flash, hitFlashStyle, { backgroundColor: HUNT_COLORS.hitFlash }]}
        pointerEvents="none"
      />

      {/* Hint text */}
      {phase === 'hunting' && !reducedMotion && (
        <Animated.View style={[styles.hintContainer, hintStyle]}>
          <Text style={styles.hintText}>👻 在幽灵中找到你的角色，点击捕获</Text>
        </Animated.View>
      )}
      {autoTimeoutWarning && phase === 'hunting' && (
        <View style={styles.hintContainer} pointerEvents="none">
          <Text style={styles.autoTimeoutWarning}>⏳ 即将自动揭晓…</Text>
        </View>
      )}

      {/* Ghosts — Flexbox grid, never overflows */}
      {!reducedMotion && (
        <View style={styles.ghostGrid}>
          {ghosts.map((ghost) => (
            <AnimatedGhost
              key={ghost.id}
              ghost={ghost}
              onCapture={handleCapture}
              state={ghostStates[ghost.id] ?? 'floating'}
              enableHaptics={enableHaptics}
            />
          ))}
        </View>
      )}

      {/* Celebration particles */}
      {celebrations.length > 0 && (
        <View style={styles.celebrationContainer}>
          {celebrations.map((p) => (
            <CelebrationParticle key={p.id} {...p} />
          ))}
        </View>
      )}

      {/* Capture net is now rendered via Skia canvas (SkiaCaptureSpiral) */}

      {/* Revealed card */}
      {(phase === 'revealing' || phase === 'revealed') && (
        <Animated.View
          style={[styles.cardContainer, { width: cardWidth, height: cardHeight }, cardAnimStyle]}
        >
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
              onComplete={handleGlowComplete}
            />
          )}
        </Animated.View>
      )}
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  flash: { ...StyleSheet.absoluteFillObject },
  fogOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: HUNT_COLORS.fog,
  },
  hintContainer: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    zIndex: 10,
  },
  hintText: {
    fontSize: 20,
    fontWeight: '600',
    color: HUNT_COLORS.hintText,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  autoTimeoutWarning: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255, 200, 50, 0.9)',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  ghostGrid: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    alignContent: 'center',
    paddingHorizontal: 12,
    paddingTop: '15%',
    paddingBottom: '10%',
    zIndex: 5,
  },
  ghostCell: {
    width: '33%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  ghostTouchable: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  ghostBody: {
    alignItems: 'center',
    backgroundColor: 'rgba(80, 110, 180, 0.18)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: HUNT_COLORS.ghostBodyBorder,
    overflow: 'hidden',
  },
  ghostEctoGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  ghostBadge: {
    width: 44,
    height: 44,
  },
  ghostFallbackEmoji: {
    fontSize: 38,
  },
  ghostName: {
    fontSize: 13,
    fontWeight: '600',
    color: HUNT_COLORS.ghostName,
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  celebrationContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: 15,
  },
  celebrationParticle: {
    position: 'absolute',
  },
  celebrationEmoji: {
    fontSize: 26,
  },
  cardContainer: {
    zIndex: 20,
    overflow: 'visible',
  },

  crosshair: {
    position: 'absolute',
    alignSelf: 'center',
    top: '42%',
    zIndex: 6,
  },
  crosshairText: {
    fontSize: 36,
    color: HUNT_COLORS.crosshair,
    textShadowColor: HUNT_COLORS.crosshair,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
});
