/**
 * EnhancedRoulette - 老虎机风格角色揭示动画（Reanimated 4）
 *
 * 特点：金属框架、霓虹灯、转轮滚动、弹跳停止、庆祝粒子。
 * 使用 `useSharedValue` + `withTiming`/`withSpring`/`withSequence` 驱动，
 * 无 `setTimeout`（通过 `runOnJS` 回调驱动阶段切换）。
 *
 * ✅ 允许：渲染动画 + 触觉反馈
 * ❌ 禁止：import service / 业务逻辑判断
 */
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { GlowBorder } from '@/components/RoleRevealEffects/common/GlowBorder';
import { RoleCardContent } from '@/components/RoleRevealEffects/common/RoleCardContent';
import { CONFIG } from '@/components/RoleRevealEffects/config';
import type { RoleData, RoleRevealEffectProps } from '@/components/RoleRevealEffects/types';
import { ALIGNMENT_THEMES } from '@/components/RoleRevealEffects/types';
import { triggerHaptic } from '@/components/RoleRevealEffects/utils/haptics';
import type { RoleId } from '@/models/roles';
import { borderRadius, shadows, spacing, typography, useColors } from '@/theme';
import { shuffleArray } from '@/utils/shuffle';

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
};

const CELEBRATION_EMOJIS = ['⭐', '✨', '🎉', '🎊', '💫', '🌟'];
const TOP_BULB_IDS = ['t1', 't2', 't3', 't4', 't5', 't6'] as const;
const BOTTOM_BULB_IDS = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'] as const;

// ─── Decorative bulb ────────────────────────────────────────────────────
const Bulb: React.FC<{ on: boolean; color?: string; size?: number }> = ({
  on,
  color = SLOT_COLORS.bulbOn,
  size = 8,
}) => (
  <View
    style={[
      styles.bulb,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: on ? color : SLOT_COLORS.bulbOff,
        shadowColor: on ? color : 'transparent',
        shadowOpacity: on ? 0.8 : 0,
        shadowRadius: size / 2,
        shadowOffset: { width: 0, height: 0 },
      },
    ]}
  />
);

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

    return (
      <Animated.Text style={[styles.particle, animStyle]}>{emoji}</Animated.Text>
    );
  },
);
EmojiParticle.displayName = 'EmojiParticle';

// ─── Bulb pattern helpers ───────────────────────────────────────────────
const BULB_COUNT = 12;
const generateRandomBulbPattern = (threshold = 0.5): boolean[] =>
  new Array(BULB_COUNT).fill(false).map(() => Math.random() > threshold);

// ─── Props ──────────────────────────────────────────────────────────────
export interface EnhancedRouletteProps extends RoleRevealEffectProps {
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
  const { width: screenWidth } = useWindowDimensions();
  const config = CONFIG.roulette;

  const [phase, setPhase] = useState<'spinning' | 'stopping' | 'revealed'>('spinning');
  const [shuffledRoles, setShuffledRoles] = useState<RoleData[]>([]);
  const [bulbPattern, setBulbPattern] = useState<boolean[]>([]);
  const [particles, setParticles] = useState<EmojiParticleConfig[]>([]);

  // ── Shared values ──
  const scrollAnim = useSharedValue(0);
  const bounceAnim = useSharedValue(0);
  const frameGlowAnim = useSharedValue(0);
  const revealScaleAnim = useSharedValue(0.8);
  const revealOpacityAnim = useSharedValue(0);
  const cabinetOpacityAnim = useSharedValue(1);

  const containerWidth = Math.min(screenWidth * 0.9, 340);
  const containerHeight = config.itemHeight * config.visibleItems;
  const frameWidth = containerWidth + 40;
  const frameHeight = containerHeight + 100;
  const common = CONFIG.common;
  const cardWidth = Math.min(screenWidth * common.cardWidthRatio, common.cardMaxWidth);
  const cardHeight = cardWidth * common.cardAspectRatio;
  const theme = ALIGNMENT_THEMES[role.alignment];
  const centeringOffset = config.itemHeight;

  // ── Bulb pattern init ──
  useEffect(() => {
    setBulbPattern(generateRandomBulbPattern());
  }, []);

  // ── Bulb animation during spinning ──
  useEffect(() => {
    if (phase !== 'spinning' || reducedMotion) return;
    const interval = setInterval(() => {
      setBulbPattern(generateRandomBulbPattern(0.3));
    }, 150);
    return () => clearInterval(interval);
  }, [phase, reducedMotion]);

