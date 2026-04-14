/**
 * ChainShatter - 锁链击碎揭示动画（Skia + Reanimated 4）
 *
 * 视觉设计：中央锁头（金属蓝钢渐变锁身 + 铆钉 + 高光提梁 + 钥匙孔光晕）
 * + 左右各 4 个链环。背景飘浮尘埃粒子增加氛围。
 * 交互：连续点击击碎（6 次），每击产生：
 *   - 累积可见裂纹（gold→red 渐变）+ glow 光晕
 *   - 径向火花粒子（8-12 个 gold/orange/white）
 *   - 扩散冲击环
 *   - 屏幕抖动 + 冲击闪光
 * 连击机制：>800ms 未击则连击数回退 1。
 * 全碎后不规则多边形碎片带旋转 + 重力爆炸 + 径向光环扩散。
 *
 * Skia 负责：锁头 + 链环 + 裂纹 + 火花 + 冲击环 + 碎片 + 尘埃。
 * Reanimated 负责：驱动所有 shared value + 阶段切换。
 * 不 import service，不含业务逻辑。
 */
import { Blur, Canvas, Circle, Group, Line, Path, Rect, vec } from '@shopify/react-native-skia';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  Easing,
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
import { colors, crossPlatformTextShadow } from '@/theme';

// ─── Visual constants ──────────────────────────────────────────────────
const BG_GRADIENT = ['#050510', '#0a0a1e', '#050510'] as const;

const COLORS = {
  /** Lock body fill — dark steel blue */
  lockBody: '#2A3040',
  /** Lock body top highlight */
  lockHighlight: '#4A5570',
  /** Lock body stroke — steel edge */
  lockStroke: '#5A6580',
  /** Shackle (提梁) — bright steel */
  shackle: '#7888A0',
  /** Shackle highlight */
  shackleHighlight: '#A0B0C8',
  /** Keyhole */
  keyhole: '#0A0A14',
  /** Keyhole glow ring */
  keyholeGlow: 'rgba(255, 180, 60, 0.35)',
  /** Chain link fill */
  chainLinkFill: '#3A4255',
  /** Chain link stroke */
  chainLinkStroke: '#6A7890',
  /** Rivet fill */
  rivetFill: '#8898B0',
  /** Rivet highlight */
  rivetHighlight: '#B0C0D8',
  /** Crack glow — starting colour (gold), transitions to red with hits */
  crackGoldStart: 'rgba(255, 200, 50, 0.9)',
  crackRedEnd: 'rgba(255, 80, 30, 0.9)',
  /** Hit flash overlay */
  breakFlash: 'rgba(255, 210, 100, 0.5)',
  /** Spark palette */
  sparkPalette: ['#FFD700', '#FFA500', '#FFFFFF', '#FFE066', '#FF8C00'] as const,
  /** Enhanced shard palette — metallic hues */
  shardPalette: ['#4A5570', '#6A7890', '#8898B0', '#3A4255', '#5A6580', '#FFD080'] as const,
  /** Hit counter & hint text */
  hitText: '#FFD700',
  /** Combo indicator */
  comboText: 'rgba(255, 200, 0, 0.7)',
  /** Dust particle */
  dustParticle: 'rgba(180, 200, 230, 0.15)',
  /** Shockwave ring */
  shockwaveRing: 'rgba(255, 200, 80, 0.6)',
  /** Radial burst on final shatter */
  radialBurst: 'rgba(255, 220, 100, 0.5)',
  /** Stone wall */
  stoneWall: 'rgba(50, 45, 40, 0.7)',
  stoneWallBorder: 'rgba(80, 70, 60, 0.5)',
  /** Torch flame */
  torchFlame: '#FF8C00',
  torchGlow: 'rgba(255, 140, 0, 0.3)',
  /** Lightning arc */
  lightningArc: 'rgba(150, 200, 255, 0.8)',
  lightningGlow: 'rgba(100, 150, 255, 0.4)',
  /** Light pillar */
  lightPillar: 'rgba(255, 215, 0, 0.6)',
  /** Spring coil */
  springColor: 'rgba(160, 170, 180, 0.6)',
  /** Ground debris */
  debrisColor: 'rgba(100, 90, 80, 0.5)',
} as const;

const CS = CONFIG.chainShatter;

/** Number of spark particles per hit */
const SPARKS_PER_HIT = 10;
/** Number of ambient dust particles */
const DUST_COUNT = 10;

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;

/** Torch positions at the sides */
const TORCH_POSITIONS = [
  { x: 20, y: SCREEN_H * 0.3, symbol: '🔥' },
  { x: SCREEN_W - 50, y: SCREEN_H * 0.35, symbol: '🔥' },
];

/** Stone wall blocks in the background */
const STONE_BLOCKS = Array.from({ length: 6 }, (_, i) => ({
  x: (i % 3) * (SCREEN_W / 3),
  y: SCREEN_H * 0.3 + Math.floor(i / 3) * 80,
  w: SCREEN_W / 3 - 4,
  h: 70,
}));

/** Ground debris particles */
const DEBRIS_PARTICLES = Array.from({ length: 10 }, (_) => ({
  x: SCREEN_W * 0.2 + Math.random() * SCREEN_W * 0.6,
  y: SCREEN_H * 0.65 + Math.random() * SCREEN_H * 0.1,
  size: 2 + Math.random() * 3,
}));

