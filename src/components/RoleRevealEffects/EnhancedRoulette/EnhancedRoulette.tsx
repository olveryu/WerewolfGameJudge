/**
 * EnhancedRoulette - 老虎机风格角色揭示动画（Reanimated 4）
 *
 * 特点：金属框架、霓虹灯、转轮滚动、弹跳停止、庆祝粒子。
 * 使用 `useSharedValue` + `withTiming`/`withSequence` 驱动，
 * 无 `setTimeout`（通过 `runOnJS` 回调驱动阶段切换）。
 * 渲染动画与触觉反馈。不 import service，不含业务逻辑。
 */
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { shuffleArray } from '@werewolf/game-engine/utils/shuffle';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
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
import { HintWithWarning } from '@/components/RoleRevealEffects/common/HintWithWarning';
import { RoleCardContent } from '@/components/RoleRevealEffects/common/RoleCardContent';
import { CONFIG } from '@/components/RoleRevealEffects/config';
import {
  useAutoTimeout,
  useRevealLifecycle,
} from '@/components/RoleRevealEffects/hooks/useRevealLifecycle';
import type { RoleData, RoleRevealEffectProps } from '@/components/RoleRevealEffects/types';
import { createAlignmentThemes } from '@/components/RoleRevealEffects/types';
import { triggerHaptic } from '@/components/RoleRevealEffects/utils/haptics';
import { CELEBRATION_EMOJIS } from '@/config/emojiTokens';
import { crossPlatformTextShadow, spacing, typography, useColors } from '@/theme';

// ─── Visual constants ──────────────────────────────────────────────────
const SLOT_COLORS = {
  frameOuter: '#2D2D2D',
  frameInner: '#1A1A1A',
  metalGradient: ['#4A4A4A', '#2D2D2D', '#1A1A1A', '#2D2D2D', '#4A4A4A'] as const,
  gold: '#FFD700',
  goldDark: '#B8860B',
  glowOrange: '#FFA500',
  neonPink: '#FF1493',
  neonBlue: '#00BFFF',
  neonGreen: '#39FF14',
  bulbOn: '#FFE566',
  bulbOff: '#666666',
  reelBg: '#FFFFFF',
  itemCard: '#F5F5F5',
  itemCardBorder: '#E0E0E0',
  itemCardHighlight: '#FFFFFF',
  screwBg: '#555',
  screwBorder: '#777',
  reelWindowBorder: '#333',
  feltGreen: '#1a5c2e',
  feltDark: '#0f3a1c',
  leverHandle: '#cc3333',
  leverArm: '#888888',
  ledBg: '#111111',
  ledText: '#33ff33',
  jackpotGold: '#FFD700',
  coinGold: '#FFD700',
};

const TOP_BULB_IDS = ['t1', 't2', 't3', 't4', 't5', 't6'] as const;
const BOTTOM_BULB_IDS = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'] as const;

// ─── Decorative bulb (Reanimated, zero JS-thread re-renders) ────────────
/**
 * Self-animating bulb driven by a `useSharedValue` + `withRepeat`.
 * Each instance uses a staggered `delay` to create a pseudo-random flicker
 * pattern entirely on the UI thread — no `setInterval` / `setState`.
 */
const AnimatedBulb: React.FC<{
  phase: 'idle' | 'spinning' | 'stopping' | 'revealed';
  reducedMotion: boolean;
  color?: string;
  size?: number;
  delay: number;
}> = React.memo(({ phase, reducedMotion, color = SLOT_COLORS.bulbOn, size = 8, delay }) => {
  const anim = useSharedValue(0);

  useEffect(() => {
    if (phase === 'spinning' && !reducedMotion) {
      anim.value = withDelay(
        delay,
        withRepeat(
          withSequence(withTiming(1, { duration: 120 }), withTiming(0, { duration: 100 })),
          -1,
        ),
      );
    } else if (phase === 'stopping') {
      anim.value = withTiming(1, { duration: 100 });
    } else {
      anim.value = 0;
    }
  }, [phase, reducedMotion, delay, anim]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: anim.value,
  }));

  return (
    <View
      style={[
        styles.bulb,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: SLOT_COLORS.bulbOff,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.bulbGlow,
          {
            borderRadius: size / 2,
            backgroundColor: color,
            boxShadow: `0 0 ${size / 2}px ${color}`,
          },
          glowStyle,
        ]}
      />
    </View>
  );
});
AnimatedBulb.displayName = 'AnimatedBulb';

