/**
 * FireReveal - Fire burning reveal animation
 *
 * Features:
 * - Card covered by darkness
 * - Fire rises from bottom
 * - Fire "burns away" the cover to reveal the role
 * - Embers float upward
 * - Dramatic heat distortion effect
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Animated, StyleSheet, Dimensions, Easing } from 'react-native';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Fire colors
const FIRE_COLORS = {
  core: '#FFFF00',
  inner: '#FFA500',
  outer: '#FF4500',
  ember: ['#FF6347', '#FF4500', '#FFD700', '#FF8C00'],
  smoke: 'rgba(50, 50, 50, 0.6)',
  darkness: '#0a0a0a',
};

// Ember particle
interface Ember {
  id: number;
  x: Animated.Value;
  y: Animated.Value;
  scale: Animated.Value;
  opacity: Animated.Value;
  color: string;
  size: number;
}

// Fire flame
interface Flame {
  id: number;
  x: number;
  height: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  delay: number;
}

export const FireReveal: React.FC<RoleRevealEffectProps> = ({
  role,
  onComplete,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'fire-reveal',
}) => {
  const colors = useColors();
  const theme = ALIGNMENT_THEMES[role.alignment];

  const [phase, setPhase] = useState<'dark' | 'igniting' | 'burning' | 'revealed'>('dark');
  const [embers, setEmbers] = useState<Ember[]>([]);
  const [flames, setFlames] = useState<Flame[]>([]);

  // Card dimensions
  const cardWidth = Math.min(280, SCREEN_WIDTH * 0.75);
  const cardHeight = cardWidth * 1.4;

  // Animation values
  const darknessOpacity = useMemo(() => new Animated.Value(1), []);
  const burnLine = useMemo(() => new Animated.Value(cardHeight), []); // Burns from bottom to top
  const fireGlow = useMemo(() => new Animated.Value(0), []);
  const cardScale = useMemo(() => new Animated.Value(0.95), []);
  const cardOpacity = useMemo(() => new Animated.Value(0.3), []);
  const heatDistortion = useMemo(() => new Animated.Value(0), []);

  // Create flames
  const createFlames = useCallback(() => {
    const flameCount = 12;
    const newFlames: Flame[] = [];

    for (let i = 0; i < flameCount; i++) {
      const xPos = (i / (flameCount - 1)) * cardWidth - cardWidth / 2;
      newFlames.push({
        id: i,
        x: xPos,
        height: new Animated.Value(0),
        opacity: new Animated.Value(0),
        scale: new Animated.Value(0.5 + Math.random() * 0.5),
        delay: Math.random() * 200,
      });
    }

    setFlames(newFlames);
    return newFlames;
  }, [cardWidth]);

  // Create embers
  const createEmbers = useCallback(() => {
    const emberCount = 30;
    const newEmbers: Ember[] = [];

    for (let i = 0; i < emberCount; i++) {
      const startX = (Math.random() - 0.5) * cardWidth;
      const startY = cardHeight / 2 + Math.random() * 50;

      newEmbers.push({
        id: i,
        x: new Animated.Value(startX),
        y: new Animated.Value(startY),
        scale: new Animated.Value(0),
        opacity: new Animated.Value(0),
        color: FIRE_COLORS.ember[i % FIRE_COLORS.ember.length],
        size: 3 + Math.random() * 5,
      });
    }

    setEmbers(newEmbers);
    return newEmbers;
  }, [cardWidth, cardHeight]);

  // Animate embers rising
  const animateEmbers = useCallback(
    (emberList: Ember[]) => {
      emberList.forEach((ember, index) => {
        const delay = index * 80;
        const duration = 2000 + Math.random() * 1500;
        const driftX = (Math.random() - 0.5) * 100;

        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            // Fade in
            Animated.timing(ember.opacity, {
              toValue: 1,
              duration: 200,
              useNativeDriver: canUseNativeDriver,
            }),
            Animated.timing(ember.scale, {
              toValue: 1,
              duration: 200,
              useNativeDriver: canUseNativeDriver,
            }),
          ]),
        ]).start();

        // Float upward with drift
        Animated.parallel([
          Animated.timing(ember.y, {
            toValue: -cardHeight,
            duration: duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: canUseNativeDriver,
          }),
          Animated.timing(ember.x, {
            toValue: (ember.x as unknown as { _value: number })._value + driftX,
            duration: duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: canUseNativeDriver,
          }),
          Animated.sequence([
            Animated.delay(duration * 0.7),
            Animated.timing(ember.opacity, {
              toValue: 0,
              duration: duration * 0.3,
              useNativeDriver: canUseNativeDriver,
            }),
          ]),
        ]).start();
      });
    },
    [cardHeight],
  );

  // Animate flames
  const animateFlames = useCallback((flameList: Flame[]) => {
    flameList.forEach((flame) => {
      // Initial rise
      Animated.sequence([
        Animated.delay(flame.delay),
        Animated.parallel([
          Animated.timing(flame.opacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: canUseNativeDriver,
          }),
          Animated.timing(flame.height, {
            toValue: 1,
            duration: 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: canUseNativeDriver,
          }),
        ]),
      ]).start();

      // Flickering loop
      Animated.loop(
        Animated.sequence([
          Animated.timing(flame.scale, {
            toValue: 0.7 + Math.random() * 0.6,
            duration: 100 + Math.random() * 150,
            useNativeDriver: canUseNativeDriver,
          }),
          Animated.timing(flame.scale, {
            toValue: 0.5 + Math.random() * 0.5,
            duration: 100 + Math.random() * 150,
            useNativeDriver: canUseNativeDriver,
          }),
        ]),
      ).start();
    });
  }, []);

  // Handle reveal complete
  const handleRevealComplete = useCallback(() => {
    setTimeout(() => {
      onComplete();
    }, CONFIG.flip.revealHoldDuration);
  }, [onComplete]);

  // Fade out flames
  const fadeOutFlames = useCallback((flameList: Flame[]) => {
    flameList.forEach((flame) => {
      Animated.timing(flame.opacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: canUseNativeDriver,
      }).start();
    });
  }, []);

  // Main animation sequence
  useEffect(() => {
    if (reducedMotion) {
      darknessOpacity.setValue(0);
      burnLine.setValue(0);
      cardScale.setValue(1);
      cardOpacity.setValue(1);
      setPhase('revealed');
      return;
    }

    const flameList = createFlames();
    const emberList = createEmbers();

    // Phase 1: Ignition
    const igniteAnimation = () => {
      setPhase('igniting');
      if (enableHaptics) triggerHaptic('light', true);

      // Start flames
      animateFlames(flameList);

      // Fire glow
      Animated.timing(fireGlow, {
        toValue: 1,
        duration: 500,
        useNativeDriver: canUseNativeDriver,
      }).start();

      // Start embers
      setTimeout(() => {
        animateEmbers(emberList);
      }, 300);

      // Move to burning phase
      setTimeout(burnAnimation, 600);
    };

    // Phase 2: Burning away the darkness
    const burnAnimation = () => {
      setPhase('burning');
      if (enableHaptics) triggerHaptic('medium', true);

      Animated.parallel([
        // Burn line moves up (darkness recedes)
        Animated.timing(burnLine, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: canUseNativeDriver,
        }),
        // Card becomes visible
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: canUseNativeDriver,
        }),
        // Card scales up slightly
        Animated.timing(cardScale, {
          toValue: 1,
          duration: 1500,
          easing: Easing.out(Easing.back(1.05)),
          useNativeDriver: canUseNativeDriver,
        }),
        // Heat distortion
        Animated.timing(heatDistortion, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: canUseNativeDriver,
        }),
      ]).start(() => {
        revealAnimation(flameList);
      });
    };

    // Phase 3: Reveal complete
    const revealAnimation = (flameListRef: Flame[]) => {
      setPhase('revealed');
      if (enableHaptics) triggerHaptic('heavy', true);

      // Fade darkness completely
      Animated.timing(darknessOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: canUseNativeDriver,
      }).start();

      // Fade out flames
      fadeOutFlames(flameListRef);

      // Fade out fire glow
      Animated.timing(fireGlow, {
        toValue: 0,
        duration: 500,
        useNativeDriver: canUseNativeDriver,
      }).start();
    };

    // Start sequence
    setTimeout(igniteAnimation, 500);
  }, [
    reducedMotion,
    enableHaptics,
    darknessOpacity,
    burnLine,
    fireGlow,
    cardScale,
    cardOpacity,
    heatDistortion,
    createFlames,
    createEmbers,
    animateFlames,
    animateEmbers,
    fadeOutFlames,
  ]);

  // Burn mask height (inverted - shows more as burn line goes up)
  const burnMaskHeight = burnLine.interpolate({
    inputRange: [0, cardHeight],
    outputRange: [0, cardHeight],
  });

  return (
    <View
      testID={`${testIDPrefix}-container`}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Fire glow behind card */}
      <Animated.View
        style={[
          styles.fireGlow,
          {
            width: cardWidth * 1.5,
            height: cardHeight * 1.5,
            opacity: fireGlow,
          },
        ]}
      >
        <LinearGradient
          colors={[FIRE_COLORS.outer + '80', FIRE_COLORS.inner + '40', 'transparent']}
          style={styles.fireGlowGradient}
          start={{ x: 0.5, y: 1 }}
          end={{ x: 0.5, y: 0 }}
        />
      </Animated.View>

      {/* Card container */}
      <Animated.View
        style={[
          styles.cardContainer,
          {
            width: cardWidth,
            height: cardHeight,
            borderRadius: borderRadius.medium,
            transform: [{ scale: cardScale }],
            opacity: cardOpacity,
          },
        ]}
      >
        {/* Role card content */}
        <View style={[styles.cardContent, { borderRadius: borderRadius.medium }]}>
          <RoleCardContent roleId={role.id as RoleId} width={cardWidth} height={cardHeight} />
        </View>

        {/* Darkness overlay with burn effect */}
        <Animated.View
          style={[
            styles.darknessOverlay,
            {
              height: burnMaskHeight,
              opacity: darknessOpacity,
              borderRadius: borderRadius.medium,
            },
          ]}
        >
          <LinearGradient
            colors={[FIRE_COLORS.darkness, FIRE_COLORS.darkness]}
            style={StyleSheet.absoluteFill}
          />
          {/* Burning edge gradient */}
          <LinearGradient
            colors={['transparent', FIRE_COLORS.outer, FIRE_COLORS.inner, FIRE_COLORS.core]}
            style={styles.burningEdge}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
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

      {/* Flames at bottom */}
      <View
        style={[
          styles.flamesContainer,
          { width: cardWidth, bottom: '50%', marginBottom: -cardHeight / 2 },
        ]}
      >
        {flames.map((flame) => {
          const flameHeight = flame.height.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 80 + Math.random() * 40],
          });

          return (
            <Animated.View
              key={flame.id}
              style={[
                styles.flame,
                {
                  left: flame.x + cardWidth / 2 - 15,
                  opacity: flame.opacity,
                  transform: [{ scaleX: flame.scale }, { scaleY: flame.scale }],
                },
              ]}
            >
              <Animated.View style={{ height: flameHeight, width: 30 }}>
                <LinearGradient
                  colors={[FIRE_COLORS.core, FIRE_COLORS.inner, FIRE_COLORS.outer, 'transparent']}
                  style={styles.flameGradient}
                  start={{ x: 0.5, y: 1 }}
                  end={{ x: 0.5, y: 0 }}
                />
              </Animated.View>
            </Animated.View>
          );
        })}
      </View>

      {/* Embers */}
      {embers.map((ember) => (
        <Animated.View
          key={ember.id}
          style={[
            styles.ember,
            {
              width: ember.size,
              height: ember.size,
              borderRadius: ember.size / 2,
              backgroundColor: ember.color,
              shadowColor: ember.color,
              opacity: ember.opacity,
              transform: [{ translateX: ember.x }, { translateY: ember.y }, { scale: ember.scale }],
            },
          ]}
        />
      ))}
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
  fireGlow: {
    position: 'absolute',
  },
  fireGlowGradient: {
    flex: 1,
    borderRadius: 1000,
  },
  cardContainer: {
    position: 'relative',
    overflow: 'hidden',
    shadowColor: FIRE_COLORS.outer,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  cardContent: {
    flex: 1,
    overflow: 'hidden',
  },
  darknessOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  burningEdge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
  },
  glowBorder: {
    position: 'absolute',
    top: -4,
    left: -4,
  },
  flamesContainer: {
    position: 'absolute',
    height: 120,
  },
  flame: {
    position: 'absolute',
    bottom: 0,
  },
  flameGradient: {
    flex: 1,
    borderRadius: 15,
  },
  ember: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
});
