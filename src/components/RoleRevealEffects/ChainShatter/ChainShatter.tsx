/**
 * ChainShatter - 锁链击碎揭示动画（Skia + Reanimated 4）
 *
 * 视觉设计：中央锁头（矩形锁身 + 半圆提梁 + 钥匙孔）+ 左右各 4 个水平椭圆链环。
 * 交互：连续点击击碎（6 次），每击产生裂纹线 + 屏幕抖动 + 冲击闪光。
 * 连击机制：>800ms 未击则连击数回退 1。全碎后碎片带重力爆炸。
 *
 * 视觉参照：docs/interactive-reveal-demo.html #chainShatter。
 * Skia 负责：锁头 + 水平链环 + 裂纹线 + 碎片粒子。
 * Reanimated 负责：驱动所有 shared value + 阶段切换。
 * 不 import service，不含业务逻辑。
 */
import { Canvas, Circle, Group, Path, Rect } from '@shopify/react-native-skia';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  Easing,
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
/** Background gradient: cold iron blue-black to complement gold lock sparks */
const BG_GRADIENT = ['#08080f', '#0e0e1a', '#08080f'] as const;

const COLORS = {
  /** Lock body fill */
  lockBody: '#3A3A4A',
  /** Lock body stroke */
  lockStroke: '#555555',
  /** Shackle (提梁) */
  shackle: '#666666',
  /** Keyhole */
  keyhole: '#222222',
  /** Chain link stroke */
  chainLink: '#555555',
  /** Crack glow */
  crackGlow: 'rgba(255, 200, 50, 0.8)',
  /** Hit flash overlay */
  breakFlash: '#FFD080',
  /** Shard palette */
  shardPalette: ['#555', '#777', '#444', '#666'] as const,
  /** Hit counter & hint text */
  hitText: '#FFD700',
  /** Combo indicator */
  comboText: 'rgba(255, 200, 0, 0.6)',
} as const;

const CS = CONFIG.chainShatter;

// ─── Types ──────────────────────────────────────────────────────────────
interface CrackData {
  x: number;
  y: number;
  angle: number;
  length: number;
}

interface ShardData {
  vx: number;
  vy: number;
  size: number;
  color: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────
/** Generate shards fanning out in a full circle, matching demo's 20-piece explosion. */
function generateShards(count: number): ShardData[] {
  const shards: ShardData[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    shards.push({
      vx: Math.cos(angle) * (80 + Math.random() * 60),
      vy: Math.sin(angle) * (80 + Math.random() * 60) - 20,
      size: 8 + Math.random() * 12,
      color: COLORS.shardPalette[i % COLORS.shardPalette.length],
    });
  }
  return shards;
}

/** Build SVG ellipse paths for chain links on both sides of the lock. */
function buildChainLinkPaths(
  cx: number,
  cy: number,
  lockW: number,
  linksPerSide: number,
): string[] {
  const paths: string[] = [];
  const rx = lockW * 0.1;
  const ry = lockW * 0.06;
  const startOffset = lockW * 0.7;
  const spacing = lockW * 0.2;

  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < linksPerSide; i++) {
      const lx = cx + side * (startOffset + i * spacing);
      const ly = cy + Math.sin(i * 0.8) * (lockW * 0.05);
      // Full ellipse via two 180° arcs
      paths.push(
        `M ${(lx - rx).toFixed(1)} ${ly.toFixed(1)} ` +
          `A ${rx.toFixed(1)} ${ry.toFixed(1)} 0 1 0 ${(lx + rx).toFixed(1)} ${ly.toFixed(1)} ` +
          `A ${rx.toFixed(1)} ${ry.toFixed(1)} 0 1 0 ${(lx - rx).toFixed(1)} ${ly.toFixed(1)}`,
      );
    }
  }
  return paths;
}

// ─── Skia sub-components ────────────────────────────────────────────────
interface CrackLineProps {
  crack: CrackData;
  opacity: SharedValue<number>;
}

/** Gold crack line that fades after appearing on each hit. */
const CrackLine: React.FC<CrackLineProps> = ({ crack, opacity }) => {
  const path = useMemo(() => {
    const ex = crack.x + Math.cos(crack.angle) * crack.length;
    const ey = crack.y + Math.sin(crack.angle) * crack.length;
    return `M ${crack.x.toFixed(1)} ${crack.y.toFixed(1)} L ${ex.toFixed(1)} ${ey.toFixed(1)}`;
  }, [crack]);

  return (
    <Group opacity={opacity}>
      <Path path={path} color={COLORS.crackGlow} style="stroke" strokeWidth={2} strokeCap="round" />
    </Group>
  );
};

interface ShardPieceProps {
  shard: ShardData;
  cx: number;
  cy: number;
  gravity: number;
  progress: SharedValue<number>;
}

