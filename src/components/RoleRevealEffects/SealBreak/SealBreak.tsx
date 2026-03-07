/**
 * SealBreak - 封印解除揭示动画（Skia + Reanimated 4）
 *
 * 动画流程：发光蜡封圆盘出现 → 裂纹从中心放射扩展（Skia Path） →
 * 封印爆碎（碎片粒子四散 + 屏幕闪光） → Skia canvas 淡出 →
 * RoleCardContent 放大显示 → AlignmentRevealOverlay 阵营特效。
 *
 * Skia 负责：封印圆盘 + 符文装饰 + 裂纹 path + 碎片粒子 + 光效。
 * Reanimated 负责：驱动所有 shared value + 阶段切换。
 * 渲染动画与触觉反馈。不 import service，不含业务逻辑。
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
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
const SEAL_COLORS = {
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
};

/** Timing config */
const TIMING = {
  /** Seal fade-in + pulse duration */
  sealAppear: 800,
  /** Rune glow pulse cycle */
  runePulse: 1200,
  /** Crack propagation duration */
  crackGrow: 1200,
  /** Shatter explosion duration */
  shatter: 600,
  /** Card scale-in duration */
  cardReveal: 400,
  /** Total auto-play wait before crack starts */
  waitBeforeCrack: 1000,
  /** Number of crack lines */
  crackCount: 8,
  /** Number of shard particles */
  shardCount: 24,
  /** Seal radius as fraction of screen width */
  sealRadiusRatio: 0.28,
};

// ─── Shard (pre-computed trajectory) ────────────────────────────────────
interface ShardData {
  id: number;
  /** Angle in radians from center */
  angle: number;
  /** Travel distance */
  distance: number;
  /** Rotation speed multiplier */
  spin: number;
  /** Size */
  size: number;
  /** Color */
  color: string;
}

function generateShards(count: number): ShardData[] {
  const result: ShardData[] = [];
  for (let i = 0; i < count; i++) {
    const angle = ((Math.PI * 2) / count) * i + (Math.random() - 0.5) * 0.4;
    result.push({
      id: i,
      angle,
      distance: 120 + Math.random() * 200,
      spin: 360 + Math.random() * 720,
      size: 6 + Math.random() * 12,
      color: SEAL_COLORS.shardColors[i % SEAL_COLORS.shardColors.length],
    });
  }
  return result;
}

// ─── Crack path builder ─────────────────────────────────────────────────
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

// ─── Shard particle (worklet-driven, no render-time .value reads) ────────
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

