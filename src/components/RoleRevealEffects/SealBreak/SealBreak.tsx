/**
 * SealBreak - 封印解除揭示动画（Skia + Reanimated 4）
 *
 * 视觉设计：中央深红蜡封圆盘 + 外圈旋转符文魔法阵 + 内聚能量粒子。
 * 交互：长按封印中心灌注能量，环形进度从 0→100%，裂纹随进度扩展，
 * 松手进度缓慢回退。满能后白光爆闪 → 碎片四散 → 角色卡放大显示。
 *
 * Skia 负责：封印圆盘 + 符文环 + 裂纹 path + 能量粒子 + 碎片。
 * Reanimated 负责：驱动所有 shared value + 阶段切换。
 * 不 import service，不含业务逻辑。
 */
import {
  Canvas,
  Circle,
  Group,
  Line,
  LinearGradient as SkiaLinearGradient,
  Path,
  Rect,
  vec,
} from '@shopify/react-native-skia';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AlignmentRevealOverlay } from '@/components/RoleRevealEffects/common/AlignmentRevealOverlay';
import { RoleCardContent } from '@/components/RoleRevealEffects/common/RoleCardContent';
import { CONFIG } from '@/components/RoleRevealEffects/config';
import type { RoleRevealEffectProps } from '@/components/RoleRevealEffects/types';
import { createAlignmentThemes } from '@/components/RoleRevealEffects/types';
import { triggerHaptic } from '@/components/RoleRevealEffects/utils/haptics';
import { useColors } from '@/theme';

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
} as const;

const SB = CONFIG.sealBreak;

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

  const x = useDerivedValue(() => interpolate(progress.value, [0, 1], [cx, endX]) - shard.size / 2);
  const y = useDerivedValue(() => interpolate(progress.value, [0, 1], [cy, endY]) - shard.size / 2);
  const opacity = useDerivedValue(() => interpolate(progress.value, [0, 0.5, 1], [1, 0.8, 0]));

  return (
    <Group opacity={opacity}>
      <Rect x={x} y={y} width={shard.size} height={shard.size} color={shard.color} />
    </Group>
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
  const currentAngle = useDerivedValue(
    () => particle.startAngle + rotationOffset.value * particle.speed,
  );
  // As charge grows, particles spiral inward from outer edge toward seal rim
  const currentRadius = useDerivedValue(
    () =>
      outerRadius * (1.4 + particle.radiusOffset) -
      charge.value * outerRadius * (0.5 + particle.radiusOffset),
  );
  const px = useDerivedValue(() => cx + Math.cos(currentAngle.value) * currentRadius.value - 3);
  const py = useDerivedValue(() => cy + Math.sin(currentAngle.value) * currentRadius.value - 3);
  const particleOpacity = useDerivedValue(() =>
    interpolate(charge.value, [0, 0.1, 0.5], [0, 0.5, 0.9]),
  );

  return (
    <Group opacity={particleOpacity}>
      <Circle cx={px} cy={py} r={3} color={COLORS.energyParticle} />
    </Group>
  );
};

// ─── Progress ring segment (lights up when charge exceeds threshold) ────
interface ProgressSegmentProps {
  path: string;
  threshold: number;
  charge: SharedValue<number>;
}

