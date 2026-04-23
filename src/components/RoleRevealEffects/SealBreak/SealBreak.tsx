/**
 * SealBreak - 封印解除揭示动画（SVG + Reanimated 4）
 *
 * 视觉设计：中央深红蜡封圆盘 + 外圈旋转符文魔法阵 + 内聚能量粒子。
 * 交互：长按封印中心灌注能量，环形进度从 0→100%，裂纹随进度扩展，
 * 松手进度缓慢回退。满能后白光爆闪 → 碎片四散 → 角色卡放大显示。
 *
 * Skia 负责：封印圆盘 + 符文环 + 裂纹 path + 能量粒子 + 碎片。
 * Reanimated 负责：驱动所有 shared value + 阶段切换。
 * 不 import service，不含业务逻辑。
 */
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle as SvgCircle,
  Defs,
  FeGaussianBlur,
  Filter,
  G,
  Line as SvgLine,
  LinearGradient as SvgLinearGradient,
  Path as SvgPath,
  Rect as SvgRect,
  Stop,
} from 'react-native-svg';

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

const AnimatedSvgCircle = Animated.createAnimatedComponent(SvgCircle);
const AnimatedSvgRect = Animated.createAnimatedComponent(SvgRect);
const AnimatedSvgPath = Animated.createAnimatedComponent(SvgPath);
const AnimatedG = Animated.createAnimatedComponent(G);

// ─── Visual constants ──────────────────────────────────────────────────
/** Background gradient: deep crimson-black to complement gold seal glow */
const BG_GRADIENT = ['#0a0810', '#100c1a', '#0a0810'] as const;

const COLORS = {
  /** Wax seal base */
  waxDark: '#8B1A1A',
  waxMid: '#B22222',
  waxLight: '#CD5C5C',
  /** Symbol / rune color */
  rune: '#FFD700',
  runeGlow: 'rgba(255, 215, 0, 0.4)',
  /** Crack lines */
  crack: '#FFE4B5',
  crackGlow: 'rgba(255, 228, 181, 0.6)',
  /** Shard colors */
  shardColors: ['#8B1A1A', '#B22222', '#CD5C5C', '#A52A2A', '#DC143C'],
  /** Background glow */
  auraInner: 'rgba(255, 215, 0, 0.3)',
  auraOuter: 'rgba(139, 26, 26, 0.0)',
  /** Progress ring color */
  progressRing: '#FFD700',
  progressRingBg: 'rgba(255, 215, 0, 0.15)',
  /** Energy particle */
  energyParticle: 'rgba(255, 215, 0, 0.6)',
  /** Charging glow around seal */
  chargeGlow: 'rgba(255, 200, 50, 0.4)',
  /** Dark fog */
  fogColor: 'rgba(20, 10, 30, 0.6)',
  /** Fire embers */
  emberCore: '#FF6B00',
  emberGlow: 'rgba(255, 107, 0, 0.4)',
  /** Energy beams */
  energyBeam: 'rgba(255, 215, 0, 0.5)',
  energyBeamBright: 'rgba(255, 230, 100, 0.7)',
  /** Chain */
  chainColor: 'rgba(160, 160, 160, 0.6)',
  /** Ancient text */
  ancientText: 'rgba(180, 160, 120, 0.4)',
  /** Wax drip */
  waxDrip: '#6B1010',
  /** Seal pulse */
  sealPulse: 'rgba(255, 215, 0, 0.2)',
} as const;

const SB = CONFIG.sealBreak;

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;

/** Fire embers — small particles rising from the seal */
const EMBERS = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  startX: SCREEN_W * 0.3 + Math.random() * SCREEN_W * 0.4,
  startY: SCREEN_H * 0.5 + Math.random() * SCREEN_H * 0.15,
  drift: (Math.random() - 0.5) * 30,
  size: 2 + Math.random() * 2.5,
}));

/** Fog circles at bottom/edges for dark atmosphere */
const FOG_CIRCLES = [
  { x: 0, y: SCREEN_H * 0.65, r: 130 },
  { x: SCREEN_W, y: SCREEN_H * 0.7, r: 110 },
  { x: SCREEN_W * 0.3, y: SCREEN_H, r: 150 },
  { x: SCREEN_W * 0.7, y: SCREEN_H * 0.95, r: 120 },
];

/** Energy beam angles — 8 radial beams from seal center */
const ENERGY_BEAM_ANGLES = Array.from({ length: 8 }, (_, i) => ((Math.PI * 2) / 8) * i);

/** Chain symbol positions around outer ring */
const CHAIN_POSITIONS = Array.from({ length: 6 }, (_, i) => ({
  angle: ((Math.PI * 2) / 6) * i + Math.PI / 6,
}));

