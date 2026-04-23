/**
 * FilmRewind - 胶片倒放揭示动画（SVG + Reanimated 4）
 *
 * 视觉设计：老旧电影放映机风格 — 暖色投影灯光 + 胶片边框齿孔 +
 * 倒计时数字(5→0) + 胶片颗粒噪点 + 闪烁 + 竖划痕 + 暗角。
 * 交互：点击屏幕启动放映，5→0 倒计时后自动揭示（无需持续操作）。
 * 属于 AUTO_EFFECTS — 点击后自动完成。
 *
 * Skia 负责：胶片边框 + 齿孔 + 噪点 + 划痕 + 倒计时圆环 + 暗角。
 * Reanimated 负责：齿孔滚动 + 闪烁 + 阶段切换 + 卡片入场。
 * 不 import service，不含业务逻辑。
 */
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  Easing,
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
  ClipPath,
  Defs,
  G,
  Line as SvgLine,
  RadialGradient as SvgRadialGradient,
  Rect as SvgRect,
  Stop,
} from 'react-native-svg';

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
import { colors, crossPlatformTextShadow } from '@/theme';

const AnimatedSvgRect = Animated.createAnimatedComponent(SvgRect);
const AnimatedSvgLine = Animated.createAnimatedComponent(SvgLine);
const AnimatedG = Animated.createAnimatedComponent(G);

// ─── Visual constants ──────────────────────────────────────────────────
const BG_GRADIENT = ['#0a0906', '#0d0b08', '#0a0906'] as const;

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;

const FR = CONFIG.filmRewind;

const COLORS = {
  filmBorder: '#111111',
  sprocketOuter: '#1a1a1a',
  sprocketInner: '#080808',
  projectorWarm: 'rgba(200, 180, 140, 0.25)',
  countdownText: 'rgba(220, 200, 160, 0.9)',
  countdownRing: 'rgba(200, 180, 140, 0.3)',
  countdownSector: 'rgba(200, 180, 140, 0.1)',
  crosshair: 'rgba(200, 180, 140, 0.2)',
  scratchLine: 'rgba(200, 180, 140, 0.04)',
  grainLight: 'rgba(255, 255, 255, 0.03)',
  grainDark: 'rgba(0, 0, 0, 0.03)',
} as const;

const BORDER_W = FR.filmBorderWidth;

// ─── Pre-computed sprocket holes ────────────────────────────────────────
const SPROCKET_SPACING = FR.sprocketSpacing;
const SPROCKET_HOLE_W = 10;
const SPROCKET_HOLE_H = 14;

/** Number of sprocket holes visible on screen + buffer */
const SPROCKET_COUNT = Math.ceil(SCREEN_H / SPROCKET_SPACING) + 2;

/** Vertical scratch X positions (stable) */
const SCRATCHES = Array.from({ length: FR.scratchCount }, (_, i) => ({
  x: SCREEN_W * (0.25 + ((i * 37 + 13) % 50) / 100),
  drift: (((i * 71 + 29) % 100) / 100) * 5,
}));

/**
 * Grain noise field — 2× screen area so we can translate the Group
 * by grainCycle ∈ [0,1) × offset to simulate redrawn-per-frame noise
 * without re-allocating Skia nodes.
 */
const GRAIN_FIELD_W = SCREEN_W * 2;
const GRAIN_FIELD_H = SCREEN_H * 2;
const GRAIN_PARTICLES = Array.from({ length: FR.grainCount * 2 }, (_, i) => ({
  x: (((i * 73 + 17) % 2000) / 2000) * GRAIN_FIELD_W,
  y: (((i * 41 + 31) % 2000) / 2000) * GRAIN_FIELD_H,
  light: i % 2 === 0,
}));
const GRAIN_SHIFT_X = SCREEN_W * 0.73; // irrational-ish offset for variety
const GRAIN_SHIFT_Y = SCREEN_H * 0.61;

