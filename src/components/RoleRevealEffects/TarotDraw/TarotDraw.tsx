/**
 * TarotDraw - 塔罗牌占卜揭示效果（Reanimated 4 + SVG）
 *
 * 动画流程：星空+水晶球+蜡烛的占卜场景 → 牌从桌面转盘旋转 →
 * 玩家点选 → 金色光丝拖尾飞向中央 → 六角魔法阵浮现 → 翻转揭示 → 命运之语。
 * 使用 `useSharedValue` 驱动所有动画，`runOnJS` 切换阶段，无 `setTimeout`。
 * 渲染动画与触觉反馈。不 import service，不含业务逻辑。
 */
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle as SvgCircle,
  Defs,
  FeGaussianBlur,
  Filter,
  G,
  Line as SvgLine,
  LinearGradient as SvgLinearGradient,
  Path as SvgPath,
  RadialGradient as SvgRadialGradient,
  Rect as SvgRect,
  Stop,
} from 'react-native-svg';

import { AlignmentRevealOverlay } from '@/components/RoleRevealEffects/common/AlignmentRevealOverlay';
import { AtmosphericBackground } from '@/components/RoleRevealEffects/common/effects/AtmosphericBackground';
import { RevealBurst } from '@/components/RoleRevealEffects/common/effects/RevealBurst';
import { SkiaSparkle } from '@/components/RoleRevealEffects/common/effects/SkiaSparkle';
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
import { borderRadius, colors, crossPlatformTextShadow } from '@/theme';

const AnimatedSvgCircle = Animated.createAnimatedComponent(SvgCircle);
const AnimatedG = Animated.createAnimatedComponent(G);

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

// ─── Card back SVG content (replaces useTexture pre-rasterization) ─────
const CARD_BACK_PADDING = 6;
const CARD_BACK_BORDER_WIDTH = 2;
const CARD_BACK_MOON_R = 10;
const CARD_BACK_STAR_SPACING = 24;
const CARD_BACK_STAR_LEN = 6;
const CARD_BACK_DIAG_LEN = 4;