/** Ancient text symbols (counter-rotating ring) */
const ANCIENT_TEXT_SYMBOLS = ['𐤀', '𐤁', '𐤂', '𐤃', '𐤄', '𐤅', '𐤆', '𐤇', '𐤈', '𐤉'];

/** Wax drip positions around seal rim (biased toward bottom half) */
const WAX_DRIPS = Array.from({ length: 5 }, (_, i) => {
  const angle = Math.PI * 0.3 + ((Math.PI * 0.4) / 4) * i;
  return { angle, length: 12 + Math.random() * 18 };
});

// ─── Types ──────────────────────────────────────────────────────────────
interface ShardData {
  id: number;
  angle: number;
  distance: number;
  size: number;
  color: string;
}

interface EnergyParticle {
  id: number;
  /** Starting angle on the outer ring */
  startAngle: number;
  /** Speed multiplier */
  speed: number;
  /** Orbit radius offset */
  radiusOffset: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────
function generateShards(count: number): ShardData[] {
  const result: ShardData[] = [];
  for (let i = 0; i < count; i++) {
    const angle = ((Math.PI * 2) / count) * i + (Math.random() - 0.5) * 0.4;
    result.push({
      id: i,
      angle,
      distance: 120 + Math.random() * 200,
      size: 6 + Math.random() * 12,
      color: COLORS.shardColors[i % COLORS.shardColors.length],
    });
  }
  return result;
}

function generateEnergyParticles(count: number): EnergyParticle[] {
  const result: EnergyParticle[] = [];
  for (let i = 0; i < count; i++) {
    result.push({
      id: i,
      startAngle: ((Math.PI * 2) / count) * i,
      speed: 0.8 + Math.random() * 0.4,
      radiusOffset: Math.random() * 0.3,
    });
  }
  return result;
}

function buildCrackPaths(cx: number, cy: number, radius: number, count: number): string[] {
  const paths: string[] = [];
  for (let i = 0; i < count; i++) {
    const angle = ((Math.PI * 2) / count) * i;
    const segments = 4;
    let d = `M ${cx} ${cy}`;
    for (let s = 1; s <= segments; s++) {
      const frac = s / segments;
      const drift = (Math.random() - 0.5) * radius * 0.15;
      const x = cx + Math.cos(angle) * radius * frac + Math.cos(angle + Math.PI / 2) * drift;
      const y = cy + Math.sin(angle) * radius * frac + Math.sin(angle + Math.PI / 2) * drift;
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    paths.push(d);
  }
  return paths;
}

/** Build an SVG arc path segment for the progress ring. */
function buildArcPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const sA = startAngle - Math.PI / 2; // rotate so top = 0
  const eA = endAngle - Math.PI / 2;
  const x1 = cx + r * Math.cos(sA);
  const y1 = cy + r * Math.sin(sA);
  const x2 = cx + r * Math.cos(eA);
  const y2 = cy + r * Math.sin(eA);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

// ─── Shard particle (worklet-driven) ────────────────────────────────────
interface ShardParticleProps {
  shard: ShardData;
  cx: number;
  cy: number;
  progress: SharedValue<number>;
}

const ShardParticle: React.FC<ShardParticleProps> = ({ shard, cx, cy, progress }) => {
  const endX = cx + Math.cos(shard.angle) * shard.distance;
  const endY = cy + Math.sin(shard.angle) * shard.distance;

  const animatedProps = useAnimatedProps(() => ({
    x: interpolate(progress.value, [0, 1], [cx, endX]) - shard.size / 2,
    y: interpolate(progress.value, [0, 1], [cy, endY]) - shard.size / 2,
    opacity: interpolate(progress.value, [0, 0.5, 1], [1, 0.8, 0]),
  }));

  return (
    <AnimatedSvgRect
      width={shard.size}
      height={shard.size}
      fill={shard.color}
      animatedProps={animatedProps}
    />
  );
};

// ─── Energy particle (converges toward seal as charge increases) ────────
interface EnergyParticleComponentProps {
  particle: EnergyParticle;
  cx: number;
  cy: number;
  outerRadius: number;
  charge: SharedValue<number>;
  rotationOffset: SharedValue<number>;
}

const EnergyParticleComponent: React.FC<EnergyParticleComponentProps> = ({
  particle,
  cx,
  cy,
  outerRadius,
  charge,
  rotationOffset,
}) => {
  const animatedProps = useAnimatedProps(() => {
    const currentAngle = particle.startAngle + rotationOffset.value * particle.speed;
    const currentRadius =
      outerRadius * (1.4 + particle.radiusOffset) -
      charge.value * outerRadius * (0.5 + particle.radiusOffset);
    return {
      cx: cx + Math.cos(currentAngle) * currentRadius - 3,
      cy: cy + Math.sin(currentAngle) * currentRadius - 3,
      opacity: interpolate(charge.value, [0, 0.1, 0.5], [0, 0.5, 0.9]),
    };
  });

  return <AnimatedSvgCircle r={3} fill={COLORS.energyParticle} animatedProps={animatedProps} />;
};

// ─── Progress ring segment (lights up when charge exceeds threshold) ────
interface ProgressSegmentProps {
  path: string;
  threshold: number;
  charge: SharedValue<number>;
}

const ProgressSegment: React.FC<ProgressSegmentProps> = ({ path, threshold, charge }) => {
  const animatedProps = useAnimatedProps(() => {
    const active = charge.value > threshold;
    return {
      strokeDashoffset: active ? 0 : 1,
      opacity: active
        ? interpolate(charge.value, [threshold, Math.min(threshold + 0.05, 1)], [0.5, 1])
        : 0,
    };
  });

  return (
    <AnimatedSvgPath
      d={path}
      stroke={COLORS.progressRing}
      fill="none"
      strokeWidth={4}
      strokeLinecap="round"
      {...{ pathLength: 1 }}
      strokeDasharray="1"
      animatedProps={animatedProps}
    />
  );
};

// ─── Fire ember particle (Skia, rises with cycle) ──────────────────────
interface EmberParticleProps {
  startX: number;
  startY: number;
  drift: number;
  size: number;
  cycle: SharedValue<number>;
  chargeLevel: SharedValue<number>;
}

const EmberParticle: React.FC<EmberParticleProps> = ({
  startX,
  startY,
  drift,
  size,
  cycle,
  chargeLevel,
}) => {
  const groupProps = useAnimatedProps(() => ({
    opacity: interpolate(cycle.value, [0, 0.2, 0.7, 1], [0, 0.8 * chargeLevel.value, 0.3, 0]),
  }));
  const posProps = useAnimatedProps(() => ({
    cx: startX + Math.sin(cycle.value * Math.PI * 2) * drift,
    cy: startY - cycle.value * 180,
  }));
  const glowPosProps = useAnimatedProps(() => ({
    cx: startX + Math.sin(cycle.value * Math.PI * 2) * drift,
    cy: startY - cycle.value * 180,
  }));

  return (
    <AnimatedG animatedProps={groupProps}>
      <AnimatedSvgCircle r={size} fill={COLORS.emberCore} animatedProps={posProps} />
      <AnimatedSvgCircle
        r={size * 2}
        fill="black"
        filter="url(#ember-blur)"
        animatedProps={glowPosProps}
      />
    </AnimatedG>
  );
};

// ─── Crack line with animated progress (SVG pathLength + dashoffset) ────
interface CrackLineSvgProps {
  path: string;
  color: string;
  strokeWidth: number;
  progress: SharedValue<number>;
  opacity?: number;
}

const CrackLineSvg: React.FC<CrackLineSvgProps> = ({
  path,
  color,
  strokeWidth,
  progress,
  opacity: staticOpacity = 1,
}) => {
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: 1 - progress.value,
  }));

  return (
    <AnimatedSvgPath
      d={path}
      stroke={color}
      fill="none"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      opacity={staticOpacity}
      {...{ pathLength: 1 }}
      strokeDasharray="1"
      animatedProps={animatedProps}
    />
  );
};

