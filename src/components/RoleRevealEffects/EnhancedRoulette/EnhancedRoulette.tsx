/**
 * EnhancedRoulette - Slot machine style role reveal animation
 *
 * Features:
 * - Spinning roulette with flow particles
 * - Haptic feedback on stop
 * - Rhythmic tick sounds
 * - Gradient edge masks
 * - Golden highlight on selection
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions } from 'react-native';
import { useColors, spacing, typography, borderRadius } from '../../../theme';
import type { RoleRevealEffectProps, RoleData } from '../types';
import { ALIGNMENT_THEMES } from '../types';
import { CONFIG } from '../config';
import { canUseNativeDriver, getOptimalParticleCount } from '../utils/platform';
import { playSound, createTickPlayer } from '../utils/sound';
import { triggerHaptic } from '../utils/haptics';
import { GradientOverlay } from '../common/GradientOverlay';
import { GlowBorder } from '../common/GlowBorder';
import { Particle } from '../common/Particle';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface EnhancedRouletteProps extends RoleRevealEffectProps {
  /** All roles to show in the roulette */
  allRoles: RoleData[];
}

interface FlowParticle {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
  size: number;
  duration: number;
  delay: number;
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
  const [showHighlight, setShowHighlight] = useState(false);
  const [flowParticles, setFlowParticles] = useState<FlowParticle[]>([]);
  const [shuffledRoles, setShuffledRoles] = useState<RoleData[]>([]);

  const scrollAnim = useMemo(() => new Animated.Value(0), []);
  const containerWidth = Math.min(SCREEN_WIDTH * 0.85, 320);
  const containerHeight = config.itemHeight * config.visibleItems;

  // Shuffle roles on mount (avoid Math.random during render)
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
  const repeatedRoles = useMemo(() => {
    const repeats = 5;
    const result: RoleData[] = [];
    for (let i = 0; i < repeats; i++) {
      result.push(...shuffledRoles);
    }
    return result;
  }, [shuffledRoles]);

  // Generate flow particles
  const generateFlowParticles = useCallback(() => {
    const count = getOptimalParticleCount(config.particleCount);
    const particles: FlowParticle[] = [];
    const theme = ALIGNMENT_THEMES[role.alignment];

    for (let i = 0; i < count; i++) {
      const side = Math.random() > 0.5 ? -1 : 1;
      particles.push({
        id: `flow-${i}-${Date.now()}`,
        startX: side * (containerWidth / 2 + 20),
        startY: Math.random() * containerHeight,
        endX: side * (containerWidth / 2 - 50),
        endY: Math.random() * containerHeight,
        color: theme.particleColor,
        size: 4 + Math.random() * 4,
        duration: 600 + Math.random() * 400,
        delay: Math.random() * 500,
      });
    }
    return particles;
  }, [role.alignment, containerWidth, containerHeight, config.particleCount]);

  // Tick player for sound
  const tickPlayer = useMemo(
    () => createTickPlayer(enableSound && !reducedMotion),
    [enableSound, reducedMotion]
  );

  // Spin animation
  useEffect(() => {
    if (reducedMotion) {
      // Reduced motion: just fade in the result
      setPhase('revealed');
      setShowHighlight(true);
      const timer = setTimeout(() => {
        onComplete();
      }, CONFIG.common.reducedMotionFadeDuration);
      return () => clearTimeout(timer);
    }

    // Generate initial particles
    setFlowParticles(generateFlowParticles());

    // Start tick sounds
    tickPlayer.start(config.tickIntervalFast);

    // Calculate target position
    const totalSpins = config.spinRotations;
    const targetPosition = totalSpins * shuffledRoles.length + targetIndex;

    // Animate spin
    Animated.timing(scrollAnim, {
      toValue: targetPosition,
      duration: config.spinDuration,
      easing: (t) => {
        // Ease out cubic for slot machine feel
        return 1 - Math.pow(1 - t, 3);
      },
      useNativeDriver: canUseNativeDriver,
    }).start(() => {
      setPhase('stopping');
      tickPlayer.stop();

      // Play confirm sound and haptic
      if (enableSound) {
        playSound('confirm');
      }
      if (enableHaptics) {
        triggerHaptic('medium', true);
      }

      // Show highlight animation
      setShowHighlight(true);
      setPhase('revealed');
    });

    // Gradually slow down tick sounds
    const slowdownTimer = setTimeout(() => {
      tickPlayer.updateInterval(config.tickIntervalSlow);
    }, config.spinDuration * 0.6);

    // Regenerate particles periodically
    const particleInterval = setInterval(() => {
      setFlowParticles(generateFlowParticles());
    }, 800);

    return () => {
      tickPlayer.stop();
      clearTimeout(slowdownTimer);
      clearInterval(particleInterval);
    };
  }, [
    reducedMotion,
    scrollAnim,
    shuffledRoles.length,
    targetIndex,
    generateFlowParticles,
    tickPlayer,
    enableSound,
    enableHaptics,
    onComplete,
    config,
  ]);