  // ── Frame glow pulsing ──
  useEffect(() => {
    if (reducedMotion) return;
    frameGlowAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [frameGlowAnim, reducedMotion]);

  // ── Shuffle roles on mount ──
  useEffect(() => {
    const unique = [...new Set(allRoles.map((r) => r.id))];
    const roles = unique.map((id) => allRoles.find((r) => r.id === id)!);
    if (!roles.some((r) => r.id === role.id)) {
      roles.push(role);
    }
    setShuffledRoles(shuffleArray(roles));
  }, [allRoles, role]);

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
    revealScaleAnim.value = withSpring(1, { damping: 20, stiffness: 300 });
    revealOpacityAnim.value = withTiming(1, { duration: 300 });
  }, [cabinetOpacityAnim, revealScaleAnim, revealOpacityAnim]);

  // ── After bounce completes ──
  const afterBounce = useCallback(() => {
    if (enableHaptics) triggerHaptic('heavy', true);
    setBulbPattern(new Array(BULB_COUNT).fill(true));
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

  // ── Spin animation ──
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

    const targetPosition =
      config.spinRotations * shuffledRoles.length + targetIndex;

    // Main spin
    scrollAnim.value = withTiming(
      targetPosition,
      { duration: config.spinDuration, easing: Easing.out(Easing.cubic) },
      (finished) => {
        'worklet';
        if (!finished) return;

        runOnJS(setPhase)('stopping');

        // Bounce
        bounceAnim.value = withSequence(
          withTiming(-15, { duration: 100, easing: Easing.out(Easing.cubic) }),
          withSpring(0, { damping: 15, stiffness: 300 }, (fin2) => {
            'worklet';
            if (fin2) runOnJS(afterBounce)();
          }),
        );
      },
    );
  }, [
    reducedMotion,
    cabinetOpacityAnim,
    scrollAnim,
    bounceAnim,
    shuffledRoles.length,
    targetIndex,
    config,
    afterBounce,
    transitionToRevealed,
    revealScaleAnim,
    revealOpacityAnim,
    onComplete,
  ]);

  // ── Reveal complete handler ──
  const handleRevealComplete = useCallback(() => {
    const timer = setTimeout(onComplete, config.revealHoldDuration ?? 1500);
    return () => clearTimeout(timer);
  }, [onComplete, config.revealHoldDuration]);

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

  // ── Loading state ──
  if (shuffledRoles.length === 0) {
    return (
      <View
        testID={`${testIDPrefix}-container`}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.text }]}>准备中...</Text>
        </View>
      </View>
    );
  }

  return (
    <View
      testID={`${testIDPrefix}-container`}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Slot machine cabinet - fades out on reveal */}
      <Animated.View style={[styles.cabinet, { width: frameWidth, height: frameHeight }, cabinetFadeStyle]}>
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
                <Bulb
                  key={id}
                  on={bulbPattern[i] ?? false}
                  color={
                    i % 2 === 0 ? SLOT_COLORS.neonPink : SLOT_COLORS.neonBlue
                  }
                />
              ))}
            </View>
          </View>

          {/* Neon glow */}
          <Animated.View
            style={[
              styles.neonBorder,
              { shadowColor: SLOT_COLORS.neonPink },
              frameGlowStyle,
            ]}
          />

          {/* Inner frame */}
          <View
            style={[
              styles.innerFrame,
              { backgroundColor: SLOT_COLORS.frameInner },
            ]}
          >
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
                  const itemTheme = ALIGNMENT_THEMES[r.alignment];
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
                        style={[
                          styles.itemCard,
                          { borderColor: SLOT_COLORS.itemCardBorder },
                        ]}
                      >
                        <Text style={styles.itemIcon}>{r.avatar || '❓'}</Text>
                        <Text
                          style={[
                            styles.itemName,
                            { color: itemTheme.primaryColor },
                          ]}
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
              <View
                style={[
                  styles.selectionIndicator,
                  styles.selectionIndicatorLeft,
                ]}
              >
                <Text style={styles.indicatorArrow}>▶</Text>
              </View>
              <View
                style={[
                  styles.selectionIndicator,
                  styles.selectionIndicatorRight,
                ]}
              >
                <Text style={styles.indicatorArrow}>◀</Text>
              </View>

              {/* Center highlight */}
              <View
                style={[
                  styles.centerHighlight,
                  { backgroundColor: SLOT_COLORS.gold },
                ]}
              />
            </View>
          </View>

          {/* Bottom panel */}
          <View style={styles.bottomPanel}>
            <View style={styles.bulbRow}>
              {BOTTOM_BULB_IDS.map((id, i) => (
                <Bulb
                  key={id}
                  on={bulbPattern[6 + i] ?? false}
                  color={
                    i % 2 === 0 ? SLOT_COLORS.neonGreen : SLOT_COLORS.gold
                  }
                />
              ))}
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Revealed card - cross-fades in */}
      <Animated.View
        style={[styles.revealedOverlay, revealedCardStyle]}
        pointerEvents={phase === 'revealed' ? 'auto' : 'none'}
      >
        <Animated.View
          style={[
            styles.revealedCardContainer,
            { width: cardWidth, height: cardHeight },
          ]}
        >
          <RoleCardContent
            roleId={role.id as RoleId}
            width={cardWidth}
            height={cardHeight}
          />
          {phase === 'revealed' && (
            <GlowBorder
              width={cardWidth + common.glowPadding}
              height={cardHeight + common.glowPadding}
              color={theme.primaryColor}
              glowColor={theme.glowColor}
              borderWidth={common.glowBorderWidth}
              borderRadius={borderRadius.medium + 4}
              animate={!reducedMotion}
              flashCount={common.glowFlashCount}
              flashDuration={common.glowFlashDuration}
              onComplete={handleRevealComplete}
              style={{ position: 'absolute', top: -4, left: -4 }}
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
    textShadowColor: SLOT_COLORS.goldDark,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
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
    shadowColor: shadows.md.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  itemIcon: {
    fontSize: 36,
    marginRight: spacing.medium,
  },
  itemName: {
    fontSize: typography.title,
    fontWeight: '700',
    flex: 1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
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
    textShadowColor: SLOT_COLORS.goldDark,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
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
  },
  particleContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  particle: {
    position: 'absolute',
    fontSize: 24,
  },
});
