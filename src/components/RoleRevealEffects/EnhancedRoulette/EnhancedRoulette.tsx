/**
 * EnhancedRoulette - Fancy Slot Machine style role reveal animation
 *
 * Features:
 * - Realistic slot machine cabinet with metallic frame
 * - Neon lights and decorative bulbs
 * - 3D-style spinning reels with item cards
 * - Bounce effect on stop
 * - Celebration particles on reveal
 * - Golden highlight animation
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors, spacing, typography, borderRadius } from '../../../theme';
import type { RoleRevealEffectProps, RoleData } from '../types';
import { ALIGNMENT_THEMES } from '../types';
import { CONFIG } from '../config';
import { canUseNativeDriver } from '../utils/platform';
import { playSound, createTickPlayer } from '../utils/sound';
import { triggerHaptic } from '../utils/haptics';
import { GlowBorder } from '../common/GlowBorder';
import { RoleCardContent } from '../common/RoleCardContent';
import type { RoleId } from '../../../models/roles/spec/specs';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Slot machine colors
const SLOT_COLORS = {
  frameOuter: '#2D2D2D',
  frameInner: '#1A1A1A',
  metalGradient: ['#4A4A4A', '#2D2D2D', '#1A1A1A', '#2D2D2D', '#4A4A4A'] as const,
  gold: '#FFD700',
  goldDark: '#B8860B',
  neonPink: '#FF1493',
  neonBlue: '#00BFFF',
  neonGreen: '#39FF14',
  bulbOn: '#FFE566',
  bulbOff: '#666666',
  reelBg: '#FFFFFF',
  itemCard: '#F5F5F5',
  itemCardBorder: '#E0E0E0',
};

// Decorative bulb component
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

// Celebration particle
interface Particle {
  id: number;
  x: Animated.Value;
  y: Animated.Value;
  scale: Animated.Value;
  opacity: Animated.Value;
  rotation: Animated.Value;
  emoji: string;
}

const CELEBRATION_EMOJIS = ['⭐', '✨', '🎉', '🎊', '💫', '🌟'];

// Fixed bulb identifiers (stable keys for decoration)
const TOP_BULB_IDS = ['t1', 't2', 't3', 't4', 't5', 't6'] as const;
const BOTTOM_BULB_IDS = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'] as const;

// Bulb pattern helper
const generateRandomBulbPattern = (count: number, threshold: number = 0.5): boolean[] =>
  new Array(count).fill(false).map(() => Math.random() > threshold);

export interface EnhancedRouletteProps extends RoleRevealEffectProps {
  /** All roles to show in the roulette */
  allRoles: RoleData[];
}