// ─── Types ──────────────────────────────────────────────────────────────
interface CrackData {
  x: number;
  y: number;
  angle: number;
  length: number;
  /** Which hit spawned this crack (0-based) — drives colour interpolation */
  hitIndex: number;
}

interface ShardData {
  vx: number;
  vy: number;
  size: number;
  color: string;
  /** Angular velocity (radians/s) for spin during flight */
  spin: number;
}

interface SparkData {
  vx: number;
  vy: number;
  color: string;
  size: number;
}

interface DustData {
  x: number;
  y: number;
  driftX: number;
  driftY: number;
  radius: number;
  driftDuration: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────
function generateShards(count: number): ShardData[] {
  const shards: ShardData[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
    const speed = 100 + Math.random() * 80;
    shards.push({
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 30,
      size: 6 + Math.random() * 14,
      color: COLORS.shardPalette[i % COLORS.shardPalette.length],
      spin: (Math.random() - 0.5) * 8,
    });
  }
  return shards;
}

function buildChainLinkPaths(
  cx: number,
  cy: number,
  lockW: number,
  linksPerSide: number,
): string[] {
  const paths: string[] = [];
  const rx = lockW * 0.11;
  const ry = lockW * 0.065;
  const startOffset = lockW * 0.7;
  const spacing = lockW * 0.22;

  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < linksPerSide; i++) {
      const lx = cx + side * (startOffset + i * spacing);
      const ly = cy + Math.sin(i * 0.8) * (lockW * 0.05);
      paths.push(
        `M ${(lx - rx).toFixed(1)} ${ly.toFixed(1)} ` +
          `A ${rx.toFixed(1)} ${ry.toFixed(1)} 0 1 0 ${(lx + rx).toFixed(1)} ${ly.toFixed(1)} ` +
          `A ${rx.toFixed(1)} ${ry.toFixed(1)} 0 1 0 ${(lx - rx).toFixed(1)} ${ly.toFixed(1)}`,
      );
    }
  }
  return paths;
}

function generateSparks(count: number): SparkData[] {
  const sparks: SparkData[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 100;
    sparks.push({
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      color: COLORS.sparkPalette[i % COLORS.sparkPalette.length],
      size: 2 + Math.random() * 3,
    });
  }
  return sparks;
}

function generateDust(screenW: number, screenH: number): DustData[] {
  const particles: DustData[] = [];
  for (let i = 0; i < DUST_COUNT; i++) {
    particles.push({
      x: Math.random() * screenW,
      y: Math.random() * screenH,
      driftX: 15 + Math.random() * 25,
      driftY: 8 + Math.random() * 15,
      radius: 1.5 + Math.random() * 2.5,
      driftDuration: 3000 + Math.random() * 4000,
    });
  }
  return particles;
}

// ─── Skia torch flame ─────────────────────────────────────────────────
interface SkiaTorchFlameProps {
  x: number;
  y: number;
  flicker: SharedValue<number>;
}

/** Torch flame: cluster of overlapping circles with warm gradient — replaces emoji 🔥 */
const SkiaTorchFlame: React.FC<SkiaTorchFlameProps> = React.memo(({ x, y, flicker }) => {
  // Outer glow
  const glowOp = useDerivedValue(() => 0.15 + flicker.value * 0.15);
  // Core flame opacity sways
  const coreOp = useDerivedValue(() => 0.7 + flicker.value * 0.3);
  // Inner white-hot tip
  const tipOp = useDerivedValue(() => 0.8 + flicker.value * 0.2);
  // Sway offset
  const swayX = useDerivedValue(() => x + 15 + Math.sin(flicker.value * Math.PI * 2) * 3);
  const tipY = useDerivedValue(() => y - 8 + Math.sin(flicker.value * Math.PI * 4) * 2);

  return (
    <Group>
      {/* Wide warm glow around the flame */}
      <Circle cx={x + 15} cy={y + 5} r={35} color={COLORS.torchGlow} opacity={glowOp}>
        <Blur blur={20} />
      </Circle>
      {/* Outer flame — reddish orange, largest */}
      <Circle cx={swayX} cy={y + 8} r={14} color="rgba(255, 80, 20, 0.7)" opacity={coreOp}>
        <Blur blur={6} />
      </Circle>
      {/* Mid flame — bright orange */}
      <Circle cx={swayX} cy={y} r={10} color="rgba(255, 160, 40, 0.85)" opacity={coreOp}>
        <Blur blur={4} />
      </Circle>
      {/* Inner flame — yellow */}
      <Circle cx={swayX} cy={tipY} r={6} color="rgba(255, 230, 80, 0.9)" opacity={tipOp}>
        <Blur blur={2} />
      </Circle>
      {/* White-hot tip */}
      <Circle cx={swayX} cy={tipY} r={3} color="rgba(255, 255, 220, 0.95)" opacity={tipOp}>
        <Blur blur={1} />
      </Circle>
    </Group>
  );
});
SkiaTorchFlame.displayName = 'SkiaTorchFlame';

/** Interpolate crack colour from gold (hit 0) to red (hit max). */
function crackColor(hitIndex: number, maxHits: number): string {
  const t = Math.min(hitIndex / Math.max(maxHits - 1, 1), 1);
  const r = Math.round(255);
  const g = Math.round(200 - t * 120);
  const b = Math.round(50 - t * 20);
  return `rgba(${r}, ${g}, ${b}, 0.9)`;
}