  // Handle highlight animation complete
  const handleHighlightComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // Calculate scroll position
  const translateY = scrollAnim.interpolate({
    inputRange: [0, shuffledRoles.length],
    outputRange: [0, -config.itemHeight * shuffledRoles.length],
  });

  // Center offset to show middle item
  const centerOffset = config.itemHeight * Math.floor(config.visibleItems / 2);

  return (
    <View
      testID={`${testIDPrefix}-container`}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Flow particles */}
      {phase === 'spinning' && !reducedMotion && (
        <View style={styles.particleContainer}>
          {flowParticles.map((p) => (
            <Particle
              key={p.id}
              startX={containerWidth / 2 + p.startX}
              startY={p.startY}
              endX={containerWidth / 2 + p.endX}
              endY={p.endY}
              color={p.color}
              size={p.size}
              duration={p.duration}
              delay={p.delay}
              fadeOut
            />
          ))}
        </View>
      )}

      {/* Roulette window */}
      <View
        testID={`${testIDPrefix}-window`}
        style={[
          styles.window,
          {
            width: containerWidth,
            height: containerHeight,
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        {/* Scrolling items */}
        <Animated.View
          style={[
            styles.scrollContainer,
            {
              transform: [{ translateY: Animated.add(translateY, centerOffset) }],
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
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <Text style={styles.itemIcon}>{r.avatar || '❓'}</Text>
                <Text
                  style={[styles.itemName, { color: theme.primaryColor }]}
                  numberOfLines={1}
                >
                  {r.name}
                </Text>
              </View>
            );
          })}
        </Animated.View>

        {/* Gradient masks */}
        <GradientOverlay
          position="top"
          size={config.itemHeight * 0.8}
          color={colors.surface}
        />
        <GradientOverlay
          position="bottom"
          size={config.itemHeight * 0.8}
          color={colors.surface}
        />

        {/* Center indicator lines */}
        <View style={[styles.centerLine, styles.centerLineTop, { backgroundColor: colors.primary }]} />
        <View style={[styles.centerLine, styles.centerLineBottom, { backgroundColor: colors.primary }]} />
      </View>

      {/* Golden glow border on reveal */}
      {showHighlight && (
        <GlowBorder
          width={containerWidth + 8}
          height={containerHeight + 8}
          color="#FFD700"
          glowColor="#FFA500"
          borderWidth={3}
          borderRadius={borderRadius.medium + 4}
          animate={!reducedMotion}
          flashCount={config.highlightFlashCount}
          flashDuration={config.highlightFlashDuration}
          onComplete={handleHighlightComplete}
          style={{
            position: 'absolute',
            top: -4,
            left: (SCREEN_WIDTH - containerWidth) / 2 - 4,
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particleContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  window: {
    borderRadius: borderRadius.medium,
    borderWidth: 2,
    overflow: 'hidden',
  },
  scrollContainer: {
    width: '100%',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.medium,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemIcon: {
    fontSize: 32,
    marginRight: spacing.medium,
  },
  itemName: {
    fontSize: typography.title,
    fontWeight: '600',
    flex: 1,
  },
  centerLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
  },
  centerLineTop: {
    top: '33.33%',
  },
  centerLineBottom: {
    bottom: '33.33%',
  },
});