const ProgressSegment: React.FC<ProgressSegmentProps> = ({ path, threshold, charge }) => {
  const segEnd = useDerivedValue(() => (charge.value > threshold ? 1 : 0));
  const segOpacity = useDerivedValue(() =>
    charge.value > threshold
      ? interpolate(charge.value, [threshold, Math.min(threshold + 0.05, 1)], [0.5, 1])
      : 0,
  );

  return (
    <Path
      path={path}
      color={COLORS.progressRing}
      style="stroke"
      strokeWidth={4}
      strokeCap="round"
      start={0}
      end={segEnd}
      opacity={segOpacity}
    />
  );
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
  const colors = useColors();
  const alignmentThemes = useMemo(() => createAlignmentThemes(colors), [colors]);
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
  const [autoTimeoutWarning, setAutoTimeoutWarning] = useState(false);
  const onCompleteCalledRef = useRef(false);
  const shatterTriggeredRef = useRef(false);

  // ── Charging state (JS-side for requestAnimationFrame loop) ──
  const chargeRef = useRef(0);
  const isPresentRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const lastHapticRef = useRef(0);

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

  // ── Phase transitions ──
  const enterRevealed = useCallback(() => setPhase('revealed'), []);

  const handleGlowComplete = useCallback(() => {
    if (onCompleteCalledRef.current) return;
    onCompleteCalledRef.current = true;
    onComplete();
  }, [onComplete]);

  // ── Trigger final shatter ──
  const triggerShatter = useCallback(() => {
    if (shatterTriggeredRef.current) return;
    shatterTriggeredRef.current = true;

    setPhase('shatter');
    if (enableHaptics) triggerHaptic('heavy', true);

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
          triggerHaptic('light', true);
        }
      } else {
        newCharge = Math.max(0, newCharge - decayRate * dt);
      }

      chargeRef.current = newCharge;
      charge.value = newCharge;
      crackProgress.value = newCharge;
      chargeGlowOpacity.value = newCharge * 0.8;

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
  }, [
    reducedMotion,
    sealOpacity,
    sealScale,
    cardScale,
    cardOpacity,
    canvasOpacity,
    runeRotation,
    energyRotation,
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

  // ── Auto-shatter timeout ──
  useEffect(() => {
    if (phase !== 'idle' && phase !== 'charging') return;
    const warningTimer = setTimeout(
      () => setAutoTimeoutWarning(true),
      SB.autoShatterTimeout - 2000,
    );
    const timer = setTimeout(() => {
      if (!shatterTriggeredRef.current) {
        // Force full charge then shatter
        charge.value = withTiming(1, { duration: 800 }, (finished) => {
          'worklet';
          if (finished) runOnJS(triggerShatter)();
        });
        crackProgress.value = withTiming(1, { duration: 800 });
      }
    }, SB.autoShatterTimeout);
    return () => {
      clearTimeout(warningTimer);
      clearTimeout(timer);
      setAutoTimeoutWarning(false);
    };
  }, [phase, charge, crackProgress, triggerShatter]);

  // ── Press handlers ──
  const handlePressIn = useCallback(() => {
    if (phase !== 'idle' && phase !== 'charging') return;
    isPresentRef.current = true;
    if (phase === 'idle') setPhase('charging');
  }, [phase]);

  const handlePressOut = useCallback(() => {
    isPresentRef.current = false;
  }, []);

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
      setChargePercent(Math.round(chargeRef.current * 100));
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
            <Canvas style={StyleSheet.absoluteFill}>
              {/* Background aura glow */}
              <Circle cx={cx} cy={cy} r={sealRadius * 1.6}>
                <SkiaLinearGradient
                  start={vec(cx, cy - sealRadius * 1.6)}
                  end={vec(cx, cy + sealRadius * 1.6)}
                  colors={[COLORS.auraInner, COLORS.auraOuter]}
                />
              </Circle>

              {/* Progress ring background (subtle) */}
              {progressArcSegments.map((seg) => (
                <Path
                  key={`ring-bg-${seg.index}`}
                  path={seg.path}
                  color={COLORS.progressRingBg}
                  style="stroke"
                  strokeWidth={4}
                  strokeCap="round"
                />
              ))}

              {/* Seal disc — wax gradient */}
              <Circle cx={cx} cy={cy} r={sealRadius} color={COLORS.waxMid} />
              <Circle cx={cx} cy={cy} r={sealRadius}>
                <SkiaLinearGradient
                  start={vec(cx - sealRadius, cy - sealRadius)}
                  end={vec(cx + sealRadius, cy + sealRadius)}
                  colors={[COLORS.waxLight, COLORS.waxDark]}
                />
              </Circle>

              {/* Seal rim */}
              <Circle
                cx={cx}
                cy={cy}
                r={sealRadius - 2}
                style="stroke"
                strokeWidth={4}
                color={COLORS.waxDark}
              />
              <Circle
                cx={cx}
                cy={cy}
                r={sealRadius * 0.85}
                style="stroke"
                strokeWidth={2}
                color={COLORS.rune}
                opacity={0.3}
              />

              {/* Decorative cross in center */}
              <Line
                p1={vec(cx - sealRadius * 0.3, cy)}
                p2={vec(cx + sealRadius * 0.3, cy)}
                color={COLORS.rune}
                strokeWidth={3}
                style="stroke"
              />
              <Line
                p1={vec(cx, cy - sealRadius * 0.3)}
                p2={vec(cx, cy + sealRadius * 0.3)}
                color={COLORS.rune}
                strokeWidth={3}
                style="stroke"
              />

              {/* Inner rune circle */}
              <Circle
                cx={cx}
                cy={cy}
                r={sealRadius * 0.5}
                style="stroke"
                strokeWidth={1.5}
                color={COLORS.rune}
                opacity={0.4}
              />

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
                <Path
                  key={`crack-${i}`}
                  path={svg}
                  color={COLORS.crack}
                  style="stroke"
                  strokeWidth={2.5}
                  strokeCap="round"
                  start={0}
                  end={crackProgress}
                />
              ))}
              {/* Crack glow layer */}
              {crackSVGs.map((svg, i) => (
                <Path
                  key={`crack-glow-${i}`}
                  path={svg}
                  color={COLORS.crackGlow}
                  style="stroke"
                  strokeWidth={6}
                  strokeCap="round"
                  start={0}
                  end={crackProgress}
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
            </Canvas>

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
                    textShadowColor: COLORS.runeGlow,
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
          </Animated.View>

          {/* Shard particles (after shatter) */}
          {phase === 'shatter' && (
            <Canvas style={StyleSheet.absoluteFill}>
              {shards.map((shard) => (
                <ShardParticle
                  key={`shard-${shard.id}`}
                  shard={shard}
                  cx={cx}
                  cy={cy}
                  progress={shatterProgress}
                />
              ))}
            </Canvas>
          )}
        </Animated.View>

        {/* Charge glow overlay */}
        <Animated.View style={[styles.chargeGlow, chargeGlowStyle]} pointerEvents="none" />

        {/* Flash overlay */}
        <Animated.View
          style={[styles.flash, flashStyle, { backgroundColor: theme.glowColor }]}
          pointerEvents="none"
        />
      </Pressable>

      {/* Charge percentage (only while charging) */}
      {phase === 'charging' && (
        <View style={styles.percentContainer} pointerEvents="none">
          <Text style={styles.percentText}>{chargePercent}%</Text>
        </View>
      )}

      {/* Hint text */}
      {phase === 'appear' && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>{'\uD83D\uDD2E'} 封印凝聚中…</Text>
        </View>
      )}
      {phase === 'idle' && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>{'🔮'} 长按封印蓄力破除</Text>
        </View>
      )}
      {phase === 'charging' && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>{'\uD83D\uDD2E'} 持续按住…能量灌注中…</Text>
        </View>
      )}
      {autoTimeoutWarning && (phase === 'idle' || phase === 'charging') && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.autoTimeoutWarning}>⏳ 即将自动揭晓…</Text>
        </View>
      )}
      {phase === 'shatter' && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>{'\u2728'} 封印已破！</Text>
        </View>
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
  chargeGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.chargeGlow,
  },
  hint: { position: 'absolute', bottom: 80 },
  hintText: {
    fontSize: 22,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.85)',
    textShadowColor: 'rgba(139, 26, 26, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  autoTimeoutWarning: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255, 200, 50, 0.9)',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  runeText: {
    position: 'absolute',
    fontSize: 20,
    fontWeight: '700',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  outerRuneText: {
    position: 'absolute',
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255, 215, 0, 0.5)',
    textShadowColor: 'rgba(255, 215, 0, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  percentContainer: {
    position: 'absolute',
    bottom: 130,
    alignSelf: 'center',
  },
  percentText: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.progressRing,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
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
});
