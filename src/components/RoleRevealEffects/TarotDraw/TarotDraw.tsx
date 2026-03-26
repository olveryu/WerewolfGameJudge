/**
 * TarotDraw - 塔罗牌占卜揭示效果（Reanimated 4 + Skia）
 *
 * 动画流程：星空+水晶球+蜡烛的占卜场景 → 牌从桌面转盘旋转 →
 * 玩家点选 → 金色光丝拖尾飞向中央 → 六角魔法阵浮现 → 翻转揭示 → 命运之语。
 * 使用 `useSharedValue` 驱动所有动画，`runOnJS` 切换阶段，无 `setTimeout`。
 * 渲染动画与触觉反馈。不 import service，不含业务逻辑。
 */
import {
  Blur,
  Canvas,
  Circle,
  Group,
  Line as SkiaLine,
  Path as SkiaPath,
  RadialGradient,
  vec,
} from '@shopify/react-native-skia';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlignmentRevealOverlay } from '@/components/RoleRevealEffects/common/AlignmentRevealOverlay';
import { AtmosphericBackground } from '@/components/RoleRevealEffects/common/effects/AtmosphericBackground';
import { RevealBurst } from '@/components/RoleRevealEffects/common/effects/RevealBurst';
import { SkiaSparkle } from '@/components/RoleRevealEffects/common/effects/SkiaSparkle';
import { RoleCardContent } from '@/components/RoleRevealEffects/common/RoleCardContent';
import { CONFIG } from '@/components/RoleRevealEffects/config';
import type { RoleRevealEffectProps } from '@/components/RoleRevealEffects/types';
import { createAlignmentThemes } from '@/components/RoleRevealEffects/types';
import { triggerHaptic } from '@/components/RoleRevealEffects/utils/haptics';
import { borderRadius, crossPlatformTextShadow, useColors } from '@/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Visual constants ──────────────────────────────────────────────────
const TAROT_COLORS = {
  cardBack: ['#2a2a4e', '#3d3d64', '#2a2a4e'] as const,
  gold: '#d4af37',
  goldGlow: '#ffd700',
  cardFrontGradient: ['#f5f5f5', '#ffffff', '#f5f5f5'] as const,
  starfield: '#c8c8ff',
  candleYellow: '#ffe066',
  candleOrange: '#ff9933',
  candleRed: '#ff4400',
  velvet: '#1a0a2e',
  velvetFringe: '#c9a84c',
  crystalBall: '#6644aa',
  crystalHighlight: '#ffffff',
  magicCircle: '#c9a84c',
};

// ─── Pre-computed stars ────────────────────────────────────────────────
const STARS = Array.from({ length: 30 }, (_, i) => ({
  x: (((i * 73 + 17) % 100) / 100) * SCREEN_W,
  y: (((i * 41 + 31) % 100) / 100) * SCREEN_H * 0.65,
  r: 0.5 + (((i * 59 + 7) % 100) / 100) * 1.2,
  twinkle: i < 5, // first 5 twinkle
  phase: ((i * 83 + 11) % 628) / 100,
}));

// ─── Fortune quotes per alignment ──────────────────────────────────────
const FORTUNE_QUOTES: Record<string, string> = {
  wolf: '暗月低语，獠牙已露…',
  god: '圣光降临，命运已定…',
  villager: '晨曦微暖，守护前行…',
  third: '迷雾深处，命运未知…',
};

// ─── Magic circle hexagram path (centered at 0,0, radius 1) ───────────
function buildHexagramPath(cx: number, cy: number, radius: number): string {
  const pts: [number, number][] = [];
  // Two overlapping triangles
  for (let t = 0; t < 2; t++) {
    const offset = t * (Math.PI / 6);
    const tri: [number, number][] = [];
    for (let i = 0; i < 3; i++) {
      const angle = offset + (Math.PI * 2 * i) / 3 - Math.PI / 2;
      tri.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
    }
    pts.push(...tri, tri[0]); // close the triangle
  }
  // path: M p0 L p1 L p2 Z M p3 L p4 L p5 Z
  return (
    `M ${pts[0][0]} ${pts[0][1]} L ${pts[1][0]} ${pts[1][1]} L ${pts[2][0]} ${pts[2][1]} Z ` +
    `M ${pts[4][0]} ${pts[4][1]} L ${pts[5][0]} ${pts[5][1]} L ${pts[6][0]} ${pts[6][1]} Z`
  );
}

