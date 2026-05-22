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
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

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

import FilmOverlayCanvas from './FilmOverlayCanvas';

// ─── Visual constants ──────────────────────────────────────────────────
const BG_GRADIENT = ['#0a0906', '#0d0b08', '#0a0906'] as const;

const FR = CONFIG.filmRewind;

const COLORS = {
  projectorWarm: 'rgba(200, 180, 140, 0.25)',
} as const;

// ─── Types ──────────────────────────────────────────────────────────────
type Phase = 'atmosphere' | 'idle' | 'countdown' | 'revealed';

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
  const flickerOpacity = useSharedValue(0);
  const canvasOpacity = useSharedValue(1);
  const cardScale = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const flashOpacity = useSharedValue(0);

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
          if (finished) scheduleOnRN(enterRevealed);
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
    flickerOpacity,
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
          <FilmOverlayCanvas
            dom={{ style: { position: 'absolute', top: 0, left: 0, width: screenW, height: screenH, pointerEvents: 'none' } }}
            width={screenW}
            height={screenH}
            animate={!reducedMotion}
          />

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