// ─── Skia sub-components ────────────────────────────────────────────────
interface CrackLineProps {
  crack: CrackData;
  opacity: SharedValue<number>;
  maxHits: number;
}

const CrackLine: React.FC<CrackLineProps> = ({ crack, opacity, maxHits }) => {
  const path = useMemo(() => {
    const ex = crack.x + Math.cos(crack.angle) * crack.length;
    const ey = crack.y + Math.sin(crack.angle) * crack.length;
    return `M ${crack.x.toFixed(1)} ${crack.y.toFixed(1)} L ${ex.toFixed(1)} ${ey.toFixed(1)}`;
  }, [crack]);

  const color = useMemo(() => crackColor(crack.hitIndex, maxHits), [crack.hitIndex, maxHits]);

  return (
    <Group opacity={opacity}>
      {/* Glow layer (wider, semi-transparent) */}
      <Path
        path={path}
        color={color}
        style="stroke"
        strokeWidth={6}
        strokeCap="round"
        opacity={0.4}
      />
      {/* Core crack line */}
      <Path path={path} color={color} style="stroke" strokeWidth={2} strokeCap="round" />
    </Group>
  );
};

interface SparkBurstProps {
  sparks: SparkData[];
  cx: number;
  cy: number;
  progress: SharedValue<number>;
}

const SparkBurst: React.FC<SparkBurstProps> = ({ sparks, cx, cy, progress }) => {
  return (
    <>
      {sparks.map((spark, i) => (
        <SparkParticle key={`spark-${i}`} spark={spark} cx={cx} cy={cy} progress={progress} />
      ))}
    </>
  );
};

interface SparkParticleProps {
  spark: SparkData;
  cx: number;
  cy: number;
  progress: SharedValue<number>;
}

const SparkParticle: React.FC<SparkParticleProps> = ({ spark, cx, cy, progress }) => {
  const x = useDerivedValue(() => cx + spark.vx * progress.value);
  const y = useDerivedValue(
    () => cy + spark.vy * progress.value + 60 * progress.value * progress.value,
  );
  const op = useDerivedValue(() => Math.max(0, 1 - progress.value * 1.5));
  const r = useDerivedValue(() => spark.size * Math.max(0, 1 - progress.value));

  return <Circle cx={x} cy={y} r={r} color={spark.color} opacity={op} />;
};

interface ShockwaveProps {
  cx: number;
  cy: number;
  progress: SharedValue<number>;
  maxRadius: number;
}

const Shockwave: React.FC<ShockwaveProps> = ({ cx, cy, progress, maxRadius }) => {
  const r = useDerivedValue(() => progress.value * maxRadius);
  const op = useDerivedValue(() => Math.max(0, 0.6 - progress.value * 0.8));

  return (
    <Circle
      cx={cx}
      cy={cy}
      r={r}
      color={COLORS.shockwaveRing}
      style="stroke"
      strokeWidth={2}
      opacity={op}
    />
  );
};

interface DustParticleProps {
  dust: DustData;
  progress: SharedValue<number>;
}

const DustParticle: React.FC<DustParticleProps> = ({ dust, progress }) => {
  const x = useDerivedValue(() => dust.x + Math.sin(progress.value * Math.PI * 2) * dust.driftX);
  const y = useDerivedValue(() => dust.y + Math.cos(progress.value * Math.PI * 2) * dust.driftY);
  const op = useDerivedValue(() => 0.08 + Math.sin(progress.value * Math.PI * 2) * 0.07);

  return <Circle cx={x} cy={y} r={dust.radius} color={COLORS.dustParticle} opacity={op} />;
};

interface ShardPieceProps {
  shard: ShardData;
  cx: number;
  cy: number;
  gravity: number;
  progress: SharedValue<number>;
}

const ShardPiece: React.FC<ShardPieceProps> = ({ shard, cx, cy, gravity, progress }) => {
  const halfW = shard.size / 2;
  const halfH = (shard.size * 0.6) / 2;

  // Build an irregular polygon path (pentagon-ish shape)
  const shardPath = useMemo(() => {
    const pts = [
      { x: -halfW * 0.8, y: -halfH },
      { x: halfW * 0.6, y: -halfH * 0.7 },
      { x: halfW, y: halfH * 0.3 },
      { x: halfW * 0.4, y: halfH },
      { x: -halfW, y: halfH * 0.6 },
    ];
    return (
      `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} ` +
      pts
        .slice(1)
        .map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(' ') +
      ' Z'
    );
  }, [halfW, halfH]);

  const originX = useDerivedValue(() => cx + shard.vx * progress.value);
  const originY = useDerivedValue(
    () => cy + shard.vy * progress.value + gravity * progress.value * progress.value,
  );
  const rotation = useDerivedValue(() => shard.spin * progress.value);
  const opacity = useDerivedValue(() => Math.max(0, 1 - progress.value * 1.2));

  const transform = useDerivedValue(() => [
    { translateX: originX.value },
    { translateY: originY.value },
    { rotate: rotation.value },
  ]);

  return (
    <Group transform={transform} opacity={opacity}>
      <Path path={shardPath} color={shard.color} />
      <Path path={shardPath} color="rgba(255,255,255,0.3)" style="stroke" strokeWidth={0.5} />
    </Group>
  );
};