// ─── Chain symbol (RN Animated.Text, rattles during charge) ─────────────
interface ChainSymbolProps {
  angle: number;
  cx: number;
  cy: number;
  radius: number;
  rattle: SharedValue<number>;
}

const ChainSymbol: React.FC<ChainSymbolProps> = ({ angle, cx, cy, radius, rattle }) => {
  const style = useAnimatedStyle(() => ({
    left: cx + Math.cos(angle) * radius - 12,
    top: cy + Math.sin(angle) * radius - 12 + Math.sin(rattle.value * Math.PI * 6) * 3,
    opacity: interpolate(rattle.value, [0, 0.5, 1], [0.5, 0.8, 0.5]),
  }));

  return <Animated.Text style={[styles.chainText, style]}>⛓</Animated.Text>;
};

// ─── Ancient text symbol (counter-rotating ring) ────────────────────────
interface AncientTextSymbolProps {
  symbol: string;
  baseAngle: number;
  cx: number;
  cy: number;
  orbitR: number;
  rotation: SharedValue<number>;
}

const AncientTextSymbol: React.FC<AncientTextSymbolProps> = ({
  symbol,
  baseAngle,
  cx,
  cy,
  orbitR,
  rotation,
}) => {
  const animStyle = useAnimatedStyle(() => {
    const a = baseAngle - rotation.value; // counter-rotate
    return {
      left: cx + Math.cos(a) * orbitR - 8,
      top: cy + Math.sin(a) * orbitR - 8,
    };
  });

  return <Animated.Text style={[styles.ancientText, animStyle]}>{symbol}</Animated.Text>;
};