/** Shard that flies outward with gravity and fades, matching demo physics. */
const ShardPiece: React.FC<ShardPieceProps> = ({ shard, cx, cy, gravity, progress }) => {
  const x = useDerivedValue(() => cx + shard.vx * progress.value - shard.size / 2);
  const y = useDerivedValue(
    () =>
      cy + shard.vy * progress.value + gravity * progress.value * progress.value - shard.size / 2,
  );
  const opacity = useDerivedValue(() => Math.max(0, 1 - progress.value));

  return (
    <Group opacity={opacity}>
      <Rect x={x} y={y} width={shard.size} height={shard.size * 0.6} color={shard.color} />
    </Group>
  );
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
  const colors = useColors();
  const alignmentThemes = useMemo(() => createAlignmentThemes(colors), [colors]);
  const theme = alignmentThemes[role.alignment];

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const common = CONFIG.common;
  const cardWidth = Math.min(screenWidth * common.cardWidthRatio, common.cardMaxWidth);
  const cardHeight = cardWidth * common.cardAspectRatio;

  const cx = screenWidth / 2;
  const cy = screenHeight / 2;
  const lockW = screenWidth * CS.lockWidthRatio;
  const lockH = lockW * 0.8;
  const gravity = screenHeight * 0.15;

  const [phase, setPhase] = useState<Phase>('appear');
  const [cracks, setCracks] = useState<CrackData[]>([]);
  const hitCountRef = useRef(0);
  const [hitCountDisplay, setHitCountDisplay] = useState(0);
  const lastHitTimeRef = useRef(0);
  const shatterTriggeredRef = useRef(false);
  const onCompleteCalledRef = useRef(false);

  // ── Pre-computed geometry ──
  const chainLinkPaths = useMemo(() => buildChainLinkPaths(cx, cy, lockW, 4), [cx, cy, lockW]);
  const [allShards] = useState(() => generateShards(CS.shardCount));

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
  const comboOpacity = useSharedValue(0);

  // Pre-allocated crack opacities (max = requiredHits)
  const c0 = useSharedValue(0);
  const c1 = useSharedValue(0);
  const c2 = useSharedValue(0);
  const c3 = useSharedValue(0);
  const c4 = useSharedValue(0);
  const c5 = useSharedValue(0);
  const crackOpacities = useMemo(() => [c0, c1, c2, c3, c4, c5], [c0, c1, c2, c3, c4, c5]);

  // Derived value for Skia lock group opacity
  const lockSkiaOpacity = useDerivedValue(() => lockOpacity.value);

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

  // ── Phase transitions ──
  const enterRevealed = useCallback(() => setPhase('revealed'), []);

  const handleGlowComplete = useCallback(() => {
    if (onCompleteCalledRef.current) return;
    onCompleteCalledRef.current = true;
    onComplete();
  }, [onComplete]);

  // ── Appear animation ──
  useEffect(() => {
    if (reducedMotion) {
      cardScale.value = 1;
      cardOpacity.value = 1;
      canvasOpacity.value = 0;
      setPhase('revealed');
      return;
    }

    chainOpacity.value = withTiming(1, { duration: CS.chainAppearDuration / 2 });
    chainScale.value = withTiming(
      1,
      { duration: CS.chainAppearDuration, easing: Easing.out(Easing.back(1.15)) },
      (finished) => {
        'worklet';
        if (finished) runOnJS(setPhase)('idle');
      },
    );
  }, [reducedMotion, chainOpacity, chainScale, cardScale, cardOpacity, canvasOpacity]);

  // ── Auto-shatter timeout ──
  useEffect(() => {
    if (phase !== 'idle' && phase !== 'hitting') return;
    const timer = setTimeout(() => {
      if (phase === 'idle' || phase === 'hitting') triggerShatter();
    }, CS.autoShatterTimeout);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

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
      withTiming(0.6, { duration: 100 }),
      withTiming(0, { duration: 400 }),
    );

    // Explode shards with gravity
    shatterProgress.value = withTiming(1, {
      duration: CS.shatterDuration,
      easing: Easing.out(Easing.cubic),
    });

    // Fade canvas
    canvasOpacity.value = withDelay(300, withTiming(0, { duration: 300 }));

    // Card reveal
    cardScale.value = withDelay(
      400,
      withTiming(
        1,
        { duration: CS.cardRevealDuration, easing: Easing.out(Easing.back(1.15)) },
        (finished) => {
          'worklet';
          if (finished) runOnJS(enterRevealed)();
        },
      ),
    );
    cardOpacity.value = withDelay(400, withTiming(1, { duration: CS.cardRevealDuration }));
  }, [
    enableHaptics,
    lockOpacity,
    flashOpacity,
    shatterProgress,
    canvasOpacity,
    cardScale,
    cardOpacity,
    enterRevealed,
  ]);

  // ── Handle hit ──
  const handlePress = useCallback(() => {
    if (phase !== 'idle' && phase !== 'hitting') return;

    const now = Date.now();
    let current = hitCountRef.current;

    // Combo decay: too slow → lose 1 hit (matching demo rhythm mechanic)
    if (current > 0 && now - lastHitTimeRef.current > CS.comboTimeout) {
      current = Math.max(0, current - 1);
    }

    current++;
    hitCountRef.current = current;
    lastHitTimeRef.current = now;
    setHitCountDisplay(current);

    if (phase === 'idle') setPhase('hitting');
    if (enableHaptics) triggerHaptic('medium', true);

    // Add crack near lock center
    const crackIdx = Math.min(current - 1, crackOpacities.length - 1);
    const newCrack: CrackData = {
      x: cx + (Math.random() - 0.5) * lockW * 0.6,
      y: cy + (Math.random() - 0.5) * lockH * 0.6,
      angle: Math.random() * Math.PI * 2,
      length: lockW * 0.2 + Math.random() * lockW * 0.4,
    };
    setCracks((prev) => [...prev, newCrack]);

    // Animate crack: flash in then fade
    crackOpacities[crackIdx].value = withSequence(
      withTiming(0.8, { duration: 50 }),
      withTiming(0, { duration: CS.crackFadeDuration }),
    );

    // Combo indicator flash
    comboOpacity.value = withSequence(
      withTiming(0.6, { duration: 50 }),
      withTiming(0, { duration: CS.comboTimeout }),
    );

    // Hit flash
    hitFlashOpacity.value = withSequence(
      withTiming(0.3, { duration: 50 }),
      withTiming(0, { duration: 100 }),
    );

    // Shake
    shakeX.value = withSequence(
      withTiming(-8, { duration: 30 }),
      withTiming(8, { duration: 30 }),
      withTiming(-4, { duration: 30 }),
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
    comboOpacity,
    hitFlashOpacity,
    shakeX,
    triggerShatter,
  ]);

  // ── Animated styles ──
  const chainContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: chainScale.value }, { translateX: shakeX.value }],
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
      {/* Pressable overlay for tap interaction */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={handlePress}
        testID={`${testIDPrefix}-tap-area`}
      >
        <Animated.View style={[StyleSheet.absoluteFill, canvasContainerStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, chainContainerStyle]}>
            {/* Skia: lock + chains + cracks */}
            <Canvas style={StyleSheet.absoluteFill}>
              {/* Lock + chains (fade to 0 on shatter) */}
              <Group opacity={lockSkiaOpacity}>
                {/* Lock body fill */}
                <Rect
                  x={cx - lockW / 2}
                  y={cy - lockH / 2}
                  width={lockW}
                  height={lockH}
                  color={COLORS.lockBody}
                />
                {/* Lock body stroke */}
                <Rect
                  x={cx - lockW / 2}
                  y={cy - lockH / 2}
                  width={lockW}
                  height={lockH}
                  color={COLORS.lockStroke}
                  style="stroke"
                  strokeWidth={2}
                />

                {/* Shackle (semi-circle arc above lock body) */}
                <Path
                  path={shacklePath}
                  color={COLORS.shackle}
                  style="stroke"
                  strokeWidth={lockW * 0.1}
                  strokeCap="round"
                />

                {/* Keyhole circle */}
                <Circle cx={cx} cy={cy} r={lockW * 0.1} color={COLORS.keyhole} />
                {/* Keyhole slot */}
                <Path path={keyholePath} color={COLORS.keyhole} />

                {/* Chain links (ellipses extending horizontally on both sides) */}
                {chainLinkPaths.map((d, i) => (
                  <Path
                    key={`link-${i}`}
                    path={d}
                    color={COLORS.chainLink}
                    style="stroke"
                    strokeWidth={4}
                  />
                ))}
              </Group>

              {/* Crack lines (gold, fade after each hit) */}
              {cracks.map((crack, i) => (
                <CrackLine
                  key={`crack-${i}`}
                  crack={crack}
                  opacity={crackOpacities[Math.min(i, crackOpacities.length - 1)]}
                />
              ))}
            </Canvas>

            {/* Hit counter inside shake container (shakes with lock) */}
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

            {/* Combo indicator (× N above lock, fades between hits) */}
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

          {/* Shard particles (after shatter, with gravity) */}
          {phase === 'shatter' && (
            <Canvas style={StyleSheet.absoluteFill}>
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
      {phase === 'appear' && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>⛓️ 锁链封印中…</Text>
        </View>
      )}
      {(phase === 'idle' || phase === 'hitting') && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>
            ⛓️ 连续点击屏幕击碎锁链！{hitsRemaining > 0 ? `（剩余 ${hitsRemaining} 击）` : ''}
          </Text>
        </View>
      )}
      {phase === 'shatter' && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>💥 锁链已碎！</Text>
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
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  comboText: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.comboText,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  hint: { position: 'absolute', bottom: 80 },
  hintText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.hitText,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
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