/** Horizontal scratch lines (random flash driven by grainCycle) */
const HORIZONTAL_SCRATCHES = Array.from({ length: 6 }, (_, i) => ({
  y: SCREEN_H * (0.1 + ((i * 43 + 7) % 90) / 100),
  phase: ((i * 67 + 13) % 100) / 100, // 0-1 phase offset for stagger
}));

// ─── Types ──────────────────────────────────────────────────────────────
type Phase = 'atmosphere' | 'idle' | 'countdown' | 'revealed';
// ─── Sub-components ─────────────────────────────────────────────────────────────

/** Single pair of left+right sprocket holes, scrolling with animation */
interface SprocketHolePairProps {
  baseY: number;
  sprocketScroll: SharedValue<number>;
}

const SprocketHolePair: React.FC<SprocketHolePairProps> = React.memo(
  ({ baseY, sprocketScroll }) => {
    const leftCx = BORDER_W / 2;
    const rightCx = SCREEN_W - BORDER_W / 2;

    const outerLeftProps = useAnimatedProps(() => {
      const yPos = (baseY + sprocketScroll.value) % (SPROCKET_COUNT * SPROCKET_SPACING);
      return { x: leftCx - SPROCKET_HOLE_W / 2, y: yPos - SPROCKET_HOLE_H / 2 };
    });
    const innerLeftProps = useAnimatedProps(() => {
      const yPos = (baseY + sprocketScroll.value) % (SPROCKET_COUNT * SPROCKET_SPACING);
      return { x: leftCx - 3, y: yPos - 5 };
    });
    const outerRightProps = useAnimatedProps(() => {
      const yPos = (baseY + sprocketScroll.value) % (SPROCKET_COUNT * SPROCKET_SPACING);
      return { x: rightCx - SPROCKET_HOLE_W / 2, y: yPos - SPROCKET_HOLE_H / 2 };
    });
    const innerRightProps = useAnimatedProps(() => {
      const yPos = (baseY + sprocketScroll.value) % (SPROCKET_COUNT * SPROCKET_SPACING);
      return { x: rightCx - 3, y: yPos - 5 };
    });

    return (
      <G>
        <AnimatedSvgRect
          width={SPROCKET_HOLE_W}
          height={SPROCKET_HOLE_H}
          rx={2}
          ry={2}
          fill={COLORS.sprocketOuter}
          animatedProps={outerLeftProps}
        />
        <AnimatedSvgRect
          width={6}
          height={10}
          rx={1}
          ry={1}
          fill={COLORS.sprocketInner}
          animatedProps={innerLeftProps}
        />
        <AnimatedSvgRect
          width={SPROCKET_HOLE_W}
          height={SPROCKET_HOLE_H}
          rx={2}
          ry={2}
          fill={COLORS.sprocketOuter}
          animatedProps={outerRightProps}
        />
        <AnimatedSvgRect
          width={6}
          height={10}
          rx={1}
          ry={1}
          fill={COLORS.sprocketInner}
          animatedProps={innerRightProps}
        />
      </G>
    );
  },
);
SprocketHolePair.displayName = 'SprocketHolePair';

/** Grain noise field with animated translation for per-frame variety */
interface GrainFieldProps {
  grainCycle: SharedValue<number>;
}

const GrainField: React.FC<GrainFieldProps> = React.memo(({ grainCycle }) => {
  const animatedProps = useAnimatedProps(() => ({
    x: -grainCycle.value * GRAIN_SHIFT_X,
    y: -grainCycle.value * GRAIN_SHIFT_Y,
  }));

  return (
    <AnimatedG clipPath="url(#grain-clip)" animatedProps={animatedProps}>
      {GRAIN_PARTICLES.map((g, i) => (
        <SvgRect
          key={`grain-${i}`}
          x={g.x}
          y={g.y}
          width={1}
          height={1}
          fill={g.light ? COLORS.grainLight : COLORS.grainDark}
        />
      ))}
    </AnimatedG>
  );
});
GrainField.displayName = 'GrainField';