// ─── Outer rune symbol (extracted to avoid hook-in-callback violation) ──
interface OuterRuneSymbolProps {
  symbol: string;
  baseAngle: number;
  cx: number;
  cy: number;
  orbitR: number;
  runeRotation: SharedValue<number>;
}

const OuterRuneSymbol: React.FC<OuterRuneSymbolProps> = ({
  symbol,
  baseAngle,
  cx,
  cy,
  orbitR,
  runeRotation,
}) => {
  const animStyle = useAnimatedStyle(() => {
    const a = baseAngle + runeRotation.value;
    return {
      left: cx + Math.cos(a) * orbitR - 10,
      top: cy + Math.sin(a) * orbitR - 10,
    };
  });

  return <Animated.Text style={[styles.outerRuneText, animStyle]}>{symbol}</Animated.Text>;
};

// ─── Main component ─────────────────────────────────────────────────────
type Phase = 'appear' | 'idle' | 'charging' | 'shatter' | 'revealed';

export const SealBreak: React.FC<RoleRevealEffectProps> = ({
  role,
  onComplete,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'seal-break',
}) => {
  const alignmentThemes = useMemo(() => createAlignmentThemes(colors), []);
  const theme = alignmentThemes[role.alignment];

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const common = CONFIG.common;
  const cardWidth = Math.min(screenWidth * common.cardWidthRatio, common.cardMaxWidth);
  const cardHeight = cardWidth * common.cardAspectRatio;

  const cx = screenWidth / 2;
  const cy = screenHeight / 2;
  const sealRadius = screenWidth * SB.sealRadiusRatio;

  // ── Config-driven tuning params (converted to per-ms rates) ──
  const chargeRate = 1 / SB.chargeDuration; // per ms
  const decayRate = SB.decayRate / 1000; // per ms

  const [phase, setPhase] = useState<Phase>('appear');
  const { fireComplete } = useRevealLifecycle({ onComplete });
  const shatterTriggeredRef = useRef(false);

  // ── Charging state (JS-side for requestAnimationFrame loop) ──
  const chargeRef = useRef(0);
  const isPresentRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const lastHapticRef = useRef(0);
  const pressInTimeRef = useRef(0);

  // ── Pre-computed geometry ──
  const [shards] = useState(() => generateShards(SB.shardCount));
  const [crackSVGs] = useState(() => buildCrackPaths(cx, cy, sealRadius, SB.crackCount));
  const [energyParticles] = useState(() => generateEnergyParticles(SB.energyParticleCount));

  // ── Shared values ──
  const sealScale = useSharedValue(0);
  const sealOpacity = useSharedValue(0);
  const charge = useSharedValue(0); // 0 -> 1 = charging progress
  const crackProgress = useSharedValue(0); // follows charge
  const shatterProgress = useSharedValue(0);
  const canvasOpacity = useSharedValue(1);
  const cardScale = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const flashOpacity = useSharedValue(0);
  const runeRotation = useSharedValue(0);
  const energyRotation = useSharedValue(0);
  const chargeGlowOpacity = useSharedValue(0);

  // ── New shared values for enhanced visuals ──
  const fogPulse = useSharedValue(0);
  const emberCycle = useSharedValue(0);
  const chainRattle = useSharedValue(0);
  const energyBeamOpacity = useSharedValue(0);
  const ancientTextRotation = useSharedValue(0);
  const sealPulseScale = useSharedValue(1);

  // ── Phase transitions ──
  const enterRevealed = useCallback(() => setPhase('revealed'), []);

  // ── Trigger final shatter ──
  const triggerShatter = useCallback(() => {
    if (shatterTriggeredRef.current) return;
    shatterTriggeredRef.current = true;

    setPhase('shatter');
    if (enableHaptics) void triggerHaptic('heavy', true);

    // Flash
    flashOpacity.value = withSequence(
      withTiming(0.7, { duration: 100 }),
      withTiming(0, { duration: 400 }),
    );

    // Explode shards
    shatterProgress.value = withTiming(1, {
      duration: SB.shatterDuration,
      easing: Easing.out(Easing.cubic),
    });

    // Fade canvas out
    canvasOpacity.value = withDelay(200, withTiming(0, { duration: 300 }));

    // Card reveal
    cardScale.value = withDelay(
      300,
      withTiming(
        1,
        {
          duration: SB.cardRevealDuration,
          easing: Easing.out(Easing.back(1.15)),
        },
        (finished) => {
          'worklet';
          if (finished) runOnJS(enterRevealed)();
        },
      ),
    );
    cardOpacity.value = withDelay(300, withTiming(1, { duration: SB.cardRevealDuration }));
  }, [
    enableHaptics,
    flashOpacity,
    shatterProgress,
    canvasOpacity,
    cardScale,
    cardOpacity,
    enterRevealed,
  ]);

  // ── Charging animation loop (requestAnimationFrame on JS thread) ──
  const updateCharge = useCallback(
    (timestamp: number) => {
      if (shatterTriggeredRef.current) return;

      const dt = lastFrameRef.current ? timestamp - lastFrameRef.current : 16;
      lastFrameRef.current = timestamp;

      let newCharge = chargeRef.current;
      if (isPresentRef.current) {
        newCharge = Math.min(1, newCharge + chargeRate * dt);

        // Haptic ticks while charging
        if (enableHaptics && timestamp - lastHapticRef.current > SB.hapticTickInterval) {
          lastHapticRef.current = timestamp;
          void triggerHaptic('light', true);
        }
      } else {
        newCharge = Math.max(0, newCharge - decayRate * dt);
      }

      chargeRef.current = newCharge;
      charge.value = newCharge;
      crackProgress.value = newCharge;
      chargeGlowOpacity.value = newCharge * 0.8;
      // Energy beams appear above 30% charge, intensify linearly
      energyBeamOpacity.value = newCharge > 0.3 ? (newCharge - 0.3) / 0.7 : 0;

      // Full charge -> shatter
      if (newCharge >= 1) {
        triggerShatter();
        return;
      }

      rafRef.current = requestAnimationFrame(updateCharge);
    },
    [
      charge,
      chargeRate,
      crackProgress,
      chargeGlowOpacity,
      energyBeamOpacity,
      decayRate,
      enableHaptics,
      triggerShatter,
    ],
  );

  // ── Appear animation + continuous rune rotation ──
  useEffect(() => {
    if (reducedMotion) {
      cardScale.value = 1;
      cardOpacity.value = 1;
      canvasOpacity.value = 0;
      setPhase('revealed');
      return;
    }

    // Seal appears
    sealOpacity.value = withTiming(1, { duration: SB.sealAppearDuration / 2 });
    sealScale.value = withTiming(
      1,
      {
        duration: SB.sealAppearDuration,
        easing: Easing.out(Easing.back(1.2)),
      },
      (finished) => {
        'worklet';
        if (finished) runOnJS(setPhase)('idle');
      },
    );

    // Continuous rune ring rotation (slow, decorative)
    runeRotation.value = withTiming(Math.PI * 20, {
      duration: 60000,
      easing: Easing.linear,
    });

    // Energy particle orbit
    energyRotation.value = withTiming(Math.PI * 40, {
      duration: 60000,
      easing: Easing.linear,
    });

    // Dark fog slow pulse
    fogPulse.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );

    // Fire embers continuous rise cycle
    emberCycle.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1);

    // Chain rattle continuous
    chainRattle.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.linear }), -1);

    // Ancient text counter-rotation (opposite to rune ring)
    ancientTextRotation.value = withTiming(Math.PI * 12, {
      duration: 60000,
      easing: Easing.linear,
    });

    // Seal pulse (subtle breathing)
    sealPulseScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
  }, [
    reducedMotion,
    sealOpacity,
    sealScale,
    cardScale,
    cardOpacity,
    canvasOpacity,
    runeRotation,
    energyRotation,
    fogPulse,
    emberCycle,
    chainRattle,
    ancientTextRotation,
    sealPulseScale,
  ]);

  // ── Start/stop charging loop when phase allows ──
  useEffect(() => {
    if (phase === 'idle' || phase === 'charging') {
      lastFrameRef.current = 0;
      rafRef.current = requestAnimationFrame(updateCharge);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, updateCharge]);

  // ── Auto-shatter timeout (warning + 8s auto-reveal) ──
  const autoShatter = useCallback(() => {
    if (!shatterTriggeredRef.current) {
      chargeRef.current = 1;
      charge.value = 1;
      crackProgress.value = 1;
      triggerShatter();
    }
  }, [charge, crackProgress, triggerShatter]);
  const autoTimeoutWarning = useAutoTimeout(phase === 'idle' || phase === 'charging', autoShatter);

  // ── Press handlers (dual mode: long-press charges continuously, tap boosts) ──
  const handlePressIn = useCallback(() => {
    if (phase !== 'idle' && phase !== 'charging') return;
    pressInTimeRef.current = Date.now();
    isPresentRef.current = true;
    if (phase === 'idle') setPhase('charging');
  }, [phase]);

  const handlePressOut = useCallback(() => {
    isPresentRef.current = false;
    if (shatterTriggeredRef.current) return;
    // Short press → treat as tap, boost charge instantly
    const pressDuration = Date.now() - pressInTimeRef.current;
    if (pressDuration < SB.tapThreshold) {
      const boosted = Math.min(1, chargeRef.current + SB.tapBoost);
      chargeRef.current = boosted;
      charge.value = boosted;
      crackProgress.value = boosted;
      if (enableHaptics) void triggerHaptic('medium', true);
      if (boosted >= 1) triggerShatter();
    }
  }, [charge, crackProgress, enableHaptics, triggerShatter]);

  // ── Animated styles ──
  const sealContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sealScale.value }],
    opacity: sealOpacity.value,
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

  const chargeGlowStyle = useAnimatedStyle(() => ({
    opacity: chargeGlowOpacity.value,
  }));

  // ── SVG animated group props ──
  const fogGroupProps = useAnimatedProps(() => ({ opacity: fogPulse.value }));
  const energyBeamGroupProps = useAnimatedProps(() => ({ opacity: energyBeamOpacity.value }));

  // ── Rune symbols around the inner ring ──
  const runeSymbols = useMemo(() => {
    const symbols = ['\u263D', '\u2726', '\u269D', '\u25C8', '\u2727', '\u263F'];
    return symbols.map((s, i) => {
      const angle = ((Math.PI * 2) / symbols.length) * i - Math.PI / 2;
      const r = sealRadius * 0.65;
      return {
        symbol: s,
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
      };
    });
  }, [cx, cy, sealRadius]);

  // ── Outer rune ring symbols (rotate with runeRotation) ──
  const outerRuneData = useMemo(() => {
    const symbols = [
      '\u16A0',
      '\u16A2',
      '\u16A6',
      '\u16A8',
      '\u16B1',
      '\u16B2',
      '\u16B7',
      '\u16B9',
      '\u16BA',
      '\u16BE',
      '\u16C1',
      '\u16C3',
    ];
    return symbols.map((s, i) => ({
      symbol: s,
      baseAngle: ((Math.PI * 2) / symbols.length) * i,
    }));
  }, []);

  // ── Progress ring arc segments ──
  const progressArcSegments = useMemo(() => {
    const segmentCount = 36;
    const gap = 0.02;
    const segAngle = (Math.PI * 2) / segmentCount;
    const ringRadius = sealRadius * 1.2;
    return Array.from({ length: segmentCount }, (_, i) => ({
      path: buildArcPath(cx, cy, ringRadius, i * segAngle + gap, (i + 1) * segAngle - gap),
      index: i,
      threshold: i / segmentCount,
    }));
  }, [cx, cy, sealRadius]);

  // ── Charge percentage display ──
  const [chargePercent, setChargePercent] = useState(0);
  useEffect(() => {
    if (phase !== 'charging' && phase !== 'idle') return;
    const interval = setInterval(() => {
      setChargePercent(Math.floor(chargeRef.current * 100));
    }, 50);
    return () => clearInterval(interval);
  }, [phase]);

  // ── Outer rune orbit radius ──
  const orbitR = sealRadius * 1.45;

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

      {/* Pressable area for long-press */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        testID={`${testIDPrefix}-press-area`}
      >
        {/* Skia canvas layer */}
        <Animated.View style={[StyleSheet.absoluteFill, canvasContainerStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, sealContainerStyle]}>
            <Svg style={StyleSheet.absoluteFill}>
              <Defs>
                <Filter id="fog-blur">
                  <FeGaussianBlur stdDeviation={40} />
                </Filter>
                <Filter id="pulse-blur">
                  <FeGaussianBlur stdDeviation={8} />
                </Filter>
                <Filter id="ember-blur">
                  <FeGaussianBlur stdDeviation={4} />
                </Filter>
                <SvgLinearGradient
                  id="aura-grad"
                  x1={String(cx)}
                  y1={String(cy - sealRadius * 1.6)}
                  x2={String(cx)}
                  y2={String(cy + sealRadius * 1.6)}
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop offset="0" stopColor={COLORS.auraInner} />
                  <Stop offset="1" stopColor={COLORS.auraOuter} />
                </SvgLinearGradient>
                <SvgLinearGradient
                  id="wax-grad"
                  x1={String(cx - sealRadius)}
                  y1={String(cy - sealRadius)}
                  x2={String(cx + sealRadius)}
                  y2={String(cy + sealRadius)}
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop offset="0" stopColor={COLORS.waxLight} />
                  <Stop offset="1" stopColor={COLORS.waxDark} />
                </SvgLinearGradient>
              </Defs>

              {/* Dark fog at edges */}
              <AnimatedG animatedProps={fogGroupProps}>
                {FOG_CIRCLES.map((fog, i) => (
                  <SvgCircle
                    key={`fog-${i}`}
                    cx={fog.x}
                    cy={fog.y}
                    r={fog.r}
                    fill={COLORS.fogColor}
                    filter="url(#fog-blur)"
                  />
                ))}
              </AnimatedG>

              {/* Background aura glow */}
              <SvgCircle cx={cx} cy={cy} r={sealRadius * 1.6} fill="url(#aura-grad)" />

              {/* Progress ring background (subtle) */}
              {progressArcSegments.map((seg) => (
                <SvgPath
                  key={`ring-bg-${seg.index}`}
                  d={seg.path}
                  stroke={COLORS.progressRingBg}
                  fill="none"
                  strokeWidth={4}
                  strokeLinecap="round"
                />
              ))}

              {/* Seal pulse ring (breathing glow around seal) */}
              <SvgCircle
                cx={cx}
                cy={cy}
                r={sealRadius * 1.15}
                stroke={COLORS.sealPulse}
                fill="none"
                strokeWidth={6}
                filter="url(#pulse-blur)"
              />

              {/* Seal disc — wax gradient */}
              <SvgCircle cx={cx} cy={cy} r={sealRadius} fill={COLORS.waxMid} />
              <SvgCircle cx={cx} cy={cy} r={sealRadius} fill="url(#wax-grad)" />

              {/* Seal rim */}
              <SvgCircle
                cx={cx}
                cy={cy}
                r={sealRadius - 2}
                stroke={COLORS.waxDark}
                fill="none"
                strokeWidth={4}
              />
              <SvgCircle
                cx={cx}
                cy={cy}
                r={sealRadius * 0.85}
                stroke={COLORS.rune}
                fill="none"
                strokeWidth={2}
                opacity={0.3}
              />

              {/* Wax drips from seal rim (bottom half) */}
              {WAX_DRIPS.map((drip, i) => {
                const dx = cx + Math.cos(drip.angle) * sealRadius;
                const dy = cy + Math.sin(drip.angle) * sealRadius;
                return (
                  <G key={`wax-drip-${i}`}>
                    <SvgCircle cx={dx} cy={dy + drip.length * 0.5} r={4} fill={COLORS.waxDrip} />
                    <SvgCircle cx={dx} cy={dy + drip.length} r={3} fill={COLORS.waxDrip} />
                    <SvgCircle cx={dx} cy={dy + drip.length * 0.25} r={3.5} fill={COLORS.waxDrip} />
                  </G>
                );
              })}

              {/* Decorative cross in center */}
              <SvgLine
                x1={cx - sealRadius * 0.3}
                y1={cy}
                x2={cx + sealRadius * 0.3}
                y2={cy}
                stroke={COLORS.rune}
                strokeWidth={3}
              />
              <SvgLine
                x1={cx}
                y1={cy - sealRadius * 0.3}
                x2={cx}
                y2={cy + sealRadius * 0.3}
                stroke={COLORS.rune}
                strokeWidth={3}
              />

              {/* Inner rune circle */}
              <SvgCircle
                cx={cx}
                cy={cy}
                r={sealRadius * 0.5}
                stroke={COLORS.rune}
                fill="none"
                strokeWidth={1.5}
                opacity={0.4}
              />

              {/* Energy beams (radial, appear above 30% charge) */}
              <AnimatedG animatedProps={energyBeamGroupProps}>
                {ENERGY_BEAM_ANGLES.map((angle, i) => (
                  <SvgLine
                    key={`beam-${i}`}
                    x1={cx + Math.cos(angle) * sealRadius * 0.5}
                    y1={cy + Math.sin(angle) * sealRadius * 0.5}
                    x2={cx + Math.cos(angle) * sealRadius * 1.8}
                    y2={cy + Math.sin(angle) * sealRadius * 1.8}
                    stroke={COLORS.energyBeam}
                    strokeWidth={2}
                  />
                ))}
              </AnimatedG>

              {/* Progress ring segments (light up as charge increases) */}
              {progressArcSegments.map((seg) => (
                <ProgressSegment
                  key={`ring-${seg.index}`}
                  path={seg.path}
                  threshold={seg.threshold}
                  charge={charge}
                />
              ))}

              {/* Crack lines (progressive with charge) */}
              {crackSVGs.map((svg, i) => (
                <CrackLineSvg
                  key={`crack-${i}`}
                  path={svg}
                  color={COLORS.crack}
                  strokeWidth={2.5}
                  progress={crackProgress}
                />
              ))}
              {/* Crack glow layer */}
              {crackSVGs.map((svg, i) => (
                <CrackLineSvg
                  key={`crack-glow-${i}`}
                  path={svg}
                  color={COLORS.crackGlow}
                  strokeWidth={6}
                  progress={crackProgress}
                  opacity={0.5}
                />
              ))}

              {/* Energy particles (converge as charge grows) */}
              {energyParticles.map((p) => (
                <EnergyParticleComponent
                  key={`ep-${p.id}`}
                  particle={p}
                  cx={cx}
                  cy={cy}
                  outerRadius={sealRadius}
                  charge={charge}
                  rotationOffset={energyRotation}
                />
              ))}

              {/* Fire embers (rising from seal, intensify with charge) */}
              {EMBERS.map((ember) => (
                <EmberParticle
                  key={`ember-${ember.id}`}
                  startX={ember.startX}
                  startY={ember.startY}
                  drift={ember.drift}
                  size={ember.size}
                  cycle={emberCycle}
                  chargeLevel={charge}
                />
              ))}
            </Svg>

            {/* Rune symbols (inner ring, RN Text for emoji rendering) */}
            {runeSymbols.map((r, i) => (
              <Text
                key={`rune-${i}`}
                style={[
                  styles.runeText,
                  {
                    left: r.x - 12,
                    top: r.y - 12,
                    color: COLORS.rune,
                    ...crossPlatformTextShadow(COLORS.runeGlow, 0, 0, 8),
                  },
                ]}
              >
                {r.symbol}
              </Text>
            ))}

            {/* Outer rotating rune symbols */}
            {outerRuneData.map((r, i) => (
              <OuterRuneSymbol
                key={`outer-rune-${i}`}
                symbol={r.symbol}
                baseAngle={r.baseAngle}
                cx={cx}
                cy={cy}
                orbitR={orbitR}
                runeRotation={runeRotation}
              />
            ))}

            {/* Chain symbols (rattle during charge) */}
            {CHAIN_POSITIONS.map((pos, i) => (
              <ChainSymbol
                key={`chain-${i}`}
                angle={pos.angle}
                cx={cx}
                cy={cy}
                radius={sealRadius * 1.7}
                rattle={chainRattle}
              />
            ))}

            {/* Ancient text ring (counter-rotating) */}
            {ANCIENT_TEXT_SYMBOLS.map((symbol, i) => (
              <AncientTextSymbol
                key={`ancient-${i}`}
                symbol={symbol}
                baseAngle={((Math.PI * 2) / ANCIENT_TEXT_SYMBOLS.length) * i}
                cx={cx}
                cy={cy}
                orbitR={sealRadius * 1.05}
                rotation={ancientTextRotation}
              />
            ))}
          </Animated.View>

          {/* Shard particles (after shatter) */}
          {phase === 'shatter' && (
            <Svg style={StyleSheet.absoluteFill}>
              {shards.map((shard) => (
                <ShardParticle
                  key={`shard-${shard.id}`}
                  shard={shard}
                  cx={cx}
                  cy={cy}
                  progress={shatterProgress}
                />
              ))}
            </Svg>
          )}
        </Animated.View>

        {/* Charge glow overlay */}
        <Animated.View style={[styles.chargeGlow, chargeGlowStyle]} />

        {/* Flash overlay */}
        <Animated.View style={[styles.flash, flashStyle, { backgroundColor: theme.glowColor }]} />
      </Pressable>

      {/* Charge percentage (only while charging) */}
      {phase === 'charging' && (
        <View style={styles.percentContainer}>
          <Text style={styles.percentText}>{chargePercent}%</Text>
        </View>
      )}

      {/* Hint text */}
      <HintWithWarning
        hintText={
          phase === 'appear'
            ? '\uD83D\uDD2E 封印凝聚中…'
            : phase === 'idle'
              ? '\uD83D\uDD2E 长按或连续点击封印蓄力'
              : phase === 'charging'
                ? '\uD83D\uDD2E 持续按住或点击…能量灌注中…'
                : phase === 'shatter'
                  ? '\u2728 封印已破！'
                  : null
        }
        showWarning={autoTimeoutWarning}
      />

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
  flash: { ...StyleSheet.absoluteFillObject, pointerEvents: 'none' },
  chargeGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.chargeGlow,
    pointerEvents: 'none',
  },

  runeText: {
    position: 'absolute',
    fontSize: 20,
    fontWeight: '700',
  },
  outerRuneText: {
    position: 'absolute',
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255, 215, 0, 0.5)',
    ...crossPlatformTextShadow('rgba(255, 215, 0, 0.3)', 0, 0, 6),
  },
  percentContainer: {
    position: 'absolute',
    bottom: 130,
    alignSelf: 'center',
    pointerEvents: 'none',
  },
  percentText: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.progressRing,
    ...crossPlatformTextShadow('rgba(0, 0, 0, 0.6)', 0, 1, 6),
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
  chainText: {
    position: 'absolute',
    fontSize: 20,
    ...crossPlatformTextShadow('rgba(200, 200, 200, 0.3)', 0, 0, 4),
  },
  ancientText: {
    position: 'absolute',
    fontSize: 12,
    color: COLORS.ancientText,
    fontWeight: '400',
  },
});