// ─── Radial burst lines for final shatter ───────────────────────────────
interface RadialBurstProps {
  cx: number;
  cy: number;
  progress: SharedValue<number>;
  maxRadius: number;
}

const BURST_LINE_COUNT = 12;

const RadialBurst: React.FC<RadialBurstProps> = ({ cx, cy, progress, maxRadius }) => {
  const lines = useMemo(() => {
    const result: { angle: number }[] = [];
    for (let i = 0; i < BURST_LINE_COUNT; i++) {
      result.push({ angle: (i / BURST_LINE_COUNT) * Math.PI * 2 });
    }
    return result;
  }, []);

  return (
    <>
      {lines.map((line, i) => (
        <RadialBurstLine
          key={i}
          cx={cx}
          cy={cy}
          angle={line.angle}
          progress={progress}
          maxRadius={maxRadius}
        />
      ))}
    </>
  );
};

interface RadialBurstLineProps {
  cx: number;
  cy: number;
  angle: number;
  progress: SharedValue<number>;
  maxRadius: number;
}

const RadialBurstLine: React.FC<RadialBurstLineProps> = ({
  cx,
  cy,
  angle,
  progress,
  maxRadius,
}) => {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const innerR = useDerivedValue(() => progress.value * maxRadius * 0.2);
  const outerR = useDerivedValue(() => progress.value * maxRadius);
  const p1 = useDerivedValue(() => vec(cx + cosA * innerR.value, cy + sinA * innerR.value));
  const p2 = useDerivedValue(() => vec(cx + cosA * outerR.value, cy + sinA * outerR.value));
  const op = useDerivedValue(() => Math.max(0, 0.5 - progress.value * 0.7));

  return <Line p1={p1} p2={p2} color={COLORS.radialBurst} strokeWidth={2} opacity={op} />;
};

// ─── Main component ─────────────────────────────────────────────────────
type Phase = 'appear' | 'idle' | 'hitting' | 'shatter' | 'revealed';

