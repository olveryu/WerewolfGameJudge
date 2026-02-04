/**
 * FlipReveal - Enhanced 3D card flip reveal animation
 *
 * Features:
 * - Card levitation before flip
 * - Multi-layer shadows for 3D depth
 * - Air pressure ripple during flip
 * - Edge glow during flip
 * - Golden particle explosion on reveal
 * - Bounce effect on landing
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  Dimensions,
  Easing,
} from 'react-native';
import { useColors, borderRadius } from '../../../theme';
import type { RoleRevealEffectProps } from '../types';
import { ALIGNMENT_THEMES } from '../types';
import { CONFIG } from '../config';
import { canUseNativeDriver } from '../utils/platform';
import { triggerHaptic } from '../utils/haptics';
import { RoleCard } from '../common/RoleCard';
import { RoleCardContent } from '../common/RoleCardContent';
import { GlowBorder } from '../common/GlowBorder';
import type { RoleId } from '../../../models/roles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Effect colors
const EFFECT_COLORS = {
  edgeGlow: '#FFD700',
  ripple: 'rgba(255, 215, 0, 0.3)',
  particle: ['#FFD700', '#FFA500', '#FF6347', '#FFFFFF', '#87CEEB'],
};

// Celebration particle
interface Particle {
  id: number;
  x: Animated.Value;
  y: Animated.Value;
  scale: Animated.Value;
  opacity: Animated.Value;
  rotation: Animated.Value;
  color: string;
  size: number;
}

export const FlipReveal: React.FC<RoleRevealEffectProps> = ({
  role,
  onComplete,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'flip-reveal',
}) => {
  const colors = useColors();
  const config = CONFIG.flip;
  const theme = ALIGNMENT_THEMES[role.alignment];

  const [phase, setPhase] = useState<'entry' | 'levitate' | 'flipping' | 'landing' | 'revealed'>('entry');
  const [particles, setParticles] = useState<Particle[]>([]);

  // Animation values
  const entryScale = useMemo(() => new Animated.Value(0.3), []);
  const entryOpacity = useMemo(() => new Animated.Value(0), []);
  const levitateY = useMemo(() => new Animated.Value(0), []);
  const levitateShadow = useMemo(() => new Animated.Value(1), []);
  const flipAnim = useMemo(() => new Animated.Value(0), []);
  const edgeGlowOpacity = useMemo(() => new Animated.Value(0), []);
  const rippleScale = useMemo(() => new Animated.Value(0), []);
  const rippleOpacity = useMemo(() => new Animated.Value(0), []);
  const bounceY = useMemo(() => new Animated.Value(0), []);
  const bounceScale = useMemo(() => new Animated.Value(1), []);

  const cardWidth = Math.min(config.cardWidth, SCREEN_WIDTH * 0.7);
  const cardHeight = cardWidth * (config.cardHeight / config.cardWidth);

  // Create celebration particles
  const createParticles = useCallback(() => {
    const newParticles: Particle[] = [];
    const count = 30;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const distance = 80 + Math.random() * 120;
      const targetX = Math.cos(angle) * distance;
      const targetY = Math.sin(angle) * distance - 30;

      const particle: Particle = {
        id: i,
        x: new Animated.Value(0),
        y: new Animated.Value(0),
        scale: new Animated.Value(0),
        opacity: new Animated.Value(1),
        rotation: new Animated.Value(0),
        color: EFFECT_COLORS.particle[i % EFFECT_COLORS.particle.length],
        size: 8 + (i % 4) * 4,
      };

      newParticles.push(particle);

      // Animate particle
      Animated.parallel([
        Animated.timing(particle.x, {
          toValue: targetX,
          duration: 600 + Math.random() * 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(particle.y, {
          toValue: targetY,
          duration: 600 + Math.random() * 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.sequence([
          Animated.timing(particle.scale, {
            toValue: 1,
            duration: 150,
            useNativeDriver: canUseNativeDriver,
          }),
          Animated.timing(particle.scale, {
            toValue: 0,
            duration: 450,
            delay: 100,
            useNativeDriver: canUseNativeDriver,
          }),
        ]),
        Animated.timing(particle.opacity, {
          toValue: 0,
          duration: 800,
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(particle.rotation, {
          toValue: (Math.random() - 0.5) * 4,
          duration: 800,
          useNativeDriver: canUseNativeDriver,
        }),
      ]).start();
    }

    setParticles(newParticles);
  }, []);

  // Handle phases
  const startLevitation = useCallback(() => {
    setPhase('levitate');

    // Float up with expanding shadow
    Animated.parallel([
      Animated.timing(levitateY, {
        toValue: -30,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: canUseNativeDriver,
      }),
      Animated.timing(levitateShadow, {
        toValue: 2,
        duration: 400,
        useNativeDriver: canUseNativeDriver,
      }),
    ]).start(() => {
      startFlip();
    });
  }, [levitateY, levitateShadow]);

  const startFlip = useCallback(() => {
    setPhase('flipping');

    if (enableHaptics) {
      triggerHaptic('medium', true);
    }

    // Edge glow during flip
    Animated.sequence([
      Animated.timing(edgeGlowOpacity, {
        toValue: 1,
        duration: config.flipDuration * 0.3,
        useNativeDriver: canUseNativeDriver,
      }),
      Animated.timing(edgeGlowOpacity, {
        toValue: 0,
        duration: config.flipDuration * 0.4,
        delay: config.flipDuration * 0.3,
        useNativeDriver: canUseNativeDriver,
      }),
    ]).start();

    // Air ripple effect
    Animated.parallel([
      Animated.timing(rippleScale, {
        toValue: 2,
        duration: config.flipDuration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: canUseNativeDriver,
      }),
      Animated.timing(rippleOpacity, {
        toValue: 0,
        duration: config.flipDuration,
        useNativeDriver: canUseNativeDriver,
      }),
    ]).start();
    rippleOpacity.setValue(0.6);

    // Main flip animation
    Animated.timing(flipAnim, {
      toValue: 1,
      duration: config.flipDuration,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: canUseNativeDriver,
    }).start(() => {
      startLanding();
    });
  }, [flipAnim, edgeGlowOpacity, rippleScale, rippleOpacity, config.flipDuration, enableHaptics]);

  const startLanding = useCallback(() => {
    setPhase('landing');

    if (enableHaptics) {
      triggerHaptic('heavy', true);
    }

    // Create particles
    createParticles();

    // Drop down with bounce
    Animated.parallel([
      Animated.timing(levitateY, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: canUseNativeDriver,
      }),
      Animated.timing(levitateShadow, {
        toValue: 1,
        duration: 200,
        useNativeDriver: canUseNativeDriver,
      }),
    ]).start(() => {
      // Bounce effect
      Animated.sequence([
        Animated.parallel([
          Animated.timing(bounceY, {
            toValue: -15,
            duration: 100,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: canUseNativeDriver,
          }),
          Animated.timing(bounceScale, {
            toValue: 1.05,
            duration: 100,
            useNativeDriver: canUseNativeDriver,
          }),
        ]),
        Animated.parallel([
          Animated.spring(bounceY, {
            toValue: 0,
            friction: 4,
            tension: 200,
            useNativeDriver: canUseNativeDriver,
          }),
          Animated.spring(bounceScale, {
            toValue: 1,
            friction: 4,
            tension: 200,
            useNativeDriver: canUseNativeDriver,
          }),
        ]),
      ]).start(() => {
        setPhase('revealed');
      });
    });
  }, [levitateY, levitateShadow, bounceY, bounceScale, createParticles, enableHaptics]);

  // Handle glow complete
  const handleGlowComplete = useCallback(() => {
    setTimeout(() => {
      onComplete();
    }, config.revealHoldDuration);
  }, [onComplete, config.revealHoldDuration]);

  // Start animation sequence
  useEffect(() => {
    if (reducedMotion) {
      // Reduced motion: simple fade
      flipAnim.setValue(1);
      entryOpacity.setValue(1);
      entryScale.setValue(1);
      setPhase('revealed');
      return;
    }

    // Entry animation
    Animated.parallel([
      Animated.timing(entryOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: canUseNativeDriver,
      }),
      Animated.spring(entryScale, {
        toValue: 1,
        friction: 8,
        tension: 100,
        useNativeDriver: canUseNativeDriver,
      }),
    ]).start(() => {
      // Start levitation after short delay
      setTimeout(startLevitation, 300);
    });
  }, [reducedMotion, flipAnim, entryOpacity, entryScale, startLevitation]);

  // Flip interpolations
  const frontRotateY = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '90deg', '180deg'],
  });

  const backRotateY = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['180deg', '90deg', '0deg'],
  });

  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });

  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });

  // Shadow interpolation
  const shadowOpacity = levitateShadow.interpolate({
    inputRange: [1, 2],
    outputRange: [0.2, 0.4],
  });

  const shadowOffsetY = levitateShadow.interpolate({
    inputRange: [1, 2],
    outputRange: [5, 20],
  });

  // Combined transforms
  const cardTransform = [
    { translateY: Animated.add(levitateY, bounceY) },
    { scale: Animated.multiply(entryScale, bounceScale) },
  ];

  return (
    <View
      testID={`${testIDPrefix}-container`}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Air ripple effect */}
      <Animated.View
        style={[
          styles.ripple,
          {
            width: cardWidth * 1.5,
            height: cardHeight * 1.5,
            borderRadius: borderRadius.large,
            borderColor: EFFECT_COLORS.ripple,
            transform: [{ scale: rippleScale }],
            opacity: rippleOpacity,
          },
        ]}
      />

      {/* Particles */}
      <View style={styles.particleContainer}>
        {particles.map((p) => (
          <Animated.View
            key={p.id}
            style={[
              styles.particle,
              {
                width: p.size,
                height: p.size,
                borderRadius: p.size / 2,
                backgroundColor: p.color,
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
          />
        ))}
      </View>

      {/* Main card container */}
      <Animated.View
        style={[
          styles.cardContainer,
          {
            width: cardWidth,
            height: cardHeight,
            opacity: entryOpacity,
            transform: cardTransform,
          },
        ]}
      >
        {/* Multi-layer shadow */}
        <Animated.View
          style={[
            styles.shadowLayer,
            styles.shadowLayer1,
            {
              width: cardWidth,
              height: cardHeight,
              opacity: shadowOpacity,
              transform: [
                { translateY: shadowOffsetY },
                { scaleX: 0.95 },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.shadowLayer,
            styles.shadowLayer2,
            {
              width: cardWidth * 0.9,
              height: cardHeight * 0.1,
              opacity: Animated.multiply(shadowOpacity, 0.5),
              transform: [
                { translateY: Animated.add(shadowOffsetY, 10) },
              ],
            },
          ]}
        />

        {/* Card back (question mark) */}
        <Animated.View
          style={[
            styles.cardFace,
            {
              width: cardWidth,
              height: cardHeight,
              transform: [{ rotateY: frontRotateY }],
              opacity: frontOpacity,
            },
          ]}
        >
          <RoleCard
            role={role}
            showBack={true}
            width={cardWidth}
            height={cardHeight}
          />
        </Animated.View>

        {/* Card front (role) */}
        <Animated.View
          style={[
            styles.cardFace,
            styles.cardBack,
            {
              width: cardWidth,
              height: cardHeight,
              transform: [{ rotateY: backRotateY }],
              opacity: backOpacity,
            },
          ]}
        >
          <RoleCardContent
            roleId={role.id as RoleId}
            width={cardWidth}
            height={cardHeight}
          />

          {/* Edge glow during flip */}
          <Animated.View
            style={[
              styles.edgeGlow,
              {
                borderColor: EFFECT_COLORS.edgeGlow,
                opacity: edgeGlowOpacity,
                shadowColor: EFFECT_COLORS.edgeGlow,
              },
            ]}
          />
        </Animated.View>

        {/* Glow border on reveal */}
        {phase === 'revealed' && (
          <GlowBorder
            width={cardWidth + 8}
            height={cardHeight + 8}
            color={theme.primaryColor}
            glowColor={theme.glowColor}
            borderWidth={3}
            borderRadius={borderRadius.medium + 4}
            animate={!reducedMotion}
            flashCount={3}
            flashDuration={200}
            onComplete={handleGlowComplete}
            style={{
              position: 'absolute',
              top: -4,
              left: -4,
            }}
          />
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContainer: {
    // perspective handled by transform in React Native
  },
  cardFace: {
    position: 'absolute',
    backfaceVisibility: 'hidden',
  },
  cardBack: {
    // Already positioned absolutely
  },
  shadowLayer: {
    position: 'absolute',
    backgroundColor: '#000',
    borderRadius: borderRadius.medium,
  },
  shadowLayer1: {
    // Primary shadow
  },
  shadowLayer2: {
    // Secondary shadow (smaller, further)
    alignSelf: 'center',
    borderRadius: 50,
  },
  edgeGlow: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderRadius: borderRadius.medium,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
  },
  ripple: {
    position: 'absolute',
    borderWidth: 3,
  },
  particleContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  particle: {
    position: 'absolute',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
});