const CardBackSvg: React.FC<{ width: number; height: number }> = React.memo(({ width, height }) => {
  const outerR = borderRadius.medium;
  const cx = width / 2;
  const moonY = height * 0.32;
  const starY = height * 0.48;
  const vineY = height * 0.62;
  const innerX = CARD_BACK_PADDING;
  const innerY = CARD_BACK_PADDING;
  const innerW = width - CARD_BACK_PADDING * 2;
  const innerH = height - CARD_BACK_PADDING * 2;
  const innerR = borderRadius.small;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgLinearGradient
          id="card-back-grad"
          x1="0"
          y1="0"
          x2={String(width)}
          y2={String(height)}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={TAROT_COLORS.cardBack[0]} />
          <Stop offset="0.5" stopColor={TAROT_COLORS.cardBack[1]} />
          <Stop offset="1" stopColor={TAROT_COLORS.cardBack[2]} />
        </SvgLinearGradient>
        <Filter id="moon-glow-blur">
          <FeGaussianBlur stdDeviation={1} />
        </Filter>
      </Defs>
      {/* Gradient background */}
      <SvgRect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={outerR}
        ry={outerR}
        fill="url(#card-back-grad)"
      />
      {/* Gold border (inset) */}
      <SvgRect
        x={innerX}
        y={innerY}
        width={innerW}
        height={innerH}
        rx={innerR}
        ry={innerR}
        stroke={TAROT_COLORS.gold}
        fill="none"
        strokeWidth={CARD_BACK_BORDER_WIDTH}
      />
      {/* Crescent moon */}
      <SvgCircle
        cx={cx}
        cy={moonY}
        r={CARD_BACK_MOON_R + 3}
        fill={TAROT_COLORS.goldGlow}
        filter="url(#moon-glow-blur)"
      />
      <SvgCircle cx={cx} cy={moonY} r={CARD_BACK_MOON_R} fill={TAROT_COLORS.gold} />
      <SvgCircle
        cx={cx + 4}
        cy={moonY - 2}
        r={CARD_BACK_MOON_R - 2}
        fill={TAROT_COLORS.cardBack[0]}
      />
      {/* Three cross-sparkle stars */}
      {[-1, 0, 1].map((offset) => {
        const sx = cx + offset * CARD_BACK_STAR_SPACING;
        return (
          <G key={`star-${offset}`}>
            <SvgLine
              x1={sx}
              y1={starY - CARD_BACK_STAR_LEN}
              x2={sx}
              y2={starY + CARD_BACK_STAR_LEN}
              stroke={TAROT_COLORS.gold}
              strokeWidth={1.2}
              strokeLinecap="round"
            />
            <SvgLine
              x1={sx - CARD_BACK_STAR_LEN}
              y1={starY}
              x2={sx + CARD_BACK_STAR_LEN}
              y2={starY}
              stroke={TAROT_COLORS.gold}
              strokeWidth={1.2}
              strokeLinecap="round"
            />
            <SvgLine
              x1={sx - CARD_BACK_DIAG_LEN}
              y1={starY - CARD_BACK_DIAG_LEN}
              x2={sx + CARD_BACK_DIAG_LEN}
              y2={starY + CARD_BACK_DIAG_LEN}
              stroke={TAROT_COLORS.gold}
              strokeWidth={0.7}
              strokeLinecap="round"
            />
            <SvgLine
              x1={sx + CARD_BACK_DIAG_LEN}
              y1={starY - CARD_BACK_DIAG_LEN}
              x2={sx - CARD_BACK_DIAG_LEN}
              y2={starY + CARD_BACK_DIAG_LEN}
              stroke={TAROT_COLORS.gold}
              strokeWidth={0.7}
              strokeLinecap="round"
            />
            <SvgCircle cx={sx} cy={starY} r={1.5} fill={TAROT_COLORS.gold} />
          </G>
        );
      })}
      {/* Vine/flourish decorations */}
      <SvgCircle cx={cx - 20} cy={vineY} r={3} fill={TAROT_COLORS.gold} opacity={0.5} />
      <SvgLine
        x1={cx - 12}
        y1={vineY}
        x2={cx + 12}
        y2={vineY}
        stroke={TAROT_COLORS.gold}
        strokeWidth={0.8}
        strokeLinecap="round"
        opacity={0.4}
      />
      <SvgCircle cx={cx + 20} cy={vineY} r={3} fill={TAROT_COLORS.gold} opacity={0.5} />
      {/* Central diamond accent */}
      <SvgPath
        d={`M ${cx} ${vineY - 5} L ${cx + 4} ${vineY} L ${cx} ${vineY + 5} L ${cx - 4} ${vineY} Z`}
        fill={TAROT_COLORS.gold}
        opacity={0.6}
      />
    </Svg>
  );
});
CardBackSvg.displayName = 'CardBackSvg';

// ─── Twinkling star (SVG sparkle cross, driven by shared cycle) ────────
const TwinklingStar: React.FC<{
  x: number;
  y: number;
  r: number;
  phase: number;
  cycle: SharedValue<number>;
}> = React.memo(({ x, y, r, phase, cycle }) => {
  const animatedProps = useAnimatedProps(() => ({
    opacity: 0.3 + Math.sin(cycle.value + phase) * 0.3,
  }));
  const isBright = r > 1.0;

  return (
    <AnimatedG animatedProps={animatedProps}>
      <SkiaSparkle
        x={x}
        y={y}
        r={r}
        color={TAROT_COLORS.starfield}
        bright={isBright}
        glowBlur={isBright ? 5 : 3}
      />
    </AnimatedG>
  );
});
TwinklingStar.displayName = 'TwinklingStar';

// ─── Candle flame (animated position + opacity) ────────────────────────
interface CandleFlameProps {
  cx: number;
  baseY: number;
  flicker: SharedValue<number>;
  yMul: number;
  yPhase: number;
  opMul: number;
  opPhase: number;
  gradId: string;
}