/** Horizontal scratch that flashes based on grainCycle phase */
interface HorizontalScratchLineProps {
  scratch: (typeof HORIZONTAL_SCRATCHES)[number];
  grainCycle: SharedValue<number>;
}

const HorizontalScratchLine: React.FC<HorizontalScratchLineProps> = React.memo(
  ({ scratch, grainCycle }) => {
    const animatedProps = useAnimatedProps(() => {
      const t = (grainCycle.value + scratch.phase) % 1;
      return { opacity: t < 0.15 ? 0.08 : 0 };
    });

    return (
      <AnimatedSvgLine
        x1={0}
        y1={scratch.y}
        x2={SCREEN_W}
        y2={scratch.y}
        stroke="rgba(200, 180, 140, 0.06)"
        strokeWidth={1}
        animatedProps={animatedProps}
      />
    );
  },
);
HorizontalScratchLine.displayName = 'HorizontalScratchLine';
// ─── Main component ─────────────────────────────────────────────────────

export const FilmRewind: React.FC<RoleRevealEffectProps> = ({
  role,
  onComplete,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'film-rewind',
}) => {
  const alignmentThemes = useMemo(() => createAlignmentThemes(colors), []);
  const theme = alignmentThemes[role.alignment];

  const common = CONFIG.common;
  const cardWidth = Math.min(SCREEN_W * common.cardWidthRatio, common.cardMaxWidth);
  const cardHeight = cardWidth * common.cardAspectRatio;

  const [phase, setPhase] = useState<Phase>('atmosphere');
  const [countdownNum, setCountdownNum] = useState<number>(FR.countdownFrom);
  const { fireComplete } = useRevealLifecycle({
    onComplete,
    revealHoldDurationMs: FR.revealHoldDuration,
  });
  const countdownStartedRef = useRef(false);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Shared values ──
  const sprocketScroll = useSharedValue(0);
  const flickerOpacity = useSharedValue(0);
  const canvasOpacity = useSharedValue(1);
  const cardScale = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const flashOpacity = useSharedValue(0);
  const grainCycle = useSharedValue(0);

  // ── Phase transitions ──
  const enterRevealed = useCallback(() => setPhase('revealed'), []);

  const doReveal = useCallback(() => {
    setPhase('countdown'); // keep phase for hint text momentarily

    if (enableHaptics) void triggerHaptic('heavy', true);

    // Flash
    flashOpacity.value = withSequence(
      withTiming(0.7, { duration: 100 }),
      withTiming(0, { duration: 500 }),
    );

    // Fade canvas
    canvasOpacity.value = withDelay(200, withTiming(0, { duration: 400 }));

    // Card reveal
    cardScale.value = withDelay(
      FR.cardRevealDelay,
      withTiming(
        1,
        {
          duration: FR.cardRevealDuration,
          easing: Easing.out(Easing.back(1.15)),
        },
        (finished) => {
          'worklet';
          if (finished) runOnJS(enterRevealed)();
        },
      ),
    );
    cardOpacity.value = withDelay(
      FR.cardRevealDelay,
      withTiming(1, { duration: FR.cardRevealDuration }),
    );
  }, [enableHaptics, flashOpacity, canvasOpacity, cardScale, cardOpacity, enterRevealed]);

  const startCountdown = useCallback(() => {
    if (countdownStartedRef.current) return;
    countdownStartedRef.current = true;

    if (enableHaptics) void triggerHaptic('medium', true);
    setPhase('countdown');
    setCountdownNum(FR.countdownFrom);

    let remaining = FR.countdownFrom;
    countdownIntervalRef.current = setInterval(() => {
      remaining--;
      setCountdownNum(remaining);
      if (enableHaptics && remaining > 0) void triggerHaptic('light', true);
      if (remaining <= 0) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        doReveal();
      }
    }, FR.countdownInterval);
  }, [enableHaptics, doReveal]);

  // ── Init animations ──
  useEffect(() => {
    if (reducedMotion) {
      cardScale.value = 1;
      cardOpacity.value = 1;
      canvasOpacity.value = 0;
      setPhase('revealed');
      return;
    }

    // Sprocket scroll (continuous)
    sprocketScroll.value = withRepeat(
      withTiming(SPROCKET_SPACING, { duration: 600, easing: Easing.linear }),
      -1,
    );

    // Random flicker
    flickerOpacity.value = withRepeat(
      withSequence(
        withTiming(0.08, { duration: 100 }),
        withTiming(0, { duration: 200 }),
        withTiming(0.04, { duration: 50 }),
        withTiming(0, { duration: 500 }),
      ),
      -1,
    );

    // Grain cycle
    grainCycle.value = withRepeat(withTiming(1, { duration: 500, easing: Easing.linear }), -1);

    // Atmosphere → idle
    const timer = setTimeout(() => {
      setPhase('idle');
    }, FR.atmosphereDuration);

    return () => {
      clearTimeout(timer);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [
    reducedMotion,
    sprocketScroll,
    flickerOpacity,
    grainCycle,
    cardScale,
    cardOpacity,
    canvasOpacity,
  ]);

  // ── Auto-timeout ──
  const autoTimeoutWarning = useAutoTimeout(phase === 'idle', startCountdown);

  // ── Tap handler ──
  const handlePress = useCallback(() => {
    if (phase === 'idle') startCountdown();
  }, [phase, startCountdown]);

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

  const flickerStyle = useAnimatedStyle(() => ({
    opacity: flickerOpacity.value,
  }));

  // ── Sprocket hole Y positions (driven by scroll) ──
  const sprocketYOffsets = useMemo(
    () => Array.from({ length: SPROCKET_COUNT }, (_, i) => i * SPROCKET_SPACING),
    [],
  );

  // ── Countdown arc path ──
  const countdownProgress =
    phase === 'countdown' ? (FR.countdownFrom - countdownNum) / FR.countdownFrom : 0;

  return (
    <View style={styles.container} testID={`${testIDPrefix}-container`}>
      {/* Film projector dark background */}
      <LinearGradient
        colors={[...BG_GRADIENT]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={handlePress}
        testID={`${testIDPrefix}-press-area`}
      >
        <Animated.View style={[StyleSheet.absoluteFill, canvasContainerStyle]}>
          <Svg style={styles.absoluteFillNoEvents}>
            <Defs>
              <SvgRadialGradient
                id="projector-glow"
                cx={String(SCREEN_W / 2)}
                cy={String(SCREEN_H / 2)}
                r={String(SCREEN_H * 0.7)}
                gradientUnits="userSpaceOnUse"
              >
                <Stop offset="0" stopColor="rgb(60,50,30)" stopOpacity={0.25} />
                <Stop offset="0.5" stopColor="rgb(30,25,15)" stopOpacity={0.1} />
                <Stop offset="1" stopColor="black" stopOpacity={0} />
              </SvgRadialGradient>
              <SvgRadialGradient
                id="vignette-grad"
                cx={String(SCREEN_W / 2)}
                cy={String(SCREEN_H / 2)}
                r={String(SCREEN_H * 0.7)}
                gradientUnits="userSpaceOnUse"
              >
                <Stop offset="0" stopColor="black" stopOpacity={0} />
                <Stop offset="0.7" stopColor="black" stopOpacity={0.3} />
                <Stop offset="1" stopColor="black" stopOpacity={0.7} />
              </SvgRadialGradient>
              <ClipPath id="grain-clip">
                <SvgRect x={0} y={0} width={SCREEN_W} height={SCREEN_H} />
              </ClipPath>
            </Defs>

            {/* ── Warm projector radial glow ── */}
            <SvgRect x={0} y={0} width={SCREEN_W} height={SCREEN_H} fill="url(#projector-glow)" />

            {/* ── Film borders (left + right) ── */}
            <SvgRect x={0} y={0} width={BORDER_W} height={SCREEN_H} fill={COLORS.filmBorder} />
            <SvgRect
              x={SCREEN_W - BORDER_W}
              y={0}
              width={BORDER_W}
              height={SCREEN_H}
              fill={COLORS.filmBorder}
            />

            {/* ── Sprocket holes (scroll with animation) ── */}
            {sprocketYOffsets.map((baseY, i) => (
              <SprocketHolePair
                key={`sprocket-${i}`}
                baseY={baseY}
                sprocketScroll={sprocketScroll}
              />
            ))}

            {/* ── Vertical scratches ── */}
            {SCRATCHES.map((s, i) => (
              <SvgLine
                key={`scratch-${i}`}
                x1={s.x}
                y1={0}
                x2={s.x + s.drift}
                y2={SCREEN_H}
                stroke={COLORS.scratchLine}
                strokeWidth={1}
              />
            ))}

            {/* ── Film grain (animated offset = pseudo-random per-frame) ── */}
            <GrainField grainCycle={grainCycle} />

            {/* ── Horizontal scratch flashes ── */}
            {HORIZONTAL_SCRATCHES.map((hs, i) => (
              <HorizontalScratchLine key={`hscratch-${i}`} scratch={hs} grainCycle={grainCycle} />
            ))}

            {/* ── Vignette (dark edges) ── */}
            <SvgRect x={0} y={0} width={SCREEN_W} height={SCREEN_H} fill="url(#vignette-grad)" />
          </Svg>

          {/* Flicker overlay */}
          <Animated.View style={[styles.flickerOverlay, flickerStyle]} />

          {/* Countdown display (RN layer for crisp text) */}
          {phase === 'countdown' && countdownNum > 0 && (
            <View style={styles.countdownContainer}>
              {/* Ring */}
              <View style={styles.countdownRing} />
              {/* Progress sector (simple opacity-based) */}
              <View style={[styles.countdownSector, { opacity: countdownProgress }]} />
              {/* Crosshair marks */}
              <View style={styles.crosshairH} />
              <View style={styles.crosshairV} />
              {/* Number */}
              <Text style={styles.countdownText}>{countdownNum}</Text>
            </View>
          )}
        </Animated.View>

        {/* Flash overlay */}
        <Animated.View
          style={[styles.flash, flashStyle, { backgroundColor: COLORS.projectorWarm }]}
        />
      </Pressable>

      {/* Hint */}
      <HintWithWarning
        hintText={
          phase === 'atmosphere'
            ? '🎬 放映机预热中…'
            : phase === 'idle'
              ? '🎬 点击屏幕开始放映'
              : phase === 'countdown' && countdownNum > 0
                ? '🎬 胶片倒放中…'
                : null
        }
        showWarning={autoTimeoutWarning}
      />

      {/* Revealed card */}
      {(phase === 'countdown' || phase === 'revealed') && countdownNum <= 0 && (
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
  absoluteFillNoEvents: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  flash: { ...StyleSheet.absoluteFillObject, pointerEvents: 'none' },
  flickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(200, 180, 140, 1)',
    pointerEvents: 'none',
  },
  countdownContainer: {
    position: 'absolute',
    top: SCREEN_H / 2 - 80,
    left: SCREEN_W / 2 - 80,
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  countdownRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: 'rgba(200, 180, 140, 0.3)',
  },
  countdownSector: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(200, 180, 140, 0.1)',
  },
  crosshairH: {
    position: 'absolute',
    width: 80,
    height: 1,
    backgroundColor: 'rgba(200, 180, 140, 0.15)',
  },
  crosshairV: {
    position: 'absolute',
    width: 1,
    height: 80,
    backgroundColor: 'rgba(200, 180, 140, 0.15)',
  },
  countdownText: {
    fontSize: 72,
    fontWeight: '700',
    fontFamily: 'Courier New',
    color: 'rgba(220, 200, 160, 0.9)',
    ...crossPlatformTextShadow('rgba(0, 0, 0, 0.6)', 0, 2, 8),
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