export const EnhancedRoulette: React.FC<EnhancedRouletteProps> = ({
  role,
  allRoles,
  onComplete,
  reducedMotion = false,
  enableSound = true,
  enableHaptics = true,
  testIDPrefix = 'enhanced-roulette',
}) => {
  const colors = useColors();
  const config = CONFIG.roulette;

  const [phase, setPhase] = useState<'spinning' | 'stopping' | 'revealed'>('spinning');
  const [shuffledRoles, setShuffledRoles] = useState<RoleData[]>([]);
  const [bulbPattern, setBulbPattern] = useState<boolean[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);

  const scrollAnim = useMemo(() => new Animated.Value(0), []);
  const bounceAnim = useMemo(() => new Animated.Value(0), []);
  const frameGlowAnim = useMemo(() => new Animated.Value(0), []);
  const revealScaleAnim = useMemo(() => new Animated.Value(0.8), []);
  const revealOpacityAnim = useMemo(() => new Animated.Value(0), []);

  const containerWidth = Math.min(SCREEN_WIDTH * 0.9, 340);
  const containerHeight = config.itemHeight * config.visibleItems;
  const frameWidth = containerWidth + 40;
  const frameHeight = containerHeight + 100;

  // Number of decorative bulbs
  const bulbCount = 12;

  // Initialize bulb pattern
  useEffect(() => {
    setBulbPattern(generateRandomBulbPattern(bulbCount));
  }, []);

  // Animate bulbs during spinning
  useEffect(() => {
    if (phase !== 'spinning' || reducedMotion) return;

    const interval = setInterval(() => {
      setBulbPattern(generateRandomBulbPattern(bulbCount, 0.3));
    }, 150);

    return () => clearInterval(interval);
  }, [phase, reducedMotion]);

  // Frame glow animation
  useEffect(() => {
    if (reducedMotion) return;

    Animated.loop(
      Animated.sequence([
        Animated.timing(frameGlowAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(frameGlowAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: canUseNativeDriver,
        }),
      ]),
    ).start();
  }, [frameGlowAnim, reducedMotion]);

  // Shuffle roles on mount
  useEffect(() => {
    const unique = [...new Set(allRoles.map((r) => r.id))];
    const roles = unique.map((id) => allRoles.find((r) => r.id === id)!);
    if (!roles.some((r) => r.id === role.id)) {
      roles.push(role);
    }
    // Fisher-Yates shuffle
    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }
    setShuffledRoles(roles);
  }, [allRoles, role]);

  // Target index in the shuffled array
  const targetIndex = useMemo(() => {
    return shuffledRoles.findIndex((r) => r.id === role.id);
  }, [shuffledRoles, role]);

  // Create repeated list for smooth scrolling
  // Need enough items for all spins plus buffer
  const repeatedRoles = useMemo(() => {
    const repeats = config.spinRotations + 2; // Extra buffer for safety
    const result: RoleData[] = [];
    for (let i = 0; i < repeats; i++) {
      result.push(...shuffledRoles);
    }
    return result;
  }, [shuffledRoles, config.spinRotations]);

  // Tick player for sound
  const tickPlayer = useMemo(
    () => createTickPlayer(enableSound && !reducedMotion),
    [enableSound, reducedMotion],
  );

  // Create celebration particles
  const createParticles = useCallback(() => {
    const newParticles: Particle[] = [];
    const count = 20;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const distance = 100 + Math.random() * 100;
      const targetX = Math.cos(angle) * distance;
      const targetY = Math.sin(angle) * distance - 50;

      newParticles.push({
        id: i,
        x: new Animated.Value(0),
        y: new Animated.Value(0),
        scale: new Animated.Value(0),
        opacity: new Animated.Value(1),
        rotation: new Animated.Value(0),
        emoji: CELEBRATION_EMOJIS[i % CELEBRATION_EMOJIS.length],
      });

      // Animate particle
      Animated.parallel([
        Animated.timing(newParticles[i].x, {
          toValue: targetX,
          duration: 800 + Math.random() * 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(newParticles[i].y, {
          toValue: targetY,
          duration: 800 + Math.random() * 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.sequence([
          Animated.timing(newParticles[i].scale, {
            toValue: 1,
            duration: 200,
            useNativeDriver: canUseNativeDriver,
          }),
          Animated.timing(newParticles[i].scale, {
            toValue: 0,
            duration: 600,
            delay: 200,
            useNativeDriver: canUseNativeDriver,
          }),
        ]),
        Animated.timing(newParticles[i].opacity, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(newParticles[i].rotation, {
          toValue: Math.random() * 4 - 2,
          duration: 1000,
          useNativeDriver: canUseNativeDriver,
        }),
      ]).start();
    }

    setParticles(newParticles);
  }, []);

  // Transition to revealed phase
  const transitionToRevealed = useCallback(() => {
    setPhase('revealed');
    Animated.parallel([
      Animated.spring(revealScaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 100,
        useNativeDriver: canUseNativeDriver,
      }),
      Animated.timing(revealOpacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: canUseNativeDriver,
      }),
    ]).start();
  }, [revealScaleAnim, revealOpacityAnim]);

  // Spin animation
  useEffect(() => {
    if (shuffledRoles.length === 0 || targetIndex < 0) {
      return;
    }

    if (reducedMotion) {
      setPhase('revealed');
      Animated.parallel([
        Animated.timing(revealScaleAnim, {
          toValue: 1,
          duration: CONFIG.common.reducedMotionFadeDuration,
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(revealOpacityAnim, {
          toValue: 1,
          duration: CONFIG.common.reducedMotionFadeDuration,
          useNativeDriver: canUseNativeDriver,
        }),
      ]).start();
      const timer = setTimeout(
        () => {
          onComplete();
        },
        CONFIG.common.reducedMotionFadeDuration + (config.revealHoldDuration ?? 1500),
      );
      return () => clearTimeout(timer);
    }

    // Start tick sounds
    tickPlayer.start(config.tickIntervalFast);

    // Calculate target position
    const totalSpins = config.spinRotations;
    const targetPosition = totalSpins * shuffledRoles.length + targetIndex;

    // Animate spin with bounce at end
    Animated.timing(scrollAnim, {
      toValue: targetPosition,
      duration: config.spinDuration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: canUseNativeDriver,
    }).start(() => {
      setPhase('stopping');
      tickPlayer.stop();

      // Bounce effect
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: -15,
          duration: 100,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.spring(bounceAnim, {
          toValue: 0,
          friction: 4,
          tension: 300,
          useNativeDriver: canUseNativeDriver,
        }),
      ]).start(() => {
        // Play confirm sound and haptic
        if (enableSound) {
          playSound('confirm');
        }
        if (enableHaptics) {
          triggerHaptic('heavy', true);
        }

        // All bulbs on for celebration
        setBulbPattern(new Array(bulbCount).fill(true));

        // Create particles
        createParticles();

        // Transition to revealed after a short delay
        setTimeout(transitionToRevealed, 500);
      });
    });

    // Gradually slow down tick sounds
    const slowdownTimer = setTimeout(() => {
      tickPlayer.updateInterval(config.tickIntervalSlow);
    }, config.spinDuration * 0.6);

    return () => {
      tickPlayer.stop();
      clearTimeout(slowdownTimer);
    };
  }, [
    reducedMotion,
    scrollAnim,
    bounceAnim,
    shuffledRoles.length,
    targetIndex,
    tickPlayer,
    enableSound,
    enableHaptics,
    config,
    createParticles,
    transitionToRevealed,
    revealScaleAnim,
    revealOpacityAnim,
    onComplete,
  ]);

  // Handle reveal complete
  const handleRevealComplete = useCallback(() => {
    const holdDuration = config.revealHoldDuration ?? 1500;
    setTimeout(() => {
      onComplete();
    }, holdDuration);
  }, [onComplete, config.revealHoldDuration]);

  // Calculate scroll position
  // When scrollAnim = N, item N should be at the center of the window
  // With visibleItems=3, center position is at index 1 (0-indexed)
  // So we offset by 1 item height to center item 0 initially
  const centeringOffset = config.itemHeight; // One item height to center first item

  const translateY = Animated.add(
    scrollAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [centeringOffset, centeringOffset - config.itemHeight],
    }),
    bounceAnim,
  );

  // Card dimensions for revealed state
  const cardWidth = Math.min(SCREEN_WIDTH * 0.85, 320);
  const cardHeight = cardWidth * 1.4;

  // Frame glow opacity
  const frameGlowOpacity = frameGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  // Wait for shuffledRoles to be ready
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

  // Revealed phase - show RoleCardContent
  if (phase === 'revealed') {
    return (
      <View
        testID={`${testIDPrefix}-container`}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        {/* Celebration particles */}
        <View style={styles.particleContainer}>
          {particles.map((p) => (
            <Animated.Text
              key={p.id}
              style={[
                styles.particle,
                {
                  transform: [
                    { translateX: p.x },
                    { translateY: p.y },
                    { scale: p.scale },
                    {
                      rotate: p.rotation.interpolate({
                        inputRange: [-2, 2],
                        outputRange: ['-360deg', '360deg'],
                      }),
                    },
                  ],
                  opacity: p.opacity,
                },
              ]}
            >
              {p.emoji}
            </Animated.Text>
          ))}
        </View>

        <Animated.View
          style={[
            styles.revealedCardContainer,
            {
              width: cardWidth,
              height: cardHeight,
              transform: [{ scale: revealScaleAnim }],
              opacity: revealOpacityAnim,
            },
          ]}
        >
          <RoleCardContent roleId={role.id as RoleId} width={cardWidth} height={cardHeight} />
          <GlowBorder
            width={cardWidth + 8}
            height={cardHeight + 8}
            color="#FFD700"
            glowColor="#FFA500"
            borderWidth={3}
            borderRadius={borderRadius.medium + 4}
            animate={!reducedMotion}
            flashCount={config.highlightFlashCount}
            flashDuration={config.highlightFlashDuration}
            onComplete={handleRevealComplete}
            style={{
              position: 'absolute',
              top: -4,
              left: -4,
            }}
          />
        </Animated.View>
      </View>
    );
  }

  return (
    <View
      testID={`${testIDPrefix}-container`}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Slot Machine Cabinet */}
      <View style={[styles.cabinet, { width: frameWidth, height: frameHeight }]}>
        {/* Outer metallic frame */}
        <LinearGradient
          colors={[...SLOT_COLORS.metalGradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.outerFrame}
        >
          {/* Decorative corner screws */}
          <View style={[styles.screw, styles.screwTopLeft]} />
          <View style={[styles.screw, styles.screwTopRight]} />
          <View style={[styles.screw, styles.screwBottomLeft]} />
          <View style={[styles.screw, styles.screwBottomRight]} />

          {/* Top decorative panel with bulbs */}
          <View style={styles.topPanel}>
            <Text style={styles.slotTitle}>🎰 JACKPOT 🎰</Text>
            <View style={styles.bulbRow}>
              {TOP_BULB_IDS.map((id, i) => (
                <Bulb
                  key={id}
                  on={bulbPattern[i] ?? false}
                  color={i % 2 === 0 ? SLOT_COLORS.neonPink : SLOT_COLORS.neonBlue}
                />
              ))}
            </View>
          </View>

          {/* Neon glow border */}
          <Animated.View
            style={[
              styles.neonBorder,
              {
                opacity: frameGlowOpacity,
                shadowColor: SLOT_COLORS.neonPink,
              },
            ]}
          />

          {/* Inner frame with reel window */}
          <View style={[styles.innerFrame, { backgroundColor: SLOT_COLORS.frameInner }]}>
            {/* Reel window */}
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
              <Animated.View
                style={[
                  styles.scrollContainer,
                  {
                    transform: [{ translateY: translateY as unknown as number }],
                  },
                ]}
              >
                {repeatedRoles.map((r, index) => {
                  const theme = ALIGNMENT_THEMES[r.alignment];
                  return (
                    <View
                      key={`role-${r.id}-${index}`}
                      style={[
                        styles.item,
                        {
                          height: config.itemHeight,
                        },
                      ]}
                    >
                      {/* Item card with 3D effect */}
                      <LinearGradient
                        colors={[SLOT_COLORS.itemCard, '#FFFFFF', SLOT_COLORS.itemCard]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.itemCard, { borderColor: SLOT_COLORS.itemCardBorder }]}
                      >
                        <Text style={styles.itemIcon}>{r.avatar || '❓'}</Text>
                        <Text
                          style={[styles.itemName, { color: theme.primaryColor }]}
                          numberOfLines={1}
                        >
                          {r.name}
                        </Text>
                      </LinearGradient>
                    </View>
                  );
                })}
              </Animated.View>

              {/* Gradient masks for 3D depth */}
              <LinearGradient
                colors={['rgba(255,255,255,1)', 'rgba(255,255,255,0)']}
                style={[styles.gradientMask, styles.gradientMaskTop]}
              />
              <LinearGradient
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,1)']}
                style={[styles.gradientMask, styles.gradientMaskBottom]}
              />

              {/* Center selection indicators */}
              <View style={[styles.selectionIndicator, styles.selectionIndicatorLeft]}>
                <Text style={styles.indicatorArrow}>▶</Text>
              </View>
              <View style={[styles.selectionIndicator, styles.selectionIndicatorRight]}>
                <Text style={styles.indicatorArrow}>◀</Text>
              </View>

              {/* Center highlight line */}
              <View style={[styles.centerHighlight, { backgroundColor: SLOT_COLORS.gold }]} />
            </View>
          </View>

          {/* Bottom decorative panel with bulbs */}
          <View style={styles.bottomPanel}>
            <View style={styles.bulbRow}>
              {BOTTOM_BULB_IDS.map((id, i) => (
                <Bulb
                  key={id}
                  on={bulbPattern[6 + i] ?? false}
                  color={i % 2 === 0 ? SLOT_COLORS.neonGreen : SLOT_COLORS.gold}
                />
              ))}
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Celebration particles */}
      <View style={styles.particleContainer}>
        {particles.map((p) => (
          <Animated.Text
            key={p.id}
            style={[
              styles.particle,
              {
                transform: [
                  { translateX: p.x },
                  { translateY: p.y },
                  { scale: p.scale },
                  {
                    rotate: p.rotation.interpolate({
                      inputRange: [-2, 2],
                      outputRange: ['-360deg', '360deg'],
                    }),
                  },
                ],
                opacity: p.opacity,
              },
            ]}
          >
            {p.emoji}
          </Animated.Text>
        ))}
      </View>
    </View>
  );
};

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
    // 3D shadow effect - 使用新的 boxShadow 语法
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
    // Inner shadow - 使用新的 boxShadow 语法
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
    // 保留旧语法（RN 类型定义尚未支持 textShadow 复合属性）
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
    backgroundColor: '#555',
    borderWidth: 1,
    borderColor: '#777',
  },
  screwTopLeft: {
    top: 8,
    left: 8,
  },
  screwTopRight: {
    top: 8,
    right: 8,
  },
  screwBottomLeft: {
    bottom: 8,
    left: 8,
  },
  screwBottomRight: {
    bottom: 8,
    right: 8,
  },
  reelWindow: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#333',
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
    // 3D effect
    shadowColor: '#000',
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
  gradientMaskTop: {
    top: 0,
  },
  gradientMaskBottom: {
    bottom: 0,
  },
  selectionIndicator: {
    position: 'absolute',
    top: '50%',
    marginTop: -12,
  },
  selectionIndicatorLeft: {
    left: 4,
  },
  selectionIndicatorRight: {
    right: 4,
  },
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
