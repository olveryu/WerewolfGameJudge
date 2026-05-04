/**
 * FilmRewind - 胶片倒放揭示动画（Skia + Reanimated 4）
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
import {
  Canvas,
  Group,
  Line,
  RadialGradient,
  Rect,
  RoundedRect,
  vec,
} from '@shopify/react-native-skia';
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
import { colors, crossPlatformTextShadow } from '@/theme';

// ─── Visual constants ──────────────────────────────────────────────────
const BG_GRADIENT = ['#0a0906', '#0d0b08', '#0a0906'] as const;

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

function getSprocketCount(screenH: number) {
  return Math.ceil(screenH / SPROCKET_SPACING) + 2;
}

function createScratches(screenW: number) {
  return Array.from({ length: FR.scratchCount }, (_, i) => ({
    x: screenW * (0.25 + ((i * 37 + 13) % 50) / 100),
    drift: (((i * 71 + 29) % 100) / 100) * 5,
  }));
}

function createGrainParticles(screenW: number, screenH: number) {
  const fieldW = screenW * 2;
  const fieldH = screenH * 2;
  return Array.from({ length: FR.grainCount * 2 }, (_, i) => ({
    x: (((i * 73 + 17) % 2000) / 2000) * fieldW,
    y: (((i * 41 + 31) % 2000) / 2000) * fieldH,
    light: i % 2 === 0,
  }));
}

interface HScratchData {
  y: number;
  phase: number;
}

function createHorizontalScratches(screenH: number): HScratchData[] {
  return Array.from({ length: 6 }, (_, i) => ({
    y: screenH * (0.1 + ((i * 43 + 7) % 90) / 100),
    phase: ((i * 67 + 13) % 100) / 100,
  }));
}

// ─── Types ──────────────────────────────────────────────────────────────
type Phase = 'atmosphere' | 'idle' | 'countdown' | 'revealed';
// ─── Sub-components ─────────────────────────────────────────────────────────────

/** Single pair of left+right sprocket holes, scrolling with animation */
interface SprocketHolePairProps {
  baseY: number;
  sprocketScroll: SharedValue<number>;
  screenW: number;
  sprocketCount: number;
}

const SprocketHolePair: React.FC<SprocketHolePairProps> = React.memo(
  ({ baseY, sprocketScroll, screenW, sprocketCount }) => {
    const leftCx = BORDER_W / 2;
    const rightCx = screenW - BORDER_W / 2;
    const yPos = useDerivedValue(() => {
      const scrolled = baseY + sprocketScroll.value;
      return scrolled % (sprocketCount * SPROCKET_SPACING);
    });
    const outerLeftX = useDerivedValue(() => leftCx - SPROCKET_HOLE_W / 2);
    const outerLeftY = useDerivedValue(() => yPos.value - SPROCKET_HOLE_H / 2);
    const innerLeftX = useDerivedValue(() => leftCx - 3);
    const innerLeftY = useDerivedValue(() => yPos.value - 5);
    const outerRightX = useDerivedValue(() => rightCx - SPROCKET_HOLE_W / 2);
    const outerRightY = useDerivedValue(() => yPos.value - SPROCKET_HOLE_H / 2);
    const innerRightX = useDerivedValue(() => rightCx - 3);
    const innerRightY = useDerivedValue(() => yPos.value - 5);

    return (
      <Group>
        <RoundedRect
          x={outerLeftX}
          y={outerLeftY}
          width={SPROCKET_HOLE_W}
          height={SPROCKET_HOLE_H}
          r={2}
          color={COLORS.sprocketOuter}
        />
        <RoundedRect
          x={innerLeftX}
          y={innerLeftY}
          width={6}
          height={10}
          r={1}
          color={COLORS.sprocketInner}
        />
        <RoundedRect
          x={outerRightX}
          y={outerRightY}
          width={SPROCKET_HOLE_W}
          height={SPROCKET_HOLE_H}
          r={2}
          color={COLORS.sprocketOuter}
        />
        <RoundedRect
          x={innerRightX}
          y={innerRightY}
          width={6}
          height={10}
          r={1}
          color={COLORS.sprocketInner}
        />
      </Group>
    );
  },
);
SprocketHolePair.displayName = 'SprocketHolePair';

/** Grain noise field with animated translation for per-frame variety */
interface GrainFieldProps {
  grainCycle: SharedValue<number>;
  particles: { x: number; y: number; light: boolean }[];
  screenW: number;
  screenH: number;
}

