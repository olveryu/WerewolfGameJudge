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
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

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
  const [flickerOpacity, setFlickerOpacity] = useState(0);
  const [canvasOpacity, setCanvasOpacity] = useState(1);
  const [cardScale, setCardScale] = useState(0);
  const [cardOpacity, setCardOpacity] = useState(0);
  const [flashOpacity, setFlashOpacity] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const flickerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const schedule = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay);
    timersRef.current.push(id);
    return id;
  }, []);

  // ── Phase transitions ──
  const enterRevealed = useCallback(() => setPhase('revealed'), []);

  const doReveal = useCallback(() => {
    setPhase('countdown'); // keep phase for hint text momentarily

    if (enableHaptics) void triggerHaptic('heavy', true);

    // Flash sequence
    setFlashOpacity(0.7);
    schedule(() => setFlashOpacity(0), 100);

    // Fade canvas
    schedule(() => setCanvasOpacity(0), 200);

    // Card reveal
    schedule(() => {
      setCardScale(1);
      setCardOpacity(1);
      schedule(enterRevealed, FR.cardRevealDuration);
    }, FR.cardRevealDelay);
  }, [enableHaptics, enterRevealed, schedule]);

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
      setCardScale(1);
      setCardOpacity(1);
      setCanvasOpacity(0);
      setPhase('revealed');
      return;
    }

    // Random flicker via interval
    let on = false;
    flickerIntervalRef.current = setInterval(
      () => {
        if (on) {
          setFlickerOpacity(0);
          on = false;
        } else {
          setFlickerOpacity(Math.random() > 0.5 ? 0.08 : 0.04);
          on = true;
        }
      },
      150 + Math.random() * 300,
    );

    // Atmosphere → idle
    const timer = setTimeout(() => {
      setPhase('idle');
    }, FR.atmosphereDuration);

    const timers = timersRef.current;
    const flickerInterval = flickerIntervalRef.current;
    const countdownInterval = countdownIntervalRef.current;
    return () => {
      clearTimeout(timer);
      timers.forEach(clearTimeout);
      if (flickerInterval) clearInterval(flickerInterval);
      if (countdownInterval) clearInterval(countdownInterval);
    };
  }, [reducedMotion]);

  // ── Auto-timeout ──
  const autoTimeoutWarning = useAutoTimeout(phase === 'idle', startCountdown);

  // ── Tap handler ──
  const handlePress = useCallback(() => {
    if (phase === 'idle') startCountdown();
  }, [phase, startCountdown]);

  // ── Computed styles with CSS transitions ──
  const canvasContainerStyle = {
    opacity: canvasOpacity,
    transitionProperty: 'opacity',
    transitionDuration: '400ms',
    transitionTimingFunction: 'ease-out',
  };

  const cardStyle = {
    transform: [{ scale: cardScale }],
    opacity: cardOpacity,
    transitionProperty: 'opacity, transform',
    transitionDuration: `${FR.cardRevealDuration}ms`,
    transitionTimingFunction: 'cubic-bezier(0.34, 1.3, 0.64, 1)',
  };

  const flashStyle = {
    opacity: flashOpacity,
    transitionProperty: 'opacity',
    transitionDuration: '100ms',
    transitionTimingFunction: 'ease-out',
  };

  const flickerStyle = {
    opacity: flickerOpacity,
    transitionProperty: 'opacity',
    transitionDuration: '100ms',
  };

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
        <View style={[StyleSheet.absoluteFill, canvasContainerStyle]}>
          <FilmOverlayCanvas
            dom={{
              style: {
                position: 'absolute',
                top: 0,
                left: 0,
                width: screenW,
                height: screenH,
                pointerEvents: 'none',
              },
            }}
            width={screenW}
            height={screenH}
            animate={!reducedMotion && phase !== 'revealed'}
          />

          {/* Flicker overlay */}
          <View style={[styles.flickerOverlay, flickerStyle]} />

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
        </View>

        {/* Flash overlay */}
        <View style={[styles.flash, flashStyle, { backgroundColor: COLORS.projectorWarm }]} />
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
        <View style={[styles.cardWrapper, cardStyle]}>
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
        </View>
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