// ─── Self-animating emoji particle ──────────────────────────────────────
interface EmojiParticleConfig {
  id: number;
  targetX: number;
  targetY: number;
  emoji: string;
  duration: number;
}

const EmojiParticle: React.FC<EmojiParticleConfig> = React.memo(
  ({ targetX, targetY, emoji, duration }) => {
    const progress = useSharedValue(0);

    useEffect(() => {
      progress.value = withTiming(1, {
        duration,
        easing: Easing.out(Easing.cubic),
      });
    }, [duration, progress]);

    const animStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: progress.value * targetX },
        { translateY: progress.value * targetY },
        { scale: interpolate(progress.value, [0, 0.2, 0.4, 1], [0, 1, 1, 0]) },
      ],
      opacity: interpolate(progress.value, [0, 0.7, 1], [1, 0.5, 0]),
    }));

    return <Animated.Text style={[styles.particle, animStyle]}>{emoji}</Animated.Text>;
  },
);
EmojiParticle.displayName = 'EmojiParticle';

/** Staggered delays (ms) per bulb for pseudo-random flicker (UI-thread only). */
const BULB_DELAYS: readonly number[] = [0, 67, 34, 89, 12, 56, 23, 78, 45, 90, 8, 61];

// ─── Props ──────────────────────────────────────────────────────────────
interface EnhancedRouletteProps extends RoleRevealEffectProps {
  /** All roles to show in the roulette */
  allRoles: RoleData[];
}

