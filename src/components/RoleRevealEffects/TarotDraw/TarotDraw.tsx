/**
 * TarotDraw - Tarot card draw reveal animation
 *
 * Features:
 * - Card rises from deck with floating motion
 * - Hovers in mid-air with gentle bobbing
 * - Mysterious aura/glow surrounds the card
 * - Elegant flip to reveal the role
 * - Fate-themed particle effects
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  Dimensions,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors, borderRadius } from '../../../theme';
import type { RoleRevealEffectProps } from '../types';
import { ALIGNMENT_THEMES } from '../types';
import { CONFIG } from '../config';
import { canUseNativeDriver } from '../utils/platform';
import { triggerHaptic } from '../utils/haptics';
import { RoleCardContent } from '../common/RoleCardContent';
import { GlowBorder } from '../common/GlowBorder';
import type { RoleId } from '../../../models/roles';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Mystical colors
const MYSTICAL_COLORS = {
  aura: ['rgba(138, 43, 226, 0.4)', 'rgba(75, 0, 130, 0.2)', 'transparent'],
  stardustGold: '#FFD700',
  stardustSilver: '#C0C0C0',
  stardustPurple: '#9370DB',
  deckShadow: 'rgba(0, 0, 0, 0.6)',
};

// Floating stardust particle
interface StardustParticle {
  id: number;
  x: Animated.Value;
  y: Animated.Value;
  scale: Animated.Value;
  opacity: Animated.Value;
  rotation: Animated.Value;
  color: string;
  size: number;
}

export const TarotDraw: React.FC<RoleRevealEffectProps> = ({
  role,
  onComplete,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'tarot-draw',
}) => {
  const colors = useColors();
  const theme = ALIGNMENT_THEMES[role.alignment];

  const [phase, setPhase] = useState<'deck' | 'rising' | 'hovering' | 'flipping' | 'revealed'>('deck');
  const [stardust, setStardust] = useState<StardustParticle[]>([]);

  // Card dimensions
  const cardWidth = Math.min(280, SCREEN_WIDTH * 0.75);
  const cardHeight = cardWidth * 1.4;

  // Animation values
  const cardY = useMemo(() => new Animated.Value(SCREEN_HEIGHT * 0.4), []); // Start below screen
  const cardX = useMemo(() => new Animated.Value(0), []);
  const cardRotateZ = useMemo(() => new Animated.Value(-5), []); // Slight initial tilt
  const cardScale = useMemo(() => new Animated.Value(0.8), []);
  const cardOpacity = useMemo(() => new Animated.Value(0), []);
  const flipAnim = useMemo(() => new Animated.Value(0), []);
  const auraOpacity = useMemo(() => new Animated.Value(0), []);
  const auraScale = useMemo(() => new Animated.Value(0.8), []);
  const auraPulse = useMemo(() => new Animated.Value(1), []);
  const hoverY = useMemo(() => new Animated.Value(0), []); // For subtle bobbing
  const shadowOpacity = useMemo(() => new Animated.Value(0.3), []);

  // Create stardust particles
  const createStardust = useCallback(() => {
    const particles: StardustParticle[] = [];
    const count = 20;
    const particleColors = [MYSTICAL_COLORS.stardustGold, MYSTICAL_COLORS.stardustSilver, MYSTICAL_COLORS.stardustPurple];

    for (let i = 0; i < count; i++) {
      const startX = (Math.random() - 0.5) * cardWidth * 1.5;
      const startY = (Math.random() - 0.5) * cardHeight * 1.5;
      
      particles.push({
        id: i,
        x: new Animated.Value(startX),
        y: new Animated.Value(startY),
        scale: new Animated.Value(0),
        opacity: new Animated.Value(0),
        rotation: new Animated.Value(0),
        color: particleColors[i % particleColors.length],
        size: 4 + Math.random() * 6,
      });
    }

    setStardust(particles);
    return particles;
  }, [cardWidth, cardHeight]);

  // Animate stardust
  const animateStardust = useCallback((particles: StardustParticle[]) => {
    particles.forEach((particle, index) => {
      const delay = index * 50;
      const duration = 2000 + Math.random() * 1000;

      // Fade in
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(particle.opacity, {
            toValue: 0.8,
            duration: 300,
            useNativeDriver: canUseNativeDriver,
          }),
          Animated.timing(particle.scale, {
            toValue: 1,
            duration: 300,
            useNativeDriver: canUseNativeDriver,
          }),
        ]),
      ]).start();

      // Float upward and rotate
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(particle.y, {
              toValue: (particle.y as unknown as { _value: number })._value - 30,
              duration: duration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: canUseNativeDriver,
            }),
            Animated.timing(particle.y, {
              toValue: (particle.y as unknown as { _value: number })._value,
              duration: duration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: canUseNativeDriver,
            }),
          ]),
          Animated.timing(particle.rotation, {
            toValue: 360,
            duration: duration * 2,
            easing: Easing.linear,
            useNativeDriver: canUseNativeDriver,
          }),
        ])
      ).start();
    });
  }, []);

  // Handle reveal complete
  const handleRevealComplete = useCallback(() => {
    setTimeout(() => {
      onComplete();
    }, CONFIG.flip.revealHoldDuration);
  }, [onComplete]);

  // Main animation sequence
  useEffect(() => {
    if (reducedMotion) {
      cardY.setValue(0);
      cardScale.setValue(1);
      cardOpacity.setValue(1);
      flipAnim.setValue(1);
      setPhase('revealed');
      return;
    }

    const particles = createStardust();

    // Phase 1: Card rises from deck
    const riseAnimation = () => {
      setPhase('rising');
      if (enableHaptics) triggerHaptic('light', true);

      Animated.parallel([
        // Card moves up
        Animated.timing(cardY, {
          toValue: 0,
          duration: 1200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: canUseNativeDriver,
        }),
        // Card becomes visible
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: canUseNativeDriver,
        }),
        // Card scales up
        Animated.timing(cardScale, {
          toValue: 1,
          duration: 1200,
          easing: Easing.out(Easing.back(1.1)),
          useNativeDriver: canUseNativeDriver,
        }),
        // Card straightens
        Animated.timing(cardRotateZ, {
          toValue: 0,
          duration: 1000,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: canUseNativeDriver,
        }),
        // Shadow grows
        Animated.timing(shadowOpacity, {
          toValue: 0.5,
          duration: 1200,
          useNativeDriver: canUseNativeDriver,
        }),
      ]).start(hoverAnimation);
    };

    // Phase 2: Card hovers with aura
    const hoverAnimation = () => {
      setPhase('hovering');
      animateStardust(particles);

      // Show aura
      Animated.parallel([
        Animated.timing(auraOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(auraScale, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: canUseNativeDriver,
        }),
      ]).start();

      // Subtle hover bobbing
      Animated.loop(
        Animated.sequence([
          Animated.timing(hoverY, {
            toValue: -8,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: canUseNativeDriver,
          }),
          Animated.timing(hoverY, {
            toValue: 8,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: canUseNativeDriver,
          }),
        ])
      ).start();

      // Aura pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(auraPulse, {
            toValue: 1.1,
            duration: 1000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: canUseNativeDriver,
          }),
          Animated.timing(auraPulse, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: canUseNativeDriver,
          }),
        ])
      ).start();

      // After hovering, flip
      setTimeout(flipAnimation, 1500);
    };

    // Phase 3: Elegant flip
    const flipAnimation = () => {
      setPhase('flipping');
      if (enableHaptics) triggerHaptic('medium', true);

      // Intensify aura during flip
      Animated.timing(auraScale, {
        toValue: 1.3,
        duration: 400,
        useNativeDriver: canUseNativeDriver,
      }).start();

      Animated.timing(flipAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: canUseNativeDriver,
      }).start(() => {
        if (enableHaptics) triggerHaptic('heavy', true);
        setPhase('revealed');
        
        // Fade out stardust
        particles.forEach((p) => {
          Animated.timing(p.opacity, {
            toValue: 0,
            duration: 500,
            useNativeDriver: canUseNativeDriver,
          }).start();
        });
      });
    };

    // Start sequence
    setTimeout(riseAnimation, 300);
  }, [
    reducedMotion,
    enableHaptics,
    cardY,
    cardOpacity,
    cardScale,
    cardRotateZ,
    shadowOpacity,
    auraOpacity,
    auraScale,
    auraPulse,
    hoverY,
    flipAnim,
    createStardust,
    animateStardust,
  ]);

  // Card rotation interpolations
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

  const rotateZ = cardRotateZ.interpolate({
    inputRange: [-10, 0, 10],
    outputRange: ['-10deg', '0deg', '10deg'],
  });

  return (
    <View
      testID={`${testIDPrefix}-container`}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Deck shadow at bottom */}
      <Animated.View
        style={[
          styles.deckShadow,
          {
            width: cardWidth * 0.9,
            height: 20,
            bottom: SCREEN_HEIGHT * 0.1,
            opacity: shadowOpacity,
          },
        ]}
      />

      {/* Mystical aura behind card */}
      <Animated.View
        style={[
          styles.auraContainer,
          {
            width: cardWidth * 1.6,
            height: cardHeight * 1.6,
            opacity: auraOpacity,
            transform: [
              { scale: Animated.multiply(auraScale, auraPulse) },
              { translateY: Animated.add(cardY, hoverY) },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={[theme.glowColor + '60', theme.primaryColor + '30', 'transparent']}
          style={styles.auraGradient}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 0.5, y: 0 }}
        />
      </Animated.View>

      {/* Stardust particles */}
      {stardust.map((particle) => {
        const rotate = particle.rotation.interpolate({
          inputRange: [0, 360],
          outputRange: ['0deg', '360deg'],
        });

        return (
          <Animated.View
            key={particle.id}
            style={[
              styles.stardust,
              {
                width: particle.size,
                height: particle.size,
                borderRadius: particle.size / 2,
                backgroundColor: particle.color,
                shadowColor: particle.color,
                opacity: particle.opacity,
                transform: [
                  { translateX: particle.x },
                  { translateY: Animated.add(Animated.add(cardY, hoverY), particle.y) },
                  { scale: particle.scale },
                  { rotate },
                ],
              },
            ]}
          />
        );
      })}

      {/* Card container */}
      <Animated.View
        style={[
          styles.cardWrapper,
          {
            width: cardWidth,
            height: cardHeight,
            transform: [
              { translateY: Animated.add(cardY, hoverY) },
              { translateX: cardX },
              { rotate: rotateZ },
              { scale: cardScale },
            ],
            opacity: cardOpacity,
          },
        ]}
      >
        {/* Card back (tarot design) */}
        <Animated.View
          style={[
            styles.cardFace,
            {
              width: cardWidth,
              height: cardHeight,
              borderRadius: borderRadius.medium,
              opacity: frontOpacity,
              transform: [{ rotateY: frontRotateY }],
            },
          ]}
        >
          <LinearGradient
            colors={['#1a0533', '#2d1b4e', '#1a0533']}
            style={[styles.cardBack, { borderRadius: borderRadius.medium }]}
          >
            {/* Tarot back design */}
            <View style={styles.tarotPattern}>
              <View style={[styles.tarotBorder, { borderColor: theme.primaryColor }]} />
              <View style={styles.tarotCenter}>
                <View style={[styles.tarotStar, { borderColor: MYSTICAL_COLORS.stardustGold }]} />
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Card front (role) */}
        <Animated.View
          style={[
            styles.cardFace,
            styles.cardFront,
            {
              width: cardWidth,
              height: cardHeight,
              borderRadius: borderRadius.medium,
              opacity: backOpacity,
              transform: [{ rotateY: backRotateY }],
            },
          ]}
        >
          <RoleCardContent
            roleId={role.id as RoleId}
            width={cardWidth}
            height={cardHeight}
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
            onComplete={handleRevealComplete}
            style={styles.glowBorder}
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
    overflow: 'visible',
  },
  deckShadow: {
    position: 'absolute',
    backgroundColor: MYSTICAL_COLORS.deckShadow,
    borderRadius: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  auraContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  auraGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 1000,
  },
  stardust: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  cardWrapper: {
    position: 'relative',
  },
  cardFace: {
    position: 'absolute',
    backfaceVisibility: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  cardFront: {
    // Front face styles
  },
  cardBack: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tarotPattern: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
  },
  tarotBorder: {
    position: 'absolute',
    top: 15,
    left: 15,
    right: 15,
    bottom: 15,
    borderWidth: 2,
    borderRadius: 8,
  },
  tarotCenter: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tarotStar: {
    width: 60,
    height: 60,
    borderWidth: 2,
    transform: [{ rotate: '45deg' }],
  },
  glowBorder: {
    position: 'absolute',
    top: -4,
    left: -4,
  },
});