export const ChainShatter: React.FC<RoleRevealEffectProps> = ({
  role,
  onComplete,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'chain-shatter',
}) => {
  const alignmentThemes = useMemo(() => createAlignmentThemes(colors), []);
  const theme = alignmentThemes[role.alignment];

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const common = CONFIG.common;
  const cardWidth = Math.min(screenWidth * common.cardWidthRatio, common.cardMaxWidth);
  const cardHeight = cardWidth * common.cardAspectRatio;

  const cx = screenWidth / 2;
  const cy = screenHeight / 2;
  const lockW = screenWidth * CS.lockWidthRatio;
  const lockH = lockW * 0.8;
  const gravity = screenHeight * 0.18;

  const [phase, setPhase] = useState<Phase>('appear');
  const [cracks, setCracks] = useState<CrackData[]>([]);
  const hitCountRef = useRef(0);
  const [hitCountDisplay, setHitCountDisplay] = useState(0);
  const lastHitTimeRef = useRef(0);
  const shatterTriggeredRef = useRef(false);
  const { fireComplete } = useRevealLifecycle({ onComplete });

  // ── Pre-computed geometry ──
  const chainLinkPaths = useMemo(() => buildChainLinkPaths(cx, cy, lockW, 4), [cx, cy, lockW]);
  const [allShards] = useState(() => generateShards(CS.shardCount));
  const [dustParticles] = useState(() => generateDust(screenWidth, screenHeight));

  // Spark bursts: array of { sparks, progress } per hit
  const [sparkBursts, setSparkBursts] = useState<{ sparks: SparkData[]; id: number }[]>([]);
  const sparkIdRef = useRef(0);

  // ── Shared values ──
  const chainOpacity = useSharedValue(0);
  const chainScale = useSharedValue(0);
  const lockOpacity = useSharedValue(1);
  const hitFlashOpacity = useSharedValue(0);
  const shatterProgress = useSharedValue(0);
  const canvasOpacity = useSharedValue(1);
  const cardScale = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const flashOpacity = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const shakeY = useSharedValue(0);
  const comboOpacity = useSharedValue(0);
  const comboScale = useSharedValue(1);
  const dustProgress = useSharedValue(0);

  // Per-hit shockwave progress (reused)
  const shockwaveProgress = useSharedValue(0);

  // ── New shared values for enhanced visuals ──
  const torchFlicker = useSharedValue(0);
  const lightningFlash = useSharedValue(0);
  const lightPillarOpacity = useSharedValue(0);
  const lightPillarScale = useSharedValue(0);
  const debrisVisible = useSharedValue(0);

  // Per-hit spark progress values (pool of 6)
  const sp0 = useSharedValue(0);
  const sp1 = useSharedValue(0);
  const sp2 = useSharedValue(0);
  const sp3 = useSharedValue(0);
  const sp4 = useSharedValue(0);
  const sp5 = useSharedValue(0);
  const sparkProgresses = useMemo(
    () => [sp0, sp1, sp2, sp3, sp4, sp5],
    [sp0, sp1, sp2, sp3, sp4, sp5],
  );

  // Pre-allocated crack opacities (persistent — cracks stay visible, so these stay at 1)
  const c0 = useSharedValue(0);
  const c1 = useSharedValue(0);
  const c2 = useSharedValue(0);
  const c3 = useSharedValue(0);
  const c4 = useSharedValue(0);
  const c5 = useSharedValue(0);
  const crackOpacities = useMemo(() => [c0, c1, c2, c3, c4, c5], [c0, c1, c2, c3, c4, c5]);

  // Derived value for Skia lock group opacity
  const lockSkiaOpacity = useDerivedValue(() => lockOpacity.value);

  // Radial burst progress for final shatter
  const radialBurstProgress = useSharedValue(0);

  // ── Padlock paths ──
  const shacklePath = useMemo(() => {
    const r = lockW * 0.3;
    const top = cy - lockH / 2;
    return (
      `M ${(cx - r).toFixed(1)} ${top.toFixed(1)} ` +
      `A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${(cx + r).toFixed(1)} ${top.toFixed(1)}`
    );
  }, [cx, cy, lockW, lockH]);

  const keyholePath = useMemo(() => {
    const hw = lockW * 0.04;
    const slotH = lockW * 0.2;
    return (
      `M ${(cx - hw).toFixed(1)} ${cy.toFixed(1)} ` +
      `L ${(cx - hw).toFixed(1)} ${(cy + slotH).toFixed(1)} ` +
      `L ${(cx + hw).toFixed(1)} ${(cy + slotH).toFixed(1)} ` +
      `L ${(cx + hw).toFixed(1)} ${cy.toFixed(1)} Z`
    );
  }, [cx, cy, lockW]);

  // Rivet positions (four corners of lock body)
  const rivets = useMemo(() => {
    const inset = lockW * 0.15;
    const lx = cx - lockW / 2 + inset;
    const rx = cx + lockW / 2 - inset;
    const ty = cy - lockH / 2 + inset;
    const by = cy + lockH / 2 - inset;
    return [
      { x: lx, y: ty },
      { x: rx, y: ty },
      { x: lx, y: by },
      { x: rx, y: by },
    ];
  }, [cx, cy, lockW, lockH]);

  // ── Phase transitions ──
  const enterRevealed = useCallback(() => setPhase('revealed'), []);

  // ── Appear animation ──
  useEffect(() => {
    if (reducedMotion) {
      cardScale.value = 1;
      cardOpacity.value = 1;
      canvasOpacity.value = 0;
      setPhase('revealed');
      return;
    }

    // Start ambient dust drift
    dustProgress.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1);

    // Torch flame flicker
    torchFlicker.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 300, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.4, { duration: 200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.8, { duration: 250, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.3, { duration: 350, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );

    chainOpacity.value = withTiming(1, { duration: CS.chainAppearDuration / 2 });
    chainScale.value = withTiming(
      1,
      { duration: CS.chainAppearDuration, easing: Easing.out(Easing.back(1.15)) },
      (finished) => {
        'worklet';
        if (finished) runOnJS(setPhase)('idle');
      },
    );
  }, [
    reducedMotion,
    chainOpacity,
    chainScale,
    cardScale,
    cardOpacity,
    canvasOpacity,
    dustProgress,
    torchFlicker,
  ]);

  // ── Trigger final shatter ──
  const triggerShatter = useCallback(() => {
    if (shatterTriggeredRef.current) return;
    shatterTriggeredRef.current = true;

    setPhase('shatter');
    if (enableHaptics) triggerHaptic('heavy', true);

    // Hide lock instantly
    lockOpacity.value = withTiming(0, { duration: 150 });

    // Screen flash
    flashOpacity.value = withSequence(
      withTiming(0.7, { duration: 80 }),
      withTiming(0, { duration: 500 }),
    );

    // Radial burst lines
    radialBurstProgress.value = 0;
    radialBurstProgress.value = withTiming(1, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });

    // Explode shards with gravity
    shatterProgress.value = withTiming(1, {
      duration: CS.shatterDuration,
      easing: Easing.out(Easing.cubic),
    });

    // Fade canvas
    canvasOpacity.value = withDelay(400, withTiming(0, { duration: 400 }));

    // Card reveal
    cardScale.value = withDelay(
      500,
      withTiming(
        1,
        { duration: CS.cardRevealDuration, easing: Easing.out(Easing.back(1.15)) },
        (finished) => {
          'worklet';
          if (finished) runOnJS(enterRevealed)();
        },
      ),
    );
    cardOpacity.value = withDelay(500, withTiming(1, { duration: CS.cardRevealDuration }));

    // Freedom light pillar
    lightPillarScale.value = withDelay(
      300,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
    lightPillarOpacity.value = withDelay(
      300,
      withSequence(withTiming(0.8, { duration: 300 }), withTiming(0, { duration: 800 })),
    );
  }, [
    enableHaptics,
    lockOpacity,
    flashOpacity,
    radialBurstProgress,
    shatterProgress,
    canvasOpacity,
    cardScale,
    cardOpacity,
    enterRevealed,
    lightPillarScale,
    lightPillarOpacity,
  ]);

  // ── Auto-timeout (warning + 8s auto-shatter) ──
  const autoTimeoutWarning = useAutoTimeout(
    phase === 'idle' || phase === 'hitting',
    triggerShatter,
  );

  // ── Handle hit ──
  const handlePress = useCallback(() => {
    if (phase !== 'idle' && phase !== 'hitting') return;

    const now = Date.now();
    let current = hitCountRef.current;

    // Combo decay: too slow → lose 1 hit
    if (current > 0 && now - lastHitTimeRef.current > CS.comboTimeout) {
      current = Math.max(0, current - 1);
    }

    current++;
    hitCountRef.current = current;
    lastHitTimeRef.current = now;
    setHitCountDisplay(current);

    if (phase === 'idle') setPhase('hitting');
    if (enableHaptics) triggerHaptic('medium', true);

    // Add persistent crack near lock center
    const crackIdx = Math.min(current - 1, crackOpacities.length - 1);
    const newCrack: CrackData = {
      x: cx + (Math.random() - 0.5) * lockW * 0.6,
      y: cy + (Math.random() - 0.5) * lockH * 0.6,
      angle: Math.random() * Math.PI * 2,
      length: lockW * 0.2 + Math.random() * lockW * 0.4,
      hitIndex: current - 1,
    };
    setCracks((prev) => [...prev, newCrack]);

    // Crack stays visible (flash in → hold) instead of fading out
    crackOpacities[crackIdx].value = withSequence(
      withTiming(1, { duration: 50 }),
      withTiming(0.85, { duration: 200 }),
    );

    // Spawn spark burst
    const newSparks = generateSparks(SPARKS_PER_HIT);
    const sparkId = sparkIdRef.current++;
    setSparkBursts((prev) => [...prev.slice(-5), { sparks: newSparks, id: sparkId }]);

    // Animate spark progress
    const spIdx = crackIdx % sparkProgresses.length;
    sparkProgresses[spIdx].value = 0;
    sparkProgresses[spIdx].value = withTiming(1, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });

    // Shockwave ring
    shockwaveProgress.value = 0;
    shockwaveProgress.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) });

    // Combo indicator pop
    comboScale.value = withSequence(
      withTiming(1.4, { duration: 80 }),
      withTiming(1, { duration: 150 }),
    );
    comboOpacity.value = withSequence(
      withTiming(0.8, { duration: 50 }),
      withTiming(0, { duration: CS.comboTimeout }),
    );

    // Hit flash
    hitFlashOpacity.value = withSequence(
      withTiming(0.35, { duration: 40 }),
      withTiming(0, { duration: 120 }),
    );

    // Lightning flash (visible above 3 hits)
    if (current >= 3) {
      lightningFlash.value = withSequence(
        withTiming(1, { duration: 50 }),
        withTiming(0, { duration: 200 }),
      );
    }

    // Show debris after first hit
    debrisVisible.value = withTiming(1, { duration: 200 });

    // Shake (X + Y for more dynamic feel)
    const intensity = Math.min(current / CS.requiredHits, 1);
    const amp = 6 + intensity * 8;
    shakeX.value = withSequence(
      withTiming(-amp, { duration: 25 }),
      withTiming(amp, { duration: 25 }),
      withTiming(-amp * 0.5, { duration: 25 }),
      withTiming(0, { duration: 25 }),
    );
    shakeY.value = withSequence(
      withTiming(-amp * 0.5, { duration: 30 }),
      withTiming(amp * 0.3, { duration: 30 }),
      withTiming(0, { duration: 30 }),
    );

    // All hits done → shatter
    if (current >= CS.requiredHits) {
      setTimeout(() => triggerShatter(), 200);
    }
  }, [
    phase,
    enableHaptics,
    cx,
    cy,
    lockW,
    lockH,
    crackOpacities,
    sparkProgresses,
    shockwaveProgress,
    comboOpacity,
    comboScale,
    hitFlashOpacity,
    lightningFlash,
    debrisVisible,
    shakeX,
    shakeY,
    triggerShatter,
  ]);

  // ── Animated styles ──
  const chainContainerStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: chainScale.value },
      { translateX: shakeX.value },
      { translateY: shakeY.value },
    ],
    opacity: chainOpacity.value,
  }));

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

  const hitFlashStyle = useAnimatedStyle(() => ({
    opacity: hitFlashOpacity.value,
  }));

  const comboStyle = useAnimatedStyle(() => ({
    opacity: comboOpacity.value,
    transform: [{ scale: comboScale.value }],
  }));

  const lightPillarStyle = useAnimatedStyle(() => ({
    opacity: lightPillarOpacity.value,
    transform: [{ scaleY: lightPillarScale.value }],
  }));

  const hitsRemaining = Math.max(0, CS.requiredHits - hitCountDisplay);

  return (
    <View style={styles.container} testID={`${testIDPrefix}-container`}>
      {/* Immersive dark background */}
      <LinearGradient
        colors={[...BG_GRADIENT]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <AtmosphericBackground color={theme.primaryColor} animate={!reducedMotion} />

      {/* Stone wall blocks in background */}
      {!reducedMotion && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {STONE_BLOCKS.map((block, i) => (
            <View
              key={`stone-${i}`}
              style={[
                styles.stoneBlock,
                { left: block.x + 2, top: block.y, width: block.w, height: block.h },
              ]}
            />
          ))}
        </View>
      )}

      {/* Wall torch brackets (bolt only — flame is rendered in Skia canvas) */}
      {!reducedMotion &&
        TORCH_POSITIONS.map((torch, i) => (
          <View
            key={`torch-bracket-${i}`}
            style={[styles.torch, { left: torch.x + 8, top: torch.y + 30 }]}
            pointerEvents="none"
          >
            <Text style={styles.torchBracket}>🔩</Text>
          </View>
        ))}

      {/* Ambient dust particles + Skia torch flames (full-screen Skia canvas behind lock) */}
      {phase !== 'revealed' && !reducedMotion && (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          {dustParticles.map((dust, i) => (
            <DustParticle key={`dust-${i}`} dust={dust} progress={dustProgress} />
          ))}
          {/* Skia torch flames — warm glowing fire clusters */}
          {TORCH_POSITIONS.map((torch, i) => (
            <SkiaTorchFlame
              key={`skia-torch-${i}`}
              x={torch.x}
              y={torch.y}
              flicker={torchFlicker}
            />
          ))}
        </Canvas>
      )}

      {/* Pressable overlay for tap interaction */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={handlePress}
        testID={`${testIDPrefix}-tap-area`}
      >
        <Animated.View style={[StyleSheet.absoluteFill, canvasContainerStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, chainContainerStyle]}>
            {/* Skia: lock + chains + cracks + sparks + shockwaves */}
            <Canvas style={StyleSheet.absoluteFill}>
              {/* Lock + chains (fade to 0 on shatter) */}
              <Group opacity={lockSkiaOpacity}>
                {/* Lock body fill — dark steel */}
                <Rect
                  x={cx - lockW / 2}
                  y={cy - lockH / 2}
                  width={lockW}
                  height={lockH}
                  color={COLORS.lockBody}
                />
                {/* Lock body top highlight band */}
                <Rect
                  x={cx - lockW / 2}
                  y={cy - lockH / 2}
                  width={lockW}
                  height={lockH * 0.15}
                  color={COLORS.lockHighlight}
                  opacity={0.5}
                />
                {/* Lock body stroke — steel edge */}
                <Rect
                  x={cx - lockW / 2}
                  y={cy - lockH / 2}
                  width={lockW}
                  height={lockH}
                  color={COLORS.lockStroke}
                  style="stroke"
                  strokeWidth={2.5}
                />

                {/* Shackle (semi-circle arc above lock body) */}
                <Path
                  path={shacklePath}
                  color={COLORS.shackle}
                  style="stroke"
                  strokeWidth={lockW * 0.1}
                  strokeCap="round"
                />
                {/* Shackle highlight (thinner inner arc) */}
                <Path
                  path={shacklePath}
                  color={COLORS.shackleHighlight}
                  style="stroke"
                  strokeWidth={lockW * 0.03}
                  strokeCap="round"
                  opacity={0.4}
                />

                {/* Keyhole glow ring */}
                <Circle cx={cx} cy={cy} r={lockW * 0.16} color={COLORS.keyholeGlow} />
                {/* Keyhole circle */}
                <Circle cx={cx} cy={cy} r={lockW * 0.1} color={COLORS.keyhole} />
                {/* Keyhole slot */}
                <Path path={keyholePath} color={COLORS.keyhole} />

                {/* Rivets at four corners */}
                {rivets.map((rivet, i) => (
                  <React.Fragment key={`rivet-${i}`}>
                    <Circle cx={rivet.x} cy={rivet.y} r={lockW * 0.035} color={COLORS.rivetFill} />
                    <Circle
                      cx={rivet.x}
                      cy={rivet.y}
                      r={lockW * 0.035}
                      color={COLORS.rivetHighlight}
                      style="stroke"
                      strokeWidth={1}
                      opacity={0.5}
                    />
                    {/* Rivet highlight dot */}
                    <Circle
                      cx={rivet.x - lockW * 0.01}
                      cy={rivet.y - lockW * 0.01}
                      r={lockW * 0.012}
                      color={COLORS.rivetHighlight}
                      opacity={0.6}
                    />
                  </React.Fragment>
                ))}

                {/* Chain links with fill + stroke for depth */}
                {chainLinkPaths.map((d, i) => (
                  <React.Fragment key={`link-${i}`}>
                    <Path path={d} color={COLORS.chainLinkFill} />
                    <Path path={d} color={COLORS.chainLinkStroke} style="stroke" strokeWidth={3} />
                  </React.Fragment>
                ))}
              </Group>

              {/* Persistent crack lines (accumulate, gold→red) */}
              {cracks.map((crack, i) => (
                <CrackLine
                  key={`crack-${i}`}
                  crack={crack}
                  opacity={crackOpacities[Math.min(i, crackOpacities.length - 1)]}
                  maxHits={CS.requiredHits}
                />
              ))}

              {/* Per-hit spark bursts */}
              {sparkBursts.map((burst, bIdx) => (
                <SparkBurst
                  key={`burst-${burst.id}`}
                  sparks={burst.sparks}
                  cx={cx}
                  cy={cy}
                  progress={sparkProgresses[bIdx % sparkProgresses.length]}
                />
              ))}

              {/* Hit shockwave ring */}
              {(phase === 'hitting' || phase === 'idle') && (
                <Shockwave cx={cx} cy={cy} progress={shockwaveProgress} maxRadius={lockW * 0.8} />
              )}

              {/* Lightning arcs between cracks (visible after 3+ hits) */}
              <Group opacity={lightningFlash}>
                <Line
                  p1={vec(cx - lockW * 0.25, cy - lockH * 0.2)}
                  p2={vec(cx + lockW * 0.15, cy + lockH * 0.15)}
                  color={COLORS.lightningArc}
                  strokeWidth={2}
                  style="stroke"
                />
                <Line
                  p1={vec(cx + lockW * 0.2, cy - lockH * 0.15)}
                  p2={vec(cx - lockW * 0.1, cy + lockH * 0.2)}
                  color={COLORS.lightningArc}
                  strokeWidth={2}
                  style="stroke"
                />
                {/* Lightning glow */}
                <Line
                  p1={vec(cx - lockW * 0.25, cy - lockH * 0.2)}
                  p2={vec(cx + lockW * 0.15, cy + lockH * 0.15)}
                  color={COLORS.lightningGlow}
                  strokeWidth={6}
                  style="stroke"
                >
                  <Blur blur={4} />
                </Line>
              </Group>

              {/* Ground debris (accumulate after hits) */}
              <Group opacity={debrisVisible}>
                {DEBRIS_PARTICLES.map((d, i) => (
                  <Circle
                    key={`debris-${i}`}
                    cx={d.x}
                    cy={d.y}
                    r={d.size}
                    color={COLORS.debrisColor}
                  />
                ))}
              </Group>
            </Canvas>

            {/* Hit counter inside shake container */}
            {(phase === 'idle' || phase === 'hitting') && (
              <View
                style={[styles.centeredOverlay, { top: cy + lockH / 2 + 30 }]}
                pointerEvents="none"
              >
                <Text style={styles.hitCounterText}>
                  {hitCountDisplay} / {CS.requiredHits}
                </Text>
              </View>
            )}

            {/* Combo indicator (× N above lock, pops + fades) */}
            {phase === 'hitting' && hitCountDisplay > 0 && (
              <Animated.View
                style={[
                  styles.centeredOverlay,
                  comboStyle,
                  { top: cy - lockH / 2 - lockW * 0.3 - 40 },
                ]}
                pointerEvents="none"
              >
                <Text style={styles.comboText}>× {hitCountDisplay}</Text>
              </Animated.View>
            )}
          </Animated.View>

          {/* Shard particles + radial burst (after shatter, with gravity + spin) */}
          {phase === 'shatter' && (
            <Canvas style={StyleSheet.absoluteFill}>
              <RadialBurst
                cx={cx}
                cy={cy}
                progress={radialBurstProgress}
                maxRadius={screenWidth * 0.5}
              />
              {allShards.map((shard, i) => (
                <ShardPiece
                  key={`shard-${i}`}
                  shard={shard}
                  cx={cx}
                  cy={cy}
                  gravity={gravity}
                  progress={shatterProgress}
                />
              ))}
            </Canvas>
          )}
        </Animated.View>

        {/* Hit flash overlay */}
        <Animated.View
          style={[styles.flash, hitFlashStyle, { backgroundColor: COLORS.breakFlash }]}
          pointerEvents="none"
        />

        {/* Screen flash */}
        <Animated.View
          style={[styles.flash, flashStyle, { backgroundColor: theme.glowColor }]}
          pointerEvents="none"
        />
      </Pressable>

      {/* Hint text */}
      <HintWithWarning
        hintText={
          phase === 'appear'
            ? '⛓️ 锁链封印中'
            : phase === 'idle' || phase === 'hitting'
              ? `⛓️ 连续点击击碎锁链${hitsRemaining > 0 ? `（剩 ${hitsRemaining} 次）` : ''}`
              : phase === 'shatter'
                ? '💥 锁链已碎！'
                : null
        }
        showWarning={autoTimeoutWarning}
      />

      {/* Exposed spring coils (visible through cracks during hitting) */}
      {phase === 'hitting' && hitCountDisplay >= 3 && (
        <View style={styles.springContainer} pointerEvents="none">
          <Text style={styles.springText}>⌇⌇⌇</Text>
        </View>
      )}

      {/* Freedom light pillar (on shatter/reveal) */}
      {(phase === 'shatter' || phase === 'revealed') && (
        <Animated.View style={[styles.lightPillar, lightPillarStyle]} pointerEvents="none" />
      )}

      {/* Revealed card */}
      {(phase === 'shatter' || phase === 'revealed') && (
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
  centeredOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hitCounterText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.hitText,
    ...crossPlatformTextShadow('rgba(0, 0, 0, 0.8)', 0, 1, 6),
  },
  comboText: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.comboText,
    ...crossPlatformTextShadow('rgba(0, 0, 0, 0.9)', 0, 2, 8),
  },

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
  stoneBlock: {
    position: 'absolute',
    backgroundColor: COLORS.stoneWall,
    borderWidth: 1,
    borderColor: COLORS.stoneWallBorder,
    borderRadius: 2,
  },
  torch: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 2,
  },
  torchBracket: {
    fontSize: 14,
    marginTop: -4,
  },
  springContainer: {
    position: 'absolute',
    alignSelf: 'center',
    top: '48%',
    zIndex: 3,
  },
  springText: {
    fontSize: 18,
    color: COLORS.springColor,
    letterSpacing: 4,
  },
  lightPillar: {
    position: 'absolute',
    alignSelf: 'center',
    top: 0,
    width: 40,
    height: '100%',
    backgroundColor: COLORS.lightPillar,
    zIndex: 1,
  },
});