const CandleFlame: React.FC<CandleFlameProps> = React.memo(
  ({ cx, baseY, flicker, yMul, yPhase, opMul, opPhase, gradId }) => {
    const animatedProps = useAnimatedProps(() => ({
      cy: baseY - Math.sin(flicker.value * yMul + yPhase) * 2,
      opacity: 0.7 + Math.sin(flicker.value * opMul + opPhase) * 0.2,
    }));

    return (
      <AnimatedSvgCircle
        cx={cx}
        r={6}
        fill={`url(#${gradId})`}
        filter="url(#candle-blur)"
        animatedProps={animatedProps}
      />
    );
  },
);
CandleFlame.displayName = 'CandleFlame';

// ─── Crystal inner glow (animated r + opacity) ─────────────────────────
interface CrystalInnerGlowProps {
  cx: number;
  cy: number;
  crystalPulse: SharedValue<number>;
}

const CrystalInnerGlow: React.FC<CrystalInnerGlowProps> = React.memo(({ cx, cy, crystalPulse }) => {
  const animatedProps = useAnimatedProps(() => ({
    r: 28 + crystalPulse.value * 4,
    opacity: 0.2 + crystalPulse.value * 0.15,
  }));

  return (
    <AnimatedSvgCircle
      cx={cx}
      cy={cy}
      fill="url(#crystal-inner-grad)"
      filter="url(#crystal-inner-blur)"
      animatedProps={animatedProps}
    />
  );
});
CrystalInnerGlow.displayName = 'CrystalInnerGlow';