interface WheelCard {
  id: number;
  angle: number;
}

// ─── Card back face (memoized) ──────────────────────────────────────────
const CardBackFace: React.FC<{ width: number; height: number }> = React.memo(
  ({ width, height }) => {
    const cx = width / 2;
    const moonY = height * 0.32;
    const starY = height * 0.48;
    const vineY = height * 0.62;
    const starSpacing = 24;
    const moonR = 10;

    return (
      <View style={[styles.cardBackFace, { width, height }]}>
        <LinearGradient
          colors={[...TAROT_COLORS.cardBack]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.cardBackInner}>
            <View style={[styles.cardBackBorder, { borderColor: TAROT_COLORS.gold }]} />
          </View>
        </LinearGradient>
        {/* Skia overlay for glowing symbols */}
        <Canvas style={styles.cardBackCanvas} pointerEvents="none">
          {/* Crescent moon — glow BEHIND body so cutout stays visible */}
          <Circle cx={cx} cy={moonY} r={moonR + 3} color={TAROT_COLORS.goldGlow}>
            <Blur blur={1} />
          </Circle>
          <Circle cx={cx} cy={moonY} r={moonR} color={TAROT_COLORS.gold} />
          <Circle cx={cx + 4} cy={moonY - 2} r={moonR - 2} color={TAROT_COLORS.cardBack[0]} />

          {/* Three cross-sparkle stars — drawn directly to avoid glow halo dominance */}
          {[-1, 0, 1].map((offset) => {
            const sx = cx + offset * starSpacing;
            const sLen = 6;
            const dLen = 4;
            return (
              <React.Fragment key={`star-${offset}`}>
                {/* Vertical spike */}
                <SkiaLine
                  p1={vec(sx, starY - sLen)}
                  p2={vec(sx, starY + sLen)}
                  color={TAROT_COLORS.gold}
                  style="stroke"
                  strokeWidth={1.2}
                  strokeCap="round"
                />
                {/* Horizontal spike */}
                <SkiaLine
                  p1={vec(sx - sLen, starY)}
                  p2={vec(sx + sLen, starY)}
                  color={TAROT_COLORS.gold}
                  style="stroke"
                  strokeWidth={1.2}
                  strokeCap="round"
                />
                {/* Diagonal spikes */}
                <SkiaLine
                  p1={vec(sx - dLen, starY - dLen)}
                  p2={vec(sx + dLen, starY + dLen)}
                  color={TAROT_COLORS.gold}
                  style="stroke"
                  strokeWidth={0.7}
                  strokeCap="round"
                />
                <SkiaLine
                  p1={vec(sx + dLen, starY - dLen)}
                  p2={vec(sx - dLen, starY + dLen)}
                  color={TAROT_COLORS.gold}
                  style="stroke"
                  strokeWidth={0.7}
                  strokeCap="round"
                />
                {/* Center dot */}
                <Circle cx={sx} cy={starY} r={1.5} color={TAROT_COLORS.gold} />
              </React.Fragment>
            );
          })}

          {/* Vine/flourish decorations — small circles + connecting lines */}
          <Circle cx={cx - 20} cy={vineY} r={3} color={TAROT_COLORS.gold} opacity={0.5} />
          <SkiaLine
            p1={vec(cx - 12, vineY)}
            p2={vec(cx + 12, vineY)}
            color={TAROT_COLORS.gold}
            style="stroke"
            strokeWidth={0.8}
            strokeCap="round"
            opacity={0.4}
          />
          <Circle cx={cx + 20} cy={vineY} r={3} color={TAROT_COLORS.gold} opacity={0.5} />
          {/* Central diamond accent */}
          <SkiaPath
            path={`M ${cx} ${vineY - 5} L ${cx + 4} ${vineY} L ${cx} ${vineY + 5} L ${cx - 4} ${vineY} Z`}
            color={TAROT_COLORS.gold}
            opacity={0.6}
          />
        </Canvas>
      </View>
    );
  },
);
CardBackFace.displayName = 'CardBackFace';