const GrainField: React.FC<GrainFieldProps> = React.memo(
  ({ grainCycle, particles, screenW, screenH }) => {
    const shiftX = screenW * 0.73;
    const shiftY = screenH * 0.61;
    const transform = useDerivedValue(() => [
      { translateX: -grainCycle.value * shiftX },
      { translateY: -grainCycle.value * shiftY },
    ]);

    return (
      <Group transform={transform} clip={{ x: 0, y: 0, width: screenW, height: screenH }}>
        {particles.map((g, i) => (
          <Rect
            key={`grain-${i}`}
            x={g.x}
            y={g.y}
            width={1}
            height={1}
            color={g.light ? COLORS.grainLight : COLORS.grainDark}
          />
        ))}
      </Group>
    );
  },
);
GrainField.displayName = 'GrainField';

/** Horizontal scratch that flashes based on grainCycle phase */
interface HorizontalScratchLineProps {
  scratch: HScratchData;
  grainCycle: SharedValue<number>;
  screenW: number;
}

const HorizontalScratchLine: React.FC<HorizontalScratchLineProps> = React.memo(
  ({ scratch, grainCycle, screenW }) => {
    const opacity = useDerivedValue(() => {
      const t = (grainCycle.value + scratch.phase) % 1;
      return t < 0.15 ? 0.08 : 0;
    });

    return (
      <Line
        p1={vec(0, scratch.y)}
        p2={vec(screenW, scratch.y)}
        color={'rgba(200, 180, 140, 0.06)'}
        strokeWidth={1}
        style="stroke"
        opacity={opacity}
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

  const { width: screenW, height: screenH } = useWindowDimensions();
  const sprocketCount = useMemo(() => getSprocketCount(screenH), [screenH]);
  const scratches = useMemo(() => createScratches(screenW), [screenW]);
  const grainParticles = useMemo(() => createGrainParticles(screenW, screenH), [screenW, screenH]);
  const horizontalScratches = useMemo(() => createHorizontalScratches(screenH), [screenH]);

  const common = CONFIG.common;
  const cardWidth = Math.min(screenW * common.cardWidthRatio, common.cardMaxWidth);
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
    () => Array.from({ length: sprocketCount }, (_, i) => i * SPROCKET_SPACING),
    [sprocketCount],
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
          <Canvas style={styles.absoluteFillNoEvents}>
            {/* ── Warm projector radial glow (matches HTML prototype) ── */}
            <Rect x={0} y={0} width={screenW} height={screenH}>
              <RadialGradient
                c={vec(screenW / 2, screenH / 2)}
                r={screenH * 0.7}
                colors={['rgba(60, 50, 30, 0.25)', 'rgba(30, 25, 15, 0.10)', 'transparent']}
                positions={[0, 0.5, 1]}
              />
            </Rect>

            {/* ── Film borders (left + right) ── */}
            <Rect x={0} y={0} width={BORDER_W} height={screenH} color={COLORS.filmBorder} />
            <Rect
              x={screenW - BORDER_W}
              y={0}
              width={BORDER_W}
              height={screenH}
              color={COLORS.filmBorder}
            />

            {/* ── Sprocket holes (scroll with animation) ── */}
            {sprocketYOffsets.map((baseY, i) => (
              <SprocketHolePair
                key={`sprocket-${i}`}
                baseY={baseY}
                sprocketScroll={sprocketScroll}
                screenW={screenW}
                sprocketCount={sprocketCount}
              />
            ))}

            {/* ── Vertical scratches ── */}
            {scratches.map((s, i) => (
              <Line
                key={`scratch-${i}`}
                p1={vec(s.x, 0)}
                p2={vec(s.x + s.drift, screenH)}
                color={COLORS.scratchLine}
                strokeWidth={1}
                style="stroke"
              />
            ))}

            {/* ── Film grain (animated offset = pseudo-random per-frame) ── */}
            <GrainField
              grainCycle={grainCycle}
              particles={grainParticles}
              screenW={screenW}
              screenH={screenH}
            />

            {/* ── Horizontal scratch flashes ── */}
            {horizontalScratches.map((hs, i) => (
              <HorizontalScratchLine
                key={`hscratch-${i}`}
                scratch={hs}
                grainCycle={grainCycle}
                screenW={screenW}
              />
            ))}

            {/* ── Vignette (dark edges — radial gradient) ── */}
            <Rect x={0} y={0} width={screenW} height={screenH}>
              <RadialGradient
                c={vec(screenW / 2, screenH / 2)}
                r={screenH * 0.7}
                colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
                positions={[0, 0.7, 1]}
              />
            </Rect>
          </Canvas>

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
    top: '50%',
    left: '50%',
    marginTop: -80,
    marginLeft: -80,
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