// ─── Main component ─────────────────────────────────────────────────────
export const TarotDraw: React.FC<RoleRevealEffectProps> = ({
  role,
  onComplete,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'tarot-draw',
}) => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const alignmentThemes = useMemo(() => createAlignmentThemes(colors), []);
  const theme = alignmentThemes[role.alignment];
  const config = CONFIG.tarot ?? { flipDuration: 800, revealHoldDuration: 1500 };

  const [phase, setPhase] = useState<'waiting' | 'drawing' | 'flipping' | 'revealed'>('waiting');
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const { fireComplete } = useRevealLifecycle({
    onComplete,
    revealHoldDurationMs: config.revealHoldDuration,
  });

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
  const fortuneOpacity = useSharedValue(0);
  const velvetOpacity = useSharedValue(0);

  // ── SVG animated props for scene elements ──
  const magicCircleGroupProps = useAnimatedProps(() => ({
    opacity: magicCircleOpacity.value,
    rotation: (magicCircleRotation.value * 180) / Math.PI,
  }));
  const trailGroupProps = useAnimatedProps(() => ({
    opacity: trailOpacity.value,
  }));

  // ── Phase transitions ──
  const enterRevealed = useCallback(() => {
    setPhase('revealed');
    if (enableHaptics) void triggerHaptic('heavy', true);
    // Fortune quote fades in
    fortuneOpacity.value = withDelay(400, withTiming(1, { duration: 800 }));
    // Magic circle fades out
    magicCircleOpacity.value = withDelay(500, withTiming(0, { duration: 600 }));
  }, [enableHaptics, fortuneOpacity, magicCircleOpacity]);

  const startFlipping = useCallback(() => {
    setPhase('flipping');
    if (enableHaptics) void triggerHaptic('medium', true);

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
    if (enableHaptics) void triggerHaptic('medium', true);

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
      if (enableHaptics) void triggerHaptic('medium', true);

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

  // ── Kick-off ──
  useEffect(() => {
    if (reducedMotion) {
      flipProgress.value = 1;
      wheelOpacity.value = 0;
      drawnCardOpacity.value = 1;
      drawnCardScale.value = 1;
      setPhase('revealed');
      fireComplete();
      return;
    }

    // Slow spin: 4 seconds per revolution, infinite loop
    wheelRotation.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1);

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
    fireComplete,
  ]);

  // ── Auto-select if user doesn't tap (unified 8s timeout) ──
  const autoSelectRandom = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * wheelCards.length);
    handleCardSelect(randomIndex);
  }, [wheelCards.length, handleCardSelect]);
  const autoTimeoutWarning = useAutoTimeout(
    phase === 'waiting' && !reducedMotion,
    autoSelectRandom,
  );

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

  // ── Scene element positions (static) ──
  const candleLeftX = SCREEN_W * 0.12;
  const candleRightX = SCREEN_W * 0.88;
  const candleBaseY = SCREEN_H * 0.35 - 14;

  // Magic circle path
  const mcCx = screenWidth / 2;
  const mcCy = SCREEN_H / 2;
  const mcRadius = cardWidth * 0.55;
  const hexagramPath = useMemo(
    () => buildHexagramPath(mcCx, mcCy, mcRadius),
    [mcCx, mcCy, mcRadius],
  );

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

      {/* ── SVG Scene Layer (stars, crystal ball, candles, magic circle, trail) ── */}
      {!reducedMotion && (
        <Svg style={styles.fullScreen}>
          <Defs>
            <Filter id="crystal-outer-blur">
              <FeGaussianBlur stdDeviation={12} />
            </Filter>
            <Filter id="crystal-inner-blur">
              <FeGaussianBlur stdDeviation={6} />
            </Filter>
            <Filter id="crystal-highlight-blur">
              <FeGaussianBlur stdDeviation={2} />
            </Filter>
            <Filter id="candle-blur">
              <FeGaussianBlur stdDeviation={4} />
            </Filter>
            <Filter id="candle-glow-blur">
              <FeGaussianBlur stdDeviation={8} />
            </Filter>
            <Filter id="mc-ring-blur">
              <FeGaussianBlur stdDeviation={2} />
            </Filter>
            <Filter id="mc-inner-blur">
              <FeGaussianBlur stdDeviation={1} />
            </Filter>
            <Filter id="mc-hex-blur">
              <FeGaussianBlur stdDeviation={1.5} />
            </Filter>
            <Filter id="mc-dot-blur">
              <FeGaussianBlur stdDeviation={2} />
            </Filter>
            <Filter id="trail-blur">
              <FeGaussianBlur stdDeviation={6} />
            </Filter>
            <SvgRadialGradient
              id="crystal-outer-grad"
              cx={String(SCREEN_W / 2)}
              cy={String(SCREEN_H * 0.18)}
              r="36"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={TAROT_COLORS.crystalBall} stopOpacity={0.25} />
              <Stop offset="1" stopColor={TAROT_COLORS.crystalBall} stopOpacity={0} />
            </SvgRadialGradient>
            <SvgRadialGradient
              id="crystal-body-grad"
              cx={String(SCREEN_W / 2 - 5)}
              cy={String(SCREEN_H * 0.18 - 5)}
              r="22"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor="#443388" />
              <Stop offset="1" stopColor="#1a0a2e" />
            </SvgRadialGradient>
            <SvgRadialGradient
              id="crystal-inner-grad"
              cx={String(SCREEN_W / 2)}
              cy={String(SCREEN_H * 0.18)}
              r="30"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={TAROT_COLORS.crystalBall} stopOpacity={0.5} />
              <Stop offset="1" stopColor={TAROT_COLORS.crystalBall} stopOpacity={0} />
            </SvgRadialGradient>
            <SvgRadialGradient
              id="candle-flame-left"
              cx={String(candleLeftX)}
              cy={String(candleBaseY)}
              r="8"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={TAROT_COLORS.candleYellow} />
              <Stop offset="0.5" stopColor={TAROT_COLORS.candleOrange} />
              <Stop offset="1" stopColor="#ff4400" stopOpacity={0} />
            </SvgRadialGradient>
            <SvgRadialGradient
              id="candle-glow-left"
              cx={String(candleLeftX)}
              cy={String(candleBaseY)}
              r="16"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={TAROT_COLORS.candleYellow} />
              <Stop offset="1" stopColor="black" stopOpacity={0} />
            </SvgRadialGradient>
            <SvgRadialGradient
              id="candle-flame-right"
              cx={String(candleRightX)}
              cy={String(candleBaseY)}
              r="8"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={TAROT_COLORS.candleYellow} />
              <Stop offset="0.5" stopColor={TAROT_COLORS.candleOrange} />
              <Stop offset="1" stopColor="#ff4400" stopOpacity={0} />
            </SvgRadialGradient>
            <SvgRadialGradient
              id="candle-glow-right"
              cx={String(candleRightX)}
              cy={String(candleBaseY)}
              r="16"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={TAROT_COLORS.candleYellow} />
              <Stop offset="1" stopColor="black" stopOpacity={0} />
            </SvgRadialGradient>
          </Defs>

          {/* Star sky background */}
          {/* eslint-disable-next-line react-native/no-inline-styles -- SVG CSS property, not RN style */}
          <G style={{ mixBlendMode: 'screen' }}>
            {STARS.map((star, i) => {
              if (!star.twinkle) {
                return (
                  <SvgCircle
                    key={`star-${i}`}
                    cx={star.x}
                    cy={star.y}
                    r={star.r}
                    fill={TAROT_COLORS.starfield}
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
          </G>

          {/* Crystal ball — top center */}
          <G>
            {/* Outer glow */}
            <SvgCircle
              cx={SCREEN_W / 2}
              cy={SCREEN_H * 0.18}
              r={36}
              fill="url(#crystal-outer-grad)"
              filter="url(#crystal-outer-blur)"
            />
            {/* Ball body */}
            <SvgCircle
              cx={SCREEN_W / 2}
              cy={SCREEN_H * 0.18}
              r={22}
              fill="url(#crystal-body-grad)"
            />
            {/* Inner fog glow */}
            <CrystalInnerGlow cx={SCREEN_W / 2} cy={SCREEN_H * 0.18} crystalPulse={crystalPulse} />
            {/* Glass highlight */}
            <SvgCircle
              cx={SCREEN_W / 2 - 7}
              cy={SCREEN_H * 0.18 - 7}
              r={5}
              fill="#ffffff"
              opacity={0.25}
              filter="url(#crystal-highlight-blur)"
            />
            {/* Base */}
            <SvgCircle
              cx={SCREEN_W / 2}
              cy={SCREEN_H * 0.18 + 22}
              r={8}
              fill="#332244"
              opacity={0.6}
            />
          </G>

          {/* Left candle */}
          <G>
            <SvgCircle cx={candleLeftX} cy={SCREEN_H * 0.35} r={5} fill="#e8d8b8" />
            <SvgCircle cx={candleLeftX} cy={SCREEN_H * 0.35 + 8} r={5} fill="#e0c8a0" />
            <CandleFlame
              cx={candleLeftX}
              baseY={candleBaseY}
              flicker={candleFlicker}
              yMul={1}
              yPhase={0}
              opMul={2.1}
              opPhase={0}
              gradId="candle-flame-left"
            />
            <SvgCircle
              cx={candleLeftX}
              cy={candleBaseY}
              r={16}
              fill="url(#candle-glow-left)"
              opacity={0.12}
              filter="url(#candle-glow-blur)"
            />
          </G>

          {/* Right candle */}
          <G>
            <SvgCircle cx={candleRightX} cy={SCREEN_H * 0.35} r={5} fill="#e8d8b8" />
            <SvgCircle cx={candleRightX} cy={SCREEN_H * 0.35 + 8} r={5} fill="#e0c8a0" />
            <CandleFlame
              cx={candleRightX}
              baseY={candleBaseY}
              flicker={candleFlicker}
              yMul={1.3}
              yPhase={1}
              opMul={1.7}
              opPhase={2}
              gradId="candle-flame-right"
            />
            <SvgCircle
              cx={candleRightX}
              cy={candleBaseY}
              r={16}
              fill="url(#candle-glow-right)"
              opacity={0.12}
              filter="url(#candle-glow-blur)"
            />
          </G>

          {/* Magic circle — appears during flip */}
          <AnimatedG originX={mcCx} originY={mcCy} animatedProps={magicCircleGroupProps}>
            <SvgCircle
              cx={mcCx}
              cy={mcCy}
              r={mcRadius}
              stroke={TAROT_COLORS.magicCircle}
              fill="none"
              strokeWidth={1}
              filter="url(#mc-ring-blur)"
            />
            <SvgCircle
              cx={mcCx}
              cy={mcCy}
              r={mcRadius * 0.7}
              stroke={TAROT_COLORS.magicCircle}
              fill="none"
              strokeWidth={0.8}
              filter="url(#mc-inner-blur)"
            />
            <SvgPath
              d={hexagramPath}
              stroke={TAROT_COLORS.magicCircle}
              fill="none"
              strokeWidth={1}
              filter="url(#mc-hex-blur)"
            />
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const angle = (Math.PI * 2 * i) / 6;
              const px = mcCx + Math.cos(angle) * mcRadius * 0.85;
              const py = mcCy + Math.sin(angle) * mcRadius * 0.85;
              return (
                <SvgCircle
                  key={`mc-dot-${i}`}
                  cx={px}
                  cy={py}
                  r={2}
                  fill={TAROT_COLORS.gold}
                  filter="url(#mc-dot-blur)"
                />
              );
            })}
          </AnimatedG>

          {/* Trail light arc — visible during drawing phase */}
          <AnimatedG animatedProps={trailGroupProps} {...{ style: { mixBlendMode: 'screen' } }}>
            <SvgLine
              x1={SCREEN_W / 2}
              y1={SCREEN_H / 2 - wheelRadius}
              x2={SCREEN_W / 2}
              y2={SCREEN_H / 2}
              stroke={TAROT_COLORS.goldGlow}
              strokeWidth={3}
              filter="url(#trail-blur)"
            />
          </AnimatedG>
        </Svg>
      )}

      {/* Velvet table cloth — bottom 1/3 */}
      {!reducedMotion && (
        <Animated.View style={[styles.velvetTable, velvetStyle]}>
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
                  <CardBackSvg width={cardWidth * 0.32} height={cardHeight * 0.32} />
                </Pressable>
              </View>
            );
          })}
        </Animated.View>
      )}

      {/* Drawn card (fly to center → flip) */}
      <Animated.View
        testID={`${testIDPrefix}-drawn-card`}
        style={[
          styles.drawnCard,
          { width: cardWidth, height: cardHeight },
          phase === 'waiting' ? styles.pointerEventsNone : styles.pointerEventsAuto,
          drawnCardStyle,
        ]}
      >
        {/* Card back */}
        <Animated.View style={[styles.cardFace, styles.cardBackZ, backOpacityStyle]}>
          <CardBackSvg width={cardWidth} height={cardHeight} />
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
              onComplete={fireComplete}
            />
          )}
        </Animated.View>
      </Animated.View>

      {/* Fortune quote — appears after reveal */}
      {phase === 'revealed' && (
        <Animated.View style={[styles.fortuneContainer, { top: insets.top + 60 }, fortuneStyle]}>
          <Animated.Text style={styles.fortuneText}>
            {FORTUNE_QUOTES[role.alignment] ?? FORTUNE_QUOTES.villager}
          </Animated.Text>
        </Animated.View>
      )}

      <HintWithWarning
        hintText={phase === 'waiting' ? '✨ 凭直觉选一张牌' : null}
        showWarning={autoTimeoutWarning}
      />
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  pointerEventsNone: { pointerEvents: 'none' as const },
  pointerEventsAuto: { pointerEvents: 'auto' as const },
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
    pointerEvents: 'none',
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
    pointerEvents: 'none',
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
    pointerEvents: 'none',
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
    pointerEvents: 'none',
  },
  fortuneText: {
    fontSize: 18,
    fontWeight: '500',
    color: TAROT_COLORS.gold,
    textAlign: 'center',
    ...crossPlatformTextShadow(TAROT_COLORS.goldGlow, 0, 0, 12),
  },
});