// ─── Twinkling star (Skia sparkle cross, driven by shared cycle) ───────
const TwinklingStar: React.FC<{
  x: number;
  y: number;
  r: number;
  phase: number;
  cycle: SharedValue<number>;
}> = React.memo(({ x, y, r, phase, cycle }) => {
  const opacity = useDerivedValue(() => 0.3 + Math.sin(cycle.value + phase) * 0.3);
  const isBright = r > 1.0;

  return (
    <Group opacity={opacity}>
      <SkiaSparkle
        x={x}
        y={y}
        r={r}
        color={TAROT_COLORS.starfield}
        bright={isBright}
        glowBlur={isBright ? 5 : 3}
      />
    </Group>
  );
});
TwinklingStar.displayName = 'TwinklingStar';

// ─── Main component ─────────────────────────────────────────────────────
export const TarotDraw: React.FC<RoleRevealEffectProps> = ({
  role,
  onComplete,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'tarot-draw',
}) => {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const alignmentThemes = useMemo(() => createAlignmentThemes(colors), [colors]);
  const theme = alignmentThemes[role.alignment];
  const config = CONFIG.tarot ?? { flipDuration: 800, revealHoldDuration: 1500 };

  const [phase, setPhase] = useState<'waiting' | 'drawing' | 'flipping' | 'revealed'>('waiting');
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const onCompleteCalledRef = useRef(false);

  const common = CONFIG.common;
  const cardWidth = Math.min(screenWidth * common.cardWidthRatio, common.cardMaxWidth);
  const cardHeight = cardWidth * common.cardAspectRatio;
  const wheelRadius = Math.min(screenWidth * 0.32, 130);

  const wheelCards: WheelCard[] = useMemo(() => {
    const count = 8;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      angle: (Math.PI * 2 * i) / count,
    }));
  }, []);

  // ── Shared values ──
  const wheelRotation = useSharedValue(0); // 0→1 = one full turn
  const wheelOpacity = useSharedValue(1);
  const wheelScale = useSharedValue(1);
  const drawnCardX = useSharedValue(0);
  const drawnCardY = useSharedValue(-wheelRadius);
  const drawnCardScale = useSharedValue(1);
  const drawnCardOpacity = useSharedValue(0);
  const flipProgress = useSharedValue(0); // 0 = back, 1 = front

  // Scene element shared values
  const starCycle = useSharedValue(0);
  const candleFlicker = useSharedValue(0);
  const crystalPulse = useSharedValue(0);
  const magicCircleRotation = useSharedValue(0);
  const magicCircleOpacity = useSharedValue(0);
  const trailOpacity = useSharedValue(0);
  const trailOp = useDerivedValue(() => trailOpacity.value);
  const fortuneOpacity = useSharedValue(0);
  const velvetOpacity = useSharedValue(0);

  // ── Phase transitions ──
  const enterRevealed = useCallback(() => {
    setPhase('revealed');
    if (enableHaptics) triggerHaptic('heavy', true);
    // Fortune quote fades in
    fortuneOpacity.value = withDelay(400, withTiming(1, { duration: 800 }));
    // Magic circle fades out
    magicCircleOpacity.value = withDelay(500, withTiming(0, { duration: 600 }));
  }, [enableHaptics, fortuneOpacity, magicCircleOpacity]);

  const startFlipping = useCallback(() => {
    setPhase('flipping');
    if (enableHaptics) triggerHaptic('medium', true);

    // Magic circle appears and spins
    magicCircleOpacity.value = withTiming(0.5, { duration: 300 });
    magicCircleRotation.value = withRepeat(
      withTiming(Math.PI * 2, { duration: 5000, easing: Easing.linear }),
      -1,
    );

    flipProgress.value = withTiming(
      1,
      { duration: config.flipDuration ?? 800, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        'worklet';
        if (finished) runOnJS(enterRevealed)();
      },
    );
  }, [
    flipProgress,
    config.flipDuration,
    enableHaptics,
    enterRevealed,
    magicCircleOpacity,
    magicCircleRotation,
  ]);

  const beginFlipAfterDelay = useCallback(() => {
    // Small pause before flip
    drawnCardScale.value = withDelay(300, withTiming(1, { duration: 1 }));
    // Use a dummy animation to trigger the callback after 300ms
    flipProgress.value = withDelay(
      300,
      withTiming(0, { duration: 1 }, (finished) => {
        'worklet';
        if (finished) runOnJS(startFlipping)();
      }),
    );
  }, [drawnCardScale, flipProgress, startFlipping]);

  const startDrawing = useCallback(() => {
    setPhase('drawing');
    if (enableHaptics) triggerHaptic('medium', true);

    drawnCardOpacity.value = 1;
    // Trail light shows during flight
    trailOpacity.value = withSequence(
      withTiming(0.7, { duration: 100 }),
      withDelay(400, withTiming(0, { duration: 300 })),
    );

    // Fade out wheel
    wheelScale.value = withTiming(0.5, { duration: 400 });
    wheelOpacity.value = withTiming(0, { duration: 400 });

    // Move drawn card to center
    drawnCardX.value = withTiming(0, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });
    drawnCardY.value = withTiming(
      0,
      { duration: 500, easing: Easing.out(Easing.cubic) },
      (finished) => {
        'worklet';
        if (finished) runOnJS(beginFlipAfterDelay)();
      },
    );
  }, [
    drawnCardX,
    drawnCardY,
    drawnCardOpacity,
    trailOpacity,
    wheelScale,
    wheelOpacity,
    enableHaptics,
    beginFlipAfterDelay,
  ]);

  // Current wheel rotation value (tracked via a ref updated in onUpdate callback-free way,
  // but since Reanimated shared values can be read on JS thread, we use .value directly)
  const handleCardSelect = useCallback(
    (cardIndex: number) => {
      if (phase !== 'waiting') return;
      setSelectedCardIndex(cardIndex);
      cancelAnimation(wheelRotation);
      if (enableHaptics) triggerHaptic('medium', true);

      // Calculate selected card position in wheel
      const currentRotation = wheelRotation.value;
      const cardAngle = wheelCards[cardIndex].angle;
      const totalAngle = currentRotation * Math.PI * 2 + cardAngle - Math.PI / 2;
      const x = Math.cos(totalAngle) * wheelRadius;
      const y = Math.sin(totalAngle) * wheelRadius;

      drawnCardX.value = x;
      drawnCardY.value = y;

      startDrawing();
    },
    [
      phase,
      wheelCards,
      wheelRadius,
      wheelRotation,
      drawnCardX,
      drawnCardY,
      enableHaptics,
      startDrawing,
    ],
  );

  const handleGlowComplete = useCallback(() => {
    if (onCompleteCalledRef.current) return;
    onCompleteCalledRef.current = true;
    const timer = setTimeout(() => onComplete(), config.revealHoldDuration ?? 1200);
    return () => clearTimeout(timer);
  }, [onComplete, config.revealHoldDuration]);

  // ── Kick-off ──
  useEffect(() => {
    if (reducedMotion) {
      flipProgress.value = 1;
      wheelOpacity.value = 0;
      drawnCardOpacity.value = 1;
      drawnCardScale.value = 1;
      setPhase('revealed');
      const timer = setTimeout(() => onComplete(), config.revealHoldDuration ?? 0);
      return () => clearTimeout(timer);
    }

    // Slow spin: 4 seconds per revolution, infinite loop
    wheelRotation.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.linear }),
      -1,
      false,
    );

    // Scene animations
    starCycle.value = withRepeat(
      withTiming(Math.PI * 2, { duration: 6000, easing: Easing.linear }),
      -1,
    );
    candleFlicker.value = withRepeat(
      withTiming(Math.PI * 2, { duration: 800, easing: Easing.linear }),
      -1,
    );
    crystalPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
    // Velvet table fades in
    velvetOpacity.value = withTiming(1, { duration: 800 });
  }, [
    reducedMotion,
    flipProgress,
    wheelOpacity,
    drawnCardOpacity,
    drawnCardScale,
    wheelRotation,
    starCycle,
    candleFlicker,
    crystalPulse,
    velvetOpacity,
    onComplete,
    config.revealHoldDuration,
  ]);

  // ── Auto-select after 3s if user doesn't tap ──
  useEffect(() => {
    if (phase !== 'waiting' || reducedMotion) return;
    const timer = setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * wheelCards.length);
      handleCardSelect(randomIndex);
    }, 3000);
    return () => clearTimeout(timer);
  }, [phase, reducedMotion, wheelCards.length, handleCardSelect]);

  // ── Animated styles ──
  const wheelStyle = useAnimatedStyle(() => ({
    opacity: wheelOpacity.value,
    transform: [{ scale: wheelScale.value }, { rotate: `${wheelRotation.value * 360}deg` }],
  }));

  const drawnCardStyle = useAnimatedStyle(() => ({
    opacity: drawnCardOpacity.value,
    transform: [
      { translateX: drawnCardX.value },
      { translateY: drawnCardY.value },
      { scale: drawnCardScale.value },
      { perspective: 1200 },
      {
        rotateY: `${interpolate(flipProgress.value, [0, 1], [0, 180])}deg`,
      },
    ],
  }));

  const backOpacityStyle = useAnimatedStyle(() => ({
    opacity: flipProgress.value < 0.5 ? 1 : 0,
  }));

  const frontOpacityStyle = useAnimatedStyle(() => ({
    opacity: flipProgress.value >= 0.5 ? 1 : 0,
    transform: [{ scaleX: -1 }],
  }));

  // ── Skia derived values ──
  const crystalGlowOpacity = useDerivedValue(() => 0.2 + crystalPulse.value * 0.15);
  const crystalInnerR = useDerivedValue(() => 28 + crystalPulse.value * 4);

  // Candle flame flicker
  const candleLeftFy = useDerivedValue(
    () => SCREEN_H * 0.35 - 14 - Math.sin(candleFlicker.value) * 2,
  );
  const candleRightFy = useDerivedValue(
    () => SCREEN_H * 0.35 - 14 - Math.sin(candleFlicker.value * 1.3 + 1) * 2,
  );
  const candleLeftOp = useDerivedValue(() => 0.7 + Math.sin(candleFlicker.value * 2.1) * 0.2);
  const candleRightOp = useDerivedValue(() => 0.7 + Math.sin(candleFlicker.value * 1.7 + 2) * 0.2);

  // Magic circle path
  const mcCx = screenWidth / 2;
  const mcCy = SCREEN_H / 2;
  const mcRadius = cardWidth * 0.55;
  const hexagramPath = useMemo(
    () => buildHexagramPath(mcCx, mcCy, mcRadius),
    [mcCx, mcCy, mcRadius],
  );
  const mcRotation = useDerivedValue(() => [{ rotate: magicCircleRotation.value }]);
  const mcOp = useDerivedValue(() => magicCircleOpacity.value);

  // Velvet table animated style
  const velvetStyle = useAnimatedStyle(() => ({
    opacity: velvetOpacity.value,
  }));

  // Fortune text animated style
  const fortuneStyle = useAnimatedStyle(() => ({
    opacity: fortuneOpacity.value,
  }));

  // ── Render ──
  return (
    <View testID={`${testIDPrefix}-container`} style={styles.container}>
      <AtmosphericBackground color={theme.primaryColor} animate={!reducedMotion} />

      {/* ── Skia Scene Layer (stars, crystal ball, candles, magic circle, trail) ── */}
      {!reducedMotion && (
        <Canvas style={styles.fullScreen} pointerEvents="none">
          {/* Star sky background — 30 dots */}
          <Group blendMode="screen">
            {STARS.map((star, i) => {
              if (!star.twinkle) {
                return (
                  <Circle
                    key={`star-${i}`}
                    cx={star.x}
                    cy={star.y}
                    r={star.r}
                    color={TAROT_COLORS.starfield}
                    opacity={0.35}
                  />
                );
              }
              return (
                <TwinklingStar
                  key={`star-${i}`}
                  x={star.x}
                  y={star.y}
                  r={star.r}
                  phase={star.phase}
                  cycle={starCycle}
                />
              );
            })}
          </Group>

          {/* Crystal ball — top center */}
          <Group>
            {/* Outer glow */}
            <Circle cx={SCREEN_W / 2} cy={SCREEN_H * 0.18} r={36}>
              <RadialGradient
                c={vec(SCREEN_W / 2, SCREEN_H * 0.18)}
                r={36}
                colors={[`${TAROT_COLORS.crystalBall}40`, `${TAROT_COLORS.crystalBall}00`]}
              />
              <Blur blur={12} />
            </Circle>
            {/* Ball body */}
            <Circle cx={SCREEN_W / 2} cy={SCREEN_H * 0.18} r={22} color="#221144">
              <RadialGradient
                c={vec(SCREEN_W / 2 - 5, SCREEN_H * 0.18 - 5)}
                r={22}
                colors={['#443388', '#1a0a2e']}
              />
            </Circle>
            {/* Inner fog glow */}
            <Circle
              cx={SCREEN_W / 2}
              cy={SCREEN_H * 0.18}
              r={crystalInnerR}
              opacity={crystalGlowOpacity}
            >
              <RadialGradient
                c={vec(SCREEN_W / 2, SCREEN_H * 0.18)}
                r={30}
                colors={[`${TAROT_COLORS.crystalBall}80`, `${TAROT_COLORS.crystalBall}00`]}
              />
              <Blur blur={6} />
            </Circle>
            {/* Glass highlight */}
            <Circle
              cx={SCREEN_W / 2 - 7}
              cy={SCREEN_H * 0.18 - 7}
              r={5}
              color="#ffffff"
              opacity={0.25}
            >
              <Blur blur={2} />
            </Circle>
            {/* Base */}
            <Circle
              cx={SCREEN_W / 2}
              cy={SCREEN_H * 0.18 + 22}
              r={8}
              color="#332244"
              opacity={0.6}
            />
          </Group>

          {/* Left candle */}
          <Group>
            {/* Candle body */}
            <Circle cx={SCREEN_W * 0.12} cy={SCREEN_H * 0.35} r={5} color="#e8d8b8" />
            <Circle cx={SCREEN_W * 0.12} cy={SCREEN_H * 0.35 + 8} r={5} color="#e0c8a0" />
            {/* Flame layers */}
            <Circle cx={SCREEN_W * 0.12} cy={candleLeftFy} r={6} opacity={candleLeftOp}>
              <RadialGradient
                c={vec(SCREEN_W * 0.12, SCREEN_H * 0.35 - 14)}
                r={8}
                colors={[TAROT_COLORS.candleYellow, TAROT_COLORS.candleOrange, '#ff440000']}
              />
              <Blur blur={4} />
            </Circle>
            {/* Flame glow */}
            <Circle cx={SCREEN_W * 0.12} cy={SCREEN_H * 0.35 - 14} r={16} opacity={0.12}>
              <RadialGradient
                c={vec(SCREEN_W * 0.12, SCREEN_H * 0.35 - 14)}
                r={16}
                colors={[TAROT_COLORS.candleYellow, '#00000000']}
              />
              <Blur blur={8} />
            </Circle>
          </Group>

          {/* Right candle */}
          <Group>
            <Circle cx={SCREEN_W * 0.88} cy={SCREEN_H * 0.35} r={5} color="#e8d8b8" />
            <Circle cx={SCREEN_W * 0.88} cy={SCREEN_H * 0.35 + 8} r={5} color="#e0c8a0" />
            <Circle cx={SCREEN_W * 0.88} cy={candleRightFy} r={6} opacity={candleRightOp}>
              <RadialGradient
                c={vec(SCREEN_W * 0.88, SCREEN_H * 0.35 - 14)}
                r={8}
                colors={[TAROT_COLORS.candleYellow, TAROT_COLORS.candleOrange, '#ff440000']}
              />
              <Blur blur={4} />
            </Circle>
            <Circle cx={SCREEN_W * 0.88} cy={SCREEN_H * 0.35 - 14} r={16} opacity={0.12}>
              <RadialGradient
                c={vec(SCREEN_W * 0.88, SCREEN_H * 0.35 - 14)}
                r={16}
                colors={[TAROT_COLORS.candleYellow, '#00000000']}
              />
              <Blur blur={8} />
            </Circle>
          </Group>

          {/* Magic circle — appears during flip */}
          <Group opacity={mcOp} transform={mcRotation} origin={vec(mcCx, mcCy)}>
            {/* Outer ring */}
            <Circle
              cx={mcCx}
              cy={mcCy}
              r={mcRadius}
              color={TAROT_COLORS.magicCircle}
              style="stroke"
              strokeWidth={1}
            >
              <Blur blur={2} />
            </Circle>
            {/* Inner ring */}
            <Circle
              cx={mcCx}
              cy={mcCy}
              r={mcRadius * 0.7}
              color={TAROT_COLORS.magicCircle}
              style="stroke"
              strokeWidth={0.8}
            >
              <Blur blur={1} />
            </Circle>
            {/* Hexagram */}
            <SkiaPath
              path={hexagramPath}
              color={TAROT_COLORS.magicCircle}
              style="stroke"
              strokeWidth={1}
            >
              <Blur blur={1.5} />
            </SkiaPath>
            {/* 6 arc-segment decorations */}
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const angle = (Math.PI * 2 * i) / 6;
              const px = mcCx + Math.cos(angle) * mcRadius * 0.85;
              const py = mcCy + Math.sin(angle) * mcRadius * 0.85;
              return (
                <Circle key={`mc-dot-${i}`} cx={px} cy={py} r={2} color={TAROT_COLORS.gold}>
                  <Blur blur={2} />
                </Circle>
              );
            })}
          </Group>

          {/* Trail light arc — visible during drawing phase */}
          <Group opacity={trailOp} blendMode="screen">
            <SkiaLine
              p1={vec(SCREEN_W / 2, SCREEN_H / 2 - wheelRadius)}
              p2={vec(SCREEN_W / 2, SCREEN_H / 2)}
              color={TAROT_COLORS.goldGlow}
              strokeWidth={3}
              style="stroke"
            >
              <Blur blur={6} />
            </SkiaLine>
          </Group>
        </Canvas>
      )}

      {/* Velvet table cloth — bottom 1/3 */}
      {!reducedMotion && (
        <Animated.View style={[styles.velvetTable, velvetStyle]} pointerEvents="none">
          <LinearGradient
            colors={['#1a0a2e00', '#1a0a2e', '#12071e']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.3 }}
          />
          {/* Gold fringe line */}
          <View style={styles.velvetFringe} />
        </Animated.View>
      )}

      {/* Prompt text */}
      {phase === 'waiting' && (
        <View style={styles.promptContainer}>
          <Animated.Text style={[styles.promptText, { color: TAROT_COLORS.gold }]}>
            🔮 选择一张塔罗牌
          </Animated.Text>
        </View>
      )}
      {phase === 'drawing' && (
        <View style={styles.promptContainer}>
          <Animated.Text style={[styles.promptText, { color: TAROT_COLORS.gold }]}>
            ✨ 翻牌中…
          </Animated.Text>
        </View>
      )}

      {/* Wheel of cards */}
      {phase !== 'revealed' && (
        <Animated.View
          testID={`${testIDPrefix}-wheel`}
          style={[
            styles.wheel,
            {
              width: wheelRadius * 2.5,
              height: wheelRadius * 2.5,
            },
            wheelStyle,
          ]}
        >
          {wheelCards.map((card, index) => {
            const x = Math.cos(card.angle - Math.PI / 2) * wheelRadius;
            const y = Math.sin(card.angle - Math.PI / 2) * wheelRadius;
            const rotation = (card.angle * 180) / Math.PI;
            const isSelected = selectedCardIndex === index;

            return (
              <View
                key={card.id}
                style={[
                  styles.wheelCard,
                  isSelected && styles.hidden,
                  {
                    width: cardWidth * 0.32,
                    height: cardHeight * 0.32,
                    transform: [{ translateX: x }, { translateY: y }, { rotate: `${rotation}deg` }],
                  },
                ]}
              >
                <Pressable
                  onPress={() => handleCardSelect(index)}
                  disabled={phase !== 'waiting'}
                  style={styles.pressableFill}
                >
                  <CardBackFace width={cardWidth * 0.32} height={cardHeight * 0.32} />
                </Pressable>
              </View>
            );
          })}
        </Animated.View>
      )}

      {/* Drawn card (fly to center → flip) */}
      <Animated.View
        pointerEvents={phase === 'waiting' ? 'none' : 'auto'}
        testID={`${testIDPrefix}-drawn-card`}
        style={[styles.drawnCard, { width: cardWidth, height: cardHeight }, drawnCardStyle]}
      >
        {/* Card back */}
        <Animated.View style={[styles.cardFace, styles.cardBackZ, backOpacityStyle]}>
          <CardBackFace width={cardWidth} height={cardHeight} />
        </Animated.View>

        {/* Card front */}
        <Animated.View style={[styles.cardFace, styles.cardFrontZ, frontOpacityStyle]}>
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
      </Animated.View>

      {/* Fortune quote — appears after reveal */}
      {phase === 'revealed' && (
        <Animated.View
          style={[styles.fortuneContainer, { top: insets.top + 60 }, fortuneStyle]}
          pointerEvents="none"
        >
          <Animated.Text style={styles.fortuneText}>
            {FORTUNE_QUOTES[role.alignment] ?? FORTUNE_QUOTES.villager}
          </Animated.Text>
        </Animated.View>
      )}
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#070012',
  },
  fullScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_W,
    height: SCREEN_H,
  },
  wheel: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelCard: {
    position: 'absolute',
    borderRadius: borderRadius.small,
    boxShadow: '0px 4px 6px rgba(0,0,0,0.3)',
  },
  cardBackFace: {
    borderRadius: borderRadius.medium,
    overflow: 'hidden',
  },
  cardBackInner: {
    flex: 1,
    padding: 6,
  },
  cardBackBorder: {
    flex: 1,
    borderWidth: 2,
    borderRadius: borderRadius.small,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBackCanvas: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  drawnCard: {
    borderRadius: borderRadius.medium,
    boxShadow: `0px 10px 20px rgba(212,175,55,0.5)`,
    overflow: 'visible',
  },
  cardFace: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: borderRadius.medium,
    overflow: 'visible',
    backfaceVisibility: 'hidden',
  },
  cardBackZ: {
    zIndex: 2,
  },
  cardFrontZ: {
    zIndex: 1,
  },
  glowBorder: {
    position: 'absolute',
    top: -4,
    left: -4,
  },
  hidden: {
    opacity: 0,
  },
  pressableFill: {
    flex: 1,
  },
  promptContainer: {
    position: 'absolute',
    bottom: 80,
    alignItems: 'center',
  },
  promptText: {
    fontSize: 20,
    fontWeight: '600',
    ...crossPlatformTextShadow(TAROT_COLORS.goldGlow, 0, 0, 10),
  },
  velvetTable: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_H * 0.35,
  },
  velvetFringe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: TAROT_COLORS.velvetFringe,
    opacity: 0.5,
  },
  fortuneContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  fortuneText: {
    fontSize: 18,
    fontWeight: '500',
    color: TAROT_COLORS.gold,
    textAlign: 'center',
    ...crossPlatformTextShadow(TAROT_COLORS.goldGlow, 0, 0, 12),
  },
});
