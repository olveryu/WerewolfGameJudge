/**
 * FogReveal - Enhanced fog disperse reveal animation
 *
 * Features:
 * - Realistic smoke particles
 * - Wind-blown disperse effect
 * - Light beams piercing through
 * - Gradual card reveal
 * - Light burst on completion
 * - Mystical atmosphere
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
import type { RoleRevealEffectProps, RoleAlignment } from '../types';
import { ALIGNMENT_THEMES } from '../types';
import { CONFIG } from '../config';
import { canUseNativeDriver } from '../utils/platform';
import { triggerHaptic } from '../utils/haptics';
import { RoleCardContent } from '../common/RoleCardContent';
import { GlowBorder } from '../common/GlowBorder';
import type { RoleId } from '../../../models/roles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Get colors based on alignment
function getAlignmentColors(alignment: RoleAlignment): {
  fogColor: string;
  fogColorLight: string;
  lightBeamColor: string;
  glowColor: string;
} {
  switch (alignment) {
    case 'wolf':
      return {
        fogColor: 'rgba(80, 20, 20, 0.85)',
        fogColorLight: 'rgba(120, 40, 40, 0.6)',
        lightBeamColor: 'rgba(255, 100, 100, 0.3)',
        glowColor: '#FF4444',
      };
    case 'god':
      return {
        fogColor: 'rgba(20, 40, 80, 0.85)',
        fogColorLight: 'rgba(40, 80, 140, 0.6)',
        lightBeamColor: 'rgba(100, 150, 255, 0.3)',
        glowColor: '#4488FF',
      };
    default:
      return {
        fogColor: 'rgba(20, 60, 30, 0.85)',
        fogColorLight: 'rgba(40, 100, 60, 0.6)',
        lightBeamColor: 'rgba(100, 200, 100, 0.3)',
        glowColor: '#44AA44',
      };
  }
}

interface SmokeParticle {
  id: number;
  x: Animated.Value;
  y: Animated.Value;
  scale: Animated.Value;
  opacity: Animated.Value;
  rotation: Animated.Value;
  size: number;
  initialX: number;
  initialY: number;
}

interface LightBeam {
  id: number;
  angle: number;
  width: number;
  opacity: Animated.Value;
  scale: Animated.Value;
}

// Generate deterministic smoke particles
function generateSmokeParticles(count: number, cardWidth: number, cardHeight: number): Omit<SmokeParticle, 'x' | 'y' | 'scale' | 'opacity' | 'rotation'>[] {
  const particles: Omit<SmokeParticle, 'x' | 'y' | 'scale' | 'opacity' | 'rotation'>[] = [];
  
  for (let i = 0; i < count; i++) {
    // Distribute particles across the card area
    const gridX = (i % 5) - 2; // -2 to 2
    const gridY = Math.floor(i / 5) - 2; // -2 to 2
    const offsetX = ((i * 17) % 40) - 20; // Deterministic offset
    const offsetY = ((i * 13) % 40) - 20;
    
    particles.push({
      id: i,
      size: 60 + (i % 4) * 20, // 60-120
      initialX: gridX * (cardWidth / 4) + offsetX,
      initialY: gridY * (cardHeight / 4) + offsetY,
    });
  }
  
  return particles;
}

// Generate light beams
function generateLightBeams(count: number): Omit<LightBeam, 'opacity' | 'scale'>[] {
  const beams: Omit<LightBeam, 'opacity' | 'scale'>[] = [];
  
  for (let i = 0; i < count; i++) {
    beams.push({
      id: i,
      angle: -30 + (i * 60) / count, // Spread from -30 to 30 degrees
      width: 20 + (i % 3) * 10, // 20-40
    });
  }
  
  return beams;
}

export const FogReveal: React.FC<RoleRevealEffectProps> = ({
  role,
  onComplete,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'fog-reveal',
}) => {
  const colors = useColors();
  const config = CONFIG.fog;
  const theme = ALIGNMENT_THEMES[role.alignment];
  const alignmentColors = getAlignmentColors(role.alignment);

  const [phase, setPhase] = useState<'foggy' | 'dispersing' | 'revealed'>('foggy');

  const cardWidth = Math.min(280, SCREEN_WIDTH * 0.75);
  const cardHeight = cardWidth * 1.35;

  // Generate particle data
  const smokeParticleData = useMemo(
    () => generateSmokeParticles(25, cardWidth, cardHeight),
    [cardWidth, cardHeight]
  );

  const lightBeamData = useMemo(() => generateLightBeams(5), []);

  // Create animated particles
  const smokeParticles = useMemo<SmokeParticle[]>(
    () => smokeParticleData.map((p) => ({
      ...p,
      x: new Animated.Value(p.initialX),
      y: new Animated.Value(p.initialY),
      scale: new Animated.Value(1),
      opacity: new Animated.Value(0.8 + (p.id % 3) * 0.1),
      rotation: new Animated.Value(0),
    })),
    [smokeParticleData]
  );

  // Create animated light beams
  const lightBeams = useMemo<LightBeam[]>(
    () => lightBeamData.map((b) => ({
      ...b,
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0.5),
    })),
    [lightBeamData]
  );

  // Card animations
  const cardOpacity = useMemo(() => new Animated.Value(0), []);
  const cardScale = useMemo(() => new Animated.Value(0.9), []);
  
  // Light burst animation
  const burstScale = useMemo(() => new Animated.Value(0), []);
  const burstOpacity = useMemo(() => new Animated.Value(0), []);

  // Overall fog opacity for overlay
  const fogOverlayOpacity = useMemo(() => new Animated.Value(1), []);

  // Handle disperse complete
  const handleDisperseComplete = useCallback(() => {
    if (enableHaptics) {
      triggerHaptic('medium', true);
    }

    // Light burst effect
    Animated.parallel([
      Animated.timing(burstScale, {
        toValue: 2,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: canUseNativeDriver,
      }),
      Animated.sequence([
        Animated.timing(burstOpacity, {
          toValue: 0.8,
          duration: 100,
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(burstOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: canUseNativeDriver,
        }),
      ]),
    ]).start();

    setPhase('revealed');
  }, [enableHaptics, burstScale, burstOpacity]);

  // Handle glow complete
  const handleGlowComplete = useCallback(() => {
    setTimeout(() => {
      onComplete();
    }, config.revealHoldDuration);
  }, [onComplete, config.revealHoldDuration]);

  // Start fog animation
  useEffect(() => {
    if (reducedMotion) {
      smokeParticles.forEach((p) => p.opacity.setValue(0));
      cardOpacity.setValue(1);
      cardScale.setValue(1);
      setPhase('revealed');
      return;
    }

    setPhase('dispersing');

    // Animate smoke particles - wind effect blowing to the right
    const particleAnimations = smokeParticles.map((particle, index) => {
      const windDirection = 1; // Blow right
      const delay = (index % 5) * 100; // Stagger by row
      const duration = config.disperseDuration + (index % 3) * 200;

      // Target position (blown away)
      const targetX = particle.initialX + windDirection * (200 + (index % 4) * 50);
      const targetY = particle.initialY - 50 - (index % 3) * 30; // Slight rise

      return Animated.parallel([
        // Move with wind
        Animated.timing(particle.x, {
          toValue: targetX,
          duration,
          delay,
          easing: Easing.out(Easing.quad),
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(particle.y, {
          toValue: targetY,
          duration,
          delay,
          easing: Easing.out(Easing.quad),
          useNativeDriver: canUseNativeDriver,
        }),
        // Expand and fade
        Animated.timing(particle.scale, {
          toValue: 1.5 + (index % 3) * 0.3,
          duration,
          delay,
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(particle.opacity, {
          toValue: 0,
          duration,
          delay,
          useNativeDriver: canUseNativeDriver,
        }),
        // Rotate
        Animated.timing(particle.rotation, {
          toValue: (index % 2 === 0 ? 1 : -1) * 0.5,
          duration,
          delay,
          useNativeDriver: canUseNativeDriver,
        }),
      ]);
    });

    // Animate light beams - appear and grow
    const beamAnimations = lightBeams.map((beam, index) => {
      const delay = 500 + index * 150;

      return Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(beam.opacity, {
            toValue: 0.6,
            duration: 300,
            useNativeDriver: canUseNativeDriver,
          }),
          Animated.timing(beam.scale, {
            toValue: 1,
            duration: 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: canUseNativeDriver,
          }),
        ]),
        Animated.timing(beam.opacity, {
          toValue: 0,
          duration: 500,
          delay: 200,
          useNativeDriver: canUseNativeDriver,
        }),
      ]);
    });

    // Fade overlay fog
    const overlayAnimation = Animated.timing(fogOverlayOpacity, {
      toValue: 0,
      duration: config.disperseDuration,
      delay: 500,
      useNativeDriver: canUseNativeDriver,
    });

    // Reveal card
    const cardAnimation = Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: config.disperseDuration,
        delay: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: canUseNativeDriver,
      }),
      Animated.timing(cardScale, {
        toValue: 1,
        duration: config.disperseDuration,
        delay: 300,
        easing: Easing.out(Easing.back(1.1)),
        useNativeDriver: canUseNativeDriver,
      }),
    ]);

    // Run all animations
    Animated.parallel([
      ...particleAnimations,
      ...beamAnimations,
      overlayAnimation,
      cardAnimation,
    ]).start(() => {
      handleDisperseComplete();
    });
  }, [
    reducedMotion,
    smokeParticles,
    lightBeams,
    cardOpacity,
    cardScale,
    fogOverlayOpacity,
    config.disperseDuration,
    handleDisperseComplete,
  ]);

  return (
    <View
      testID={`${testIDPrefix}-container`}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Light burst effect */}
      <Animated.View
        style={[
          styles.lightBurst,
          {
            width: cardWidth * 1.5,
            height: cardHeight * 1.5,
            borderRadius: cardWidth,
            backgroundColor: alignmentColors.glowColor,
            transform: [{ scale: burstScale }],
            opacity: burstOpacity,
          },
        ]}
      />

      {/* Role card */}
      <Animated.View
        style={[
          styles.cardContainer,
          {
            width: cardWidth,
            height: cardHeight,
            opacity: cardOpacity,
            transform: [{ scale: cardScale }],
          },
        ]}
      >
        <RoleCardContent
          roleId={role.id as RoleId}
          width={cardWidth}
          height={cardHeight}
        />

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

      {/* Light beams */}
      {lightBeams.map((beam) => (
        <Animated.View
          key={beam.id}
          style={[
            styles.lightBeam,
            {
              width: beam.width,
              height: cardHeight * 2,
              backgroundColor: alignmentColors.lightBeamColor,
              transform: [
                { rotate: `${beam.angle}deg` },
                { scaleY: beam.scale },
              ],
              opacity: beam.opacity,
            },
          ]}
        />
      ))}

      {/* Fog overlay */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.fogOverlay,
          {
            opacity: fogOverlayOpacity,
          },
        ]}
      >
        <LinearGradient
          colors={[alignmentColors.fogColor, alignmentColors.fogColorLight, alignmentColors.fogColor]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Smoke particles */}
      {smokeParticles.map((particle) => (
        <Animated.View
          key={particle.id}
          pointerEvents="none"
          style={[
            styles.smokeParticle,
            {
              width: particle.size,
              height: particle.size,
              borderRadius: particle.size / 2,
              backgroundColor: alignmentColors.fogColor,
              transform: [
                { translateX: particle.x },
                { translateY: particle.y },
                { scale: particle.scale },
                {
                  rotate: particle.rotation.interpolate({
                    inputRange: [-1, 1],
                    outputRange: ['-45deg', '45deg'],
                  }),
                },
              ],
              opacity: particle.opacity,
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
  },
  cardContainer: {
    zIndex: 1,
  },
  fogOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  smokeParticle: {
    position: 'absolute',
    zIndex: 3,
    // Soft edges simulated with shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  lightBeam: {
    position: 'absolute',
    zIndex: 0,
  },
  lightBurst: {
    position: 'absolute',
    zIndex: 0,
  },
});