// ─── Main component ─────────────────────────────────────────────────────
export const EnhancedRoulette: React.FC<EnhancedRouletteProps> = ({
  role,
  allRoles,
  onComplete,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'enhanced-roulette',
}) => {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const config = CONFIG.roulette;

  const [phase, setPhase] = useState<'idle' | 'spinning' | 'stopping' | 'revealed'>('idle');
  const [credit, setCredit] = useState(1);
  const [shuffledRoles] = useState<RoleData[]>(() => {
    const unique = [...new Set(allRoles.map((r) => r.id))];
    const roles = unique.map((id) => allRoles.find((r) => r.id === id)!);
    if (!roles.some((r) => r.id === role.id)) {
      roles.push(role);
    }
    return shuffleArray(roles);
  });
  const [particles, setParticles] = useState<EmojiParticleConfig[]>([]);

  // ── Shared values ──
  const scrollAnim = useSharedValue(0);
  const bounceAnim = useSharedValue(0);
  const frameGlowAnim = useSharedValue(0);
  const revealScaleAnim = useSharedValue(0.8);
  const revealOpacityAnim = useSharedValue(0);
  const cabinetOpacityAnim = useSharedValue(1);

  // Scene element shared values
  const jackpotOpacity = useSharedValue(0);
  const jackpotScale = useSharedValue(0.5);
  const creditFlicker = useSharedValue(1);
  const pillarOpacity = useSharedValue(0);

  const containerWidth = Math.min(screenWidth * 0.9, 340);
  const containerHeight = config.itemHeight * config.visibleItems;
  const frameWidth = containerWidth + 40;
  const frameHeight = containerHeight + 100;
  const common = CONFIG.common;
  const cardWidth = Math.min(screenWidth * common.cardWidthRatio, common.cardMaxWidth);
  const cardHeight = cardWidth * common.cardAspectRatio;
  const alignmentThemes = useMemo(() => createAlignmentThemes(colors), [colors]);
  const theme = alignmentThemes[role.alignment];
  const centeringOffset = config.itemHeight;

  // ── Frame glow pulsing ──
  useEffect(() => {
    if (reducedMotion) return;
    frameGlowAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
  }, [frameGlowAnim, reducedMotion]);

  const targetIndex = useMemo(
    () => shuffledRoles.findIndex((r) => r.id === role.id),
    [shuffledRoles, role],
  );

  // Repeated list for smooth scrolling
  const repeatedRoles = useMemo(() => {
    const repeats = config.spinRotations + 2;
    const result: RoleData[] = [];
    for (let i = 0; i < repeats; i++) {
      result.push(...shuffledRoles);
    }
    return result;
  }, [shuffledRoles, config.spinRotations]);

  // ── Celebration particles ──
  const createParticles = useCallback(() => {
    const configs: EmojiParticleConfig[] = [];
    const count = 20;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const distance = 100 + Math.random() * 100;
      configs.push({
        id: i,
        targetX: Math.cos(angle) * distance,
        targetY: Math.sin(angle) * distance - 50,
        emoji: CELEBRATION_EMOJIS[i % CELEBRATION_EMOJIS.length],
        duration: 800 + Math.random() * 400,
      });
    }
    setParticles(configs);
  }, []);

  // ── Transition to revealed ──
  const transitionToRevealed = useCallback(() => {
    setPhase('revealed');
    cabinetOpacityAnim.value = withTiming(0, { duration: 300 });
    revealScaleAnim.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
    revealOpacityAnim.value = withTiming(1, { duration: 300 });

    // JACKPOT banner pop-in
    jackpotOpacity.value = withDelay(200, withTiming(1, { duration: 300 }));
    jackpotScale.value = withDelay(
      200,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.back(1.5)) }),
    );

    // Light pillars fade out
    pillarOpacity.value = withTiming(0, { duration: 500 });
  }, [
    cabinetOpacityAnim,
    revealScaleAnim,
    revealOpacityAnim,
    jackpotOpacity,
    jackpotScale,
    pillarOpacity,
  ]);

  // ── After bounce completes ──
  const afterBounce = useCallback(() => {
    if (enableHaptics) triggerHaptic('heavy', true);
    createParticles();

    // Short delay then transition to revealed
    revealScaleAnim.value = withDelay(
      100,
      withTiming(0.8, { duration: 1 }, (finished) => {
        'worklet';
        if (finished) runOnJS(transitionToRevealed)();
      }),
    );
  }, [enableHaptics, createParticles, revealScaleAnim, transitionToRevealed]);

  // ── Start spin ──
  const startSpin = useCallback(() => {
    if (phase !== 'idle') return;

    setPhase('spinning');
    setCredit(0);
    if (enableHaptics) triggerHaptic('medium', true);

    const targetPosition = config.spinRotations * shuffledRoles.length + targetIndex;

    // Credit display flicker during spin
    creditFlicker.value = withRepeat(
      withSequence(withTiming(0.3, { duration: 60 }), withTiming(1, { duration: 60 })),
      Math.floor(config.spinDuration / 120),
    );

    // Main spin
    scrollAnim.value = withTiming(
      targetPosition,
      { duration: config.spinDuration, easing: Easing.out(Easing.cubic) },
      (finished) => {
        'worklet';
        if (!finished) return;

        runOnJS(setPhase)('stopping');

        // Light pillars glow at stop
        pillarOpacity.value = withTiming(0.6, { duration: 200 });

        // Bounce (deterministic timing, no spring oscillation)
        bounceAnim.value = withSequence(
          withTiming(-15, { duration: 100, easing: Easing.out(Easing.cubic) }),
          withTiming(0, { duration: 150, easing: Easing.out(Easing.cubic) }, (fin2) => {
            'worklet';
            if (fin2) runOnJS(afterBounce)();
          }),
        );
      },
    );
  }, [
    phase,
    enableHaptics,
    scrollAnim,
    bounceAnim,
    creditFlicker,
    pillarOpacity,
    shuffledRoles.length,
    targetIndex,
    config,
    afterBounce,
  ]);

  // ── Auto-start spin after brief waiting period ──
  useEffect(() => {
    if (shuffledRoles.length === 0 || targetIndex < 0) return;

    if (reducedMotion) {
      setPhase('revealed');
      cabinetOpacityAnim.value = withTiming(0, {
        duration: CONFIG.common.reducedMotionFadeDuration,
      });
      revealScaleAnim.value = withTiming(1, {
        duration: CONFIG.common.reducedMotionFadeDuration,
      });
      revealOpacityAnim.value = withTiming(1, {
        duration: CONFIG.common.reducedMotionFadeDuration,
      });
      const timer = setTimeout(
        onComplete,
        CONFIG.common.reducedMotionFadeDuration + (config.revealHoldDuration ?? 1500),
      );
      return () => clearTimeout(timer);
    }

    // Wait for user to press SPIN button (or autoTimeout)
  }, [
    reducedMotion,
    cabinetOpacityAnim,
    shuffledRoles.length,
    targetIndex,
    config,
    revealScaleAnim,
    revealOpacityAnim,
    onComplete,
    startSpin,
  ]);

  // ── Auto-timeout (warning + 8s auto-spin) ──
  const autoTimeoutWarning = useAutoTimeout(phase === 'idle' && !reducedMotion, startSpin);

  // ── Reveal complete handler ──
  const { fireComplete } = useRevealLifecycle({
    onComplete,
    revealHoldDurationMs: config.revealHoldDuration,
  });

  // ── Animated styles ──
  const scrollStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollAnim.value,
          [0, 1],
          [centeringOffset, centeringOffset - config.itemHeight],
        ),
      },
      { translateY: bounceAnim.value },
    ],
  }));

  const frameGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(frameGlowAnim.value, [0, 1], [0.3, 0.8]),
  }));

  const cabinetFadeStyle = useAnimatedStyle(() => ({
    opacity: cabinetOpacityAnim.value,
  }));

  const revealedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: revealScaleAnim.value }],
    opacity: revealOpacityAnim.value,
  }));

  const creditStyle = useAnimatedStyle(() => ({
    opacity: creditFlicker.value,
  }));

  const jackpotStyle = useAnimatedStyle(() => ({
    opacity: jackpotOpacity.value,
    transform: [{ scale: jackpotScale.value }],
  }));

  const pillarStyle = useAnimatedStyle(() => ({
    opacity: pillarOpacity.value,
  }));

  // ── Loading state ──
  if (shuffledRoles.length === 0) {
    return (
      <View
        testID={`${testIDPrefix}-container`}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.text }]}>准备中…</Text>
        </View>
      </View>
    );
  }

  return (
    <View
      testID={`${testIDPrefix}-container`}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <AtmosphericBackground color={theme.primaryColor} animate={!reducedMotion} />

      {/* Felt table background */}
      <View style={styles.feltTable} pointerEvents="none">
        <LinearGradient
          colors={[SLOT_COLORS.feltGreen, SLOT_COLORS.feltDark]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>

      {/* Slot machine cabinet - fades out on reveal */}
      <Animated.View
        style={[styles.cabinet, { width: frameWidth, height: frameHeight }, cabinetFadeStyle]}
      >
        <LinearGradient
          colors={[...SLOT_COLORS.metalGradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.outerFrame}
        >
          {/* Corner screws */}
          <View style={[styles.screw, styles.screwTopLeft]} />
          <View style={[styles.screw, styles.screwTopRight]} />
          <View style={[styles.screw, styles.screwBottomLeft]} />
          <View style={[styles.screw, styles.screwBottomRight]} />

          {/* Top panel */}
          <View style={styles.topPanel}>
            <Text style={styles.slotTitle}>🎰 JACKPOT 🎰</Text>
            <View style={styles.bulbRow}>
              {TOP_BULB_IDS.map((id, i) => (
                <AnimatedBulb
                  key={id}
                  phase={phase}
                  reducedMotion={reducedMotion}
                  color={i % 2 === 0 ? SLOT_COLORS.neonPink : SLOT_COLORS.neonBlue}
                  delay={BULB_DELAYS[i]}
                />
              ))}
            </View>
          </View>

          {/* Neon glow */}
          <Animated.View style={[styles.neonBorder, frameGlowStyle]} />

          {/* Inner frame */}
          <View style={[styles.innerFrame, { backgroundColor: SLOT_COLORS.frameInner }]}>
            <View
              testID={`${testIDPrefix}-window`}
              style={[
                styles.reelWindow,
                {
                  width: containerWidth,
                  height: containerHeight,
                  backgroundColor: SLOT_COLORS.reelBg,
                },
              ]}
            >
              {/* Scrolling items */}
              <Animated.View style={[styles.scrollContainer, scrollStyle]}>
                {repeatedRoles.map((r, index) => {
                  const itemTheme = alignmentThemes[r.alignment];
                  return (
                    <View
                      key={`role-${r.id}-${index}`}
                      style={[styles.item, { height: config.itemHeight }]}
                    >
                      <LinearGradient
                        colors={[
                          SLOT_COLORS.itemCard,
                          SLOT_COLORS.itemCardHighlight,
                          SLOT_COLORS.itemCard,
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.itemCard, { borderColor: SLOT_COLORS.itemCardBorder }]}
                      >
                        <Text style={styles.itemIcon}>{r.avatar || '❓'}</Text>
                        <Text
                          style={[styles.itemName, { color: itemTheme.primaryColor }]}
                          numberOfLines={1}
                        >
                          {r.name}
                        </Text>
                      </LinearGradient>
                    </View>
                  );
                })}
              </Animated.View>

              {/* Gradient masks */}
              <LinearGradient
                colors={['rgba(255,255,255,1)', 'rgba(255,255,255,0)']}
                style={[styles.gradientMask, styles.gradientMaskTop]}
              />
              <LinearGradient
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,1)']}
                style={[styles.gradientMask, styles.gradientMaskBottom]}
              />

              {/* Selection indicators */}
              <View style={[styles.selectionIndicator, styles.selectionIndicatorLeft]}>
                <Text style={styles.indicatorArrow}>▶</Text>
              </View>
              <View style={[styles.selectionIndicator, styles.selectionIndicatorRight]}>
                <Text style={styles.indicatorArrow}>◀</Text>
              </View>

              {/* Center highlight */}
              <View style={[styles.centerHighlight, { backgroundColor: SLOT_COLORS.gold }]} />
            </View>
          </View>

          {/* Bottom panel */}
          <View style={styles.bottomPanel}>
            <View style={styles.bulbRow}>
              {BOTTOM_BULB_IDS.map((id, i) => (
                <AnimatedBulb
                  key={id}
                  phase={phase}
                  reducedMotion={reducedMotion}
                  color={i % 2 === 0 ? SLOT_COLORS.neonGreen : SLOT_COLORS.gold}
                  delay={BULB_DELAYS[6 + i]}
                />
              ))}
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* LED credit display — below machine */}
      <Animated.View style={[styles.ledDisplay, creditStyle]} pointerEvents="none">
        <Text style={styles.ledText}>CREDIT: {String(credit).padStart(2, '0')}</Text>
      </Animated.View>

      {/* Light pillars — glow when stopping */}
      {(phase === 'stopping' || phase === 'revealed') && (
        <Animated.View style={[styles.pillarContainer, pillarStyle]} pointerEvents="none">
          <View style={styles.pillarLeft} />
          <View style={styles.pillarRight} />
        </Animated.View>
      )}

      {/* Revealed card - cross-fades in */}
      <Animated.View
        style={[styles.revealedOverlay, revealedCardStyle]}
        pointerEvents={phase === 'revealed' ? 'auto' : 'none'}
      >
        <Animated.View
          style={[styles.revealedCardContainer, { width: cardWidth, height: cardHeight }]}
        >
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

      {/* Celebration particles */}
      <View style={styles.particleContainer}>
        {particles.map((p) => (
          <EmojiParticle key={p.id} {...p} />
        ))}
      </View>

      {/* JACKPOT banner — pops in on reveal */}
      {phase === 'revealed' && (
        <Animated.View
          style={[styles.jackpotBanner, { top: insets.top + 50 }, jackpotStyle]}
          pointerEvents="none"
        >
          <Text style={styles.jackpotText}>🎰 JACKPOT! 🎰</Text>
        </Animated.View>
      )}

      {/* Hint text */}
      <HintWithWarning
        hintText={
          phase === 'idle'
            ? '🎰 点击下方按钮，开始转动'
            : phase === 'spinning'
              ? '🎰 轮盘转动中…'
              : phase === 'stopping'
                ? '🎰 即将揭晓…'
                : null
        }
        showWarning={autoTimeoutWarning}
      />

      {/* SPIN button (idle phase) */}
      {phase === 'idle' && (
        <Pressable onPress={startSpin} style={styles.spinButton} testID={`${testIDPrefix}-spin`}>
          <Text style={styles.spinButtonText}>🎰 SPIN</Text>
        </Pressable>
      )}
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: typography.body,
  },
  cabinet: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerFrame: {
    flex: 1,
    width: '100%',
    borderRadius: 16,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 8px 12px rgba(0, 0, 0, 0.5)',
    elevation: 10,
  },
  neonBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: SLOT_COLORS.neonPink,
    boxShadow: `0px 0px 10px ${SLOT_COLORS.neonPink}`,
  },
  innerFrame: {
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.3)',
  },
  topPanel: {
    alignItems: 'center',
    marginBottom: 8,
  },
  slotTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: SLOT_COLORS.gold,
    ...crossPlatformTextShadow(SLOT_COLORS.goldDark, 1, 1, 2),
    marginBottom: 6,
  },
  bottomPanel: {
    alignItems: 'center',
    marginTop: 8,
  },
  bulbRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '80%',
  },
  bulb: {
    marginHorizontal: 4,
    overflow: 'hidden',
  },
  bulbGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  screw: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: SLOT_COLORS.screwBg,
    borderWidth: 1,
    borderColor: SLOT_COLORS.screwBorder,
  },
  screwTopLeft: { top: 8, left: 8 },
  screwTopRight: { top: 8, right: 8 },
  screwBottomLeft: { bottom: 8, left: 8 },
  screwBottomRight: { bottom: 8, right: 8 },
  reelWindow: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: SLOT_COLORS.reelWindowBorder,
  },
  scrollContainer: {
    width: '100%',
  },
  item: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.small,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    borderRadius: 8,
    borderWidth: 1,
    width: '95%',
    boxShadow: '0px 2px 3px rgba(0,0,0,0.3)',
  },
  itemIcon: {
    fontSize: 36,
    marginRight: spacing.medium,
  },
  itemName: {
    fontSize: typography.title,
    fontWeight: '700',
    flex: 1,
    ...crossPlatformTextShadow('rgba(0,0,0,0.5)', 1, 1, 2),
  },
  gradientMask: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 40,
    pointerEvents: 'none',
  },
  gradientMaskTop: { top: 0 },
  gradientMaskBottom: { bottom: 0 },
  selectionIndicator: {
    position: 'absolute',
    top: '50%',
    marginTop: -12,
  },
  selectionIndicatorLeft: { left: 4 },
  selectionIndicatorRight: { right: 4 },
  indicatorArrow: {
    fontSize: 16,
    color: SLOT_COLORS.gold,
    ...crossPlatformTextShadow(SLOT_COLORS.goldDark, 1, 1, 2),
  },
  centerHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 2,
    marginTop: -1,
    opacity: 0.5,
  },
  revealedOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revealedCardContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  particleContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  hint: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: typography.body,
    fontWeight: '600',
    ...crossPlatformTextShadow('rgba(0, 0, 0, 0.6)', 0, 1, 4),
  },
  spinButton: {
    position: 'absolute',
    bottom: 155,
    alignSelf: 'center',
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: SLOT_COLORS.gold,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: SLOT_COLORS.goldDark,
    boxShadow: `0px 4px 8px rgba(0, 0, 0, 0.4)`,
  },
  spinButtonText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: 2,
  },
  particle: {
    position: 'absolute',
    fontSize: 24,
  },
  glowBorder: {
    position: 'absolute',
    top: -4,
    left: -4,
  },
  feltTable: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  ledDisplay: {
    position: 'absolute',
    bottom: 115,
    backgroundColor: SLOT_COLORS.ledBg,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#333',
  },
  ledText: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    color: SLOT_COLORS.ledText,
    letterSpacing: 2,
  },
  pillarContainer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    pointerEvents: 'none',
  },
  pillarLeft: {
    width: 4,
    height: '60%',
    backgroundColor: SLOT_COLORS.gold,
    opacity: 0.3,
    borderRadius: 2,
    alignSelf: 'center',
  },
  pillarRight: {
    width: 4,
    height: '60%',
    backgroundColor: SLOT_COLORS.gold,
    opacity: 0.3,
    borderRadius: 2,
    alignSelf: 'center',
  },
  jackpotBanner: {
    position: 'absolute',
    alignItems: 'center',
  },
  jackpotText: {
    fontSize: 28,
    fontWeight: '900',
    color: SLOT_COLORS.jackpotGold,
    letterSpacing: 4,
    ...crossPlatformTextShadow(SLOT_COLORS.goldDark, 0, 2, 8),
  },
});