// ─── Main component ─────────────────────────────────────────────────────
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
  const sealRadius = screenWidth * TIMING.sealRadiusRatio;

  const [phase, setPhase] = useState<'appear' | 'pulse' | 'cracking' | 'shatter' | 'revealed'>(
    'appear',
  );
  const onCompleteCalledRef = useRef(false);

  // ── Pre-computed geometry (stable across re-renders) ──
  const [shards] = useState(() => generateShards(TIMING.shardCount));
  const [crackSVGs] = useState(() => buildCrackPaths(cx, cy, sealRadius, TIMING.crackCount));

  // ── Shared values ──
  const sealScale = useSharedValue(0);
  const sealOpacity = useSharedValue(0);
  const runeGlow = useSharedValue(0);
  const crackProgress = useSharedValue(0);
  const shatterProgress = useSharedValue(0);
  const canvasOpacity = useSharedValue(1);
  const cardScale = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const flashOpacity = useSharedValue(0);

  // ── Phase transitions ──
  const enterRevealed = useCallback(() => {
    setPhase('revealed');
  }, []);

  const handleGlowComplete = useCallback(() => {
    if (onCompleteCalledRef.current) return;
    onCompleteCalledRef.current = true;
    onComplete();
  }, [onComplete]);

  // ── Animation sequence (auto-play) ──
  useEffect(() => {
    if (reducedMotion) {
      // Reduced motion: skip to card directly
      cardScale.value = 1;
      cardOpacity.value = 1;
      canvasOpacity.value = 0;
      setPhase('revealed');
      return;
    }

    // Phase 1: Seal appears
    sealOpacity.value = withTiming(1, { duration: TIMING.sealAppear / 2 });
    sealScale.value = withTiming(1, {
      duration: TIMING.sealAppear,
      easing: Easing.out(Easing.back(1.2)),
    });

    // Phase 2: Rune pulse
    runeGlow.value = withDelay(
      TIMING.sealAppear,
      withSequence(
        withTiming(1, { duration: TIMING.runePulse / 2, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.3, { duration: TIMING.runePulse / 2, easing: Easing.inOut(Easing.sin) }),
      ),
    );

    // Phase 3: Cracks grow
    const crackStart = TIMING.waitBeforeCrack;
    crackProgress.value = withDelay(
      crackStart,
      withTiming(1, {
        duration: TIMING.crackGrow,
        easing: Easing.in(Easing.quad),
      }),
    );

    // Update phase to cracking
    const crackTimer = setTimeout(() => {
      setPhase('cracking');
      if (enableHaptics) triggerHaptic('light', true);
    }, crackStart);

    // Phase 4: Shatter
    const shatterStart = crackStart + TIMING.crackGrow;
    const shatterTimer = setTimeout(() => {
      setPhase('shatter');
      if (enableHaptics) triggerHaptic('heavy', true);

      // Flash
      flashOpacity.value = withSequence(
        withTiming(0.6, { duration: 100 }),
        withTiming(0, { duration: 400 }),
      );

      // Explode shards
      shatterProgress.value = withTiming(1, {
        duration: TIMING.shatter,
        easing: Easing.out(Easing.cubic),
      });

      // Fade canvas out
      canvasOpacity.value = withDelay(200, withTiming(0, { duration: 300 }));

      // Scale card in
      cardScale.value = withDelay(
        300,
        withTiming(
          1,
          {
            duration: TIMING.cardReveal,
            easing: Easing.out(Easing.back(1.15)),
          },
          (finished) => {
            'worklet';
            if (finished) runOnJS(enterRevealed)();
          },
        ),
      );
      cardOpacity.value = withDelay(300, withTiming(1, { duration: TIMING.cardReveal }));
    }, shatterStart);

    return () => {
      clearTimeout(crackTimer);
      clearTimeout(shatterTimer);
    };
  }, [
    reducedMotion,
    enableHaptics,
    sealOpacity,
    sealScale,
    runeGlow,
    crackProgress,
    shatterProgress,
    canvasOpacity,
    cardScale,
    cardOpacity,
    flashOpacity,
    enterRevealed,
  ]);

  // ── Animated styles ──
  const sealStyle = useAnimatedStyle(() => ({
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

  // ── Rune symbols (decorative) ──
  const runeSymbols = useMemo(() => {
    const symbols = ['☽', '✦', '⚝', '◈', '✧', '☿'];
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

  return (
    <View style={styles.container} testID={`${testIDPrefix}-container`}>
      {/* Immersive dark background */}
      <LinearGradient
        colors={['#0a0810', '#100c1a', '#0a0810']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      {/* Skia canvas layer: seal + cracks + particles */}
      <Animated.View style={[StyleSheet.absoluteFill, canvasContainerStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, sealStyle]}>
          <Canvas style={StyleSheet.absoluteFill}>
            {/* Background aura glow */}
            <Circle cx={cx} cy={cy} r={sealRadius * 1.6}>
              <SkiaLinearGradient
                start={vec(cx, cy - sealRadius * 1.6)}
                end={vec(cx, cy + sealRadius * 1.6)}
                colors={[SEAL_COLORS.auraInner, SEAL_COLORS.auraOuter]}
              />
            </Circle>

            {/* Seal disc — wax gradient */}
            <Circle cx={cx} cy={cy} r={sealRadius} color={SEAL_COLORS.waxMid} />
            <Circle cx={cx} cy={cy} r={sealRadius}>
              <SkiaLinearGradient
                start={vec(cx - sealRadius, cy - sealRadius)}
                end={vec(cx + sealRadius, cy + sealRadius)}
                colors={[SEAL_COLORS.waxLight, SEAL_COLORS.waxDark]}
              />
            </Circle>

            {/* Seal rim */}
            <Circle
              cx={cx}
              cy={cy}
              r={sealRadius - 2}
              style="stroke"
              strokeWidth={4}
              color={SEAL_COLORS.waxDark}
            />
            <Circle
              cx={cx}
              cy={cy}
              r={sealRadius * 0.85}
              style="stroke"
              strokeWidth={2}
              color={SEAL_COLORS.rune}
              opacity={0.3}
            />

            {/* Decorative cross in center */}
            <Line
              p1={vec(cx - sealRadius * 0.3, cy)}
              p2={vec(cx + sealRadius * 0.3, cy)}
              color={SEAL_COLORS.rune}
              strokeWidth={3}
              style="stroke"
            />
            <Line
              p1={vec(cx, cy - sealRadius * 0.3)}
              p2={vec(cx, cy + sealRadius * 0.3)}
              color={SEAL_COLORS.rune}
              strokeWidth={3}
              style="stroke"
            />

            {/* Inner circle for rune ring */}
            <Circle
              cx={cx}
              cy={cy}
              r={sealRadius * 0.5}
              style="stroke"
              strokeWidth={1.5}
              color={SEAL_COLORS.rune}
              opacity={0.4}
            />

            {/* Crack lines (drawn progressively via crackProgress) */}
            {crackSVGs.map((svg, i) => (
              <Path
                key={`crack-${i}`}
                path={svg}
                color={SEAL_COLORS.crack}
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
                color={SEAL_COLORS.crackGlow}
                style="stroke"
                strokeWidth={6}
                strokeCap="round"
                start={0}
                end={crackProgress}
                opacity={0.5}
              />
            ))}
          </Canvas>

          {/* Rune symbols (RN Text for emoji rendering) */}
          {runeSymbols.map((r, i) => (
            <Text
              key={`rune-${i}`}
              style={[
                styles.runeText,
                {
                  left: r.x - 12,
                  top: r.y - 12,
                  color: SEAL_COLORS.rune,
                  textShadowColor: SEAL_COLORS.runeGlow,
                },
              ]}
            >
              {r.symbol}
            </Text>
          ))}
        </Animated.View>

        {/* Shard particles (separate canvas so they can animate independently) */}
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

      {/* Flash overlay */}
      <Animated.View
        style={[styles.flash, flashStyle, { backgroundColor: theme.glowColor }]}
        pointerEvents="none"
      />

      {/* Hint text */}
      {phase === 'appear' && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>🔮 封印凝聚中…</Text>
        </View>
      )}
      {(phase === 'pulse' || phase === 'cracking') && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>🔮 点击封印解除！</Text>
        </View>
      )}
      {phase === 'shatter' && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>✨ 封印已破！</Text>
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
  hint: { position: 'absolute', bottom: 80 },
  hintText: {
    fontSize: 22,
    fontWeight: '700',
    color: 'rgba(255, 215, 0, 0.8)',
    textShadowColor: 'rgba(139, 26, 26, 0.8)',
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
