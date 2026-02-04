/**
 * FogReveal - Enhanced fog disperse reveal animation
 *
 * Features:
 * - Realistic smoke particles with VORTEX swirl effect
 * - Magic sparkle particles trailing the smoke
 * - Wind-blown disperse effect
 * - Light beams piercing through
 * - RIPPLE wave on card reveal
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
  sparkleColor: string;
  rippleColor: string;
} {
  switch (alignment) {
    case 'wolf':
      return {
        fogColor: 'rgba(80, 20, 20, 0.85)',
        fogColorLight: 'rgba(120, 40, 40, 0.6)',
        lightBeamColor: 'rgba(255, 100, 100, 0.3)',
        glowColor: '#FF4444',
        sparkleColor: '#FF6666',
        rippleColor: 'rgba(255, 68, 68, 0.5)',
      };
    case 'god':
      return {
        fogColor: 'rgba(20, 40, 80, 0.85)',
        fogColorLight: 'rgba(40, 80, 140, 0.6)',
        lightBeamColor: 'rgba(100, 150, 255, 0.3)',
        glowColor: '#4488FF',
        sparkleColor: '#88BBFF',
        rippleColor: 'rgba(68, 136, 255, 0.5)',
      };
    default:
      return {
        fogColor: 'rgba(20, 60, 30, 0.85)',
        fogColorLight: 'rgba(40, 100, 60, 0.6)',
        lightBeamColor: 'rgba(100, 200, 100, 0.3)',
        glowColor: '#44AA44',
        sparkleColor: '#88DD88',
        rippleColor: 'rgba(68, 170, 68, 0.5)',
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
  vortexAngle: number;
  vortexRadius: number;
}

interface MagicSparkle {
  id: number;
  x: Animated.Value;
  y: Animated.Value;
  scale: Animated.Value;
  opacity: Animated.Value;
  twinkle: Animated.Value;
  size: number;
  delay: number;
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

interface RippleWave {
  id: number;
  scale: Animated.Value;
  opacity: Animated.Value;
  delay: number;
}

// Generate deterministic smoke particles with vortex data
function generateSmokeParticles(count: number, cardWidth: number, cardHeight: number): Omit<SmokeParticle, 'x' | 'y' | 'scale' | 'opacity' | 'rotation'>[] {
  const particles: Omit<SmokeParticle, 'x' | 'y' | 'scale' | 'opacity' | 'rotation'>[] = [];
  
  for (let i = 0; i < count; i++) {
    const gridX = (i % 5) - 2;
    const gridY = Math.floor(i / 5) - 2;
    const offsetX = ((i * 17) % 40) - 20;
    const offsetY = ((i * 13) % 40) - 20;
    const vortexAngle = (i / count) * Math.PI * 2;
    const vortexRadius = 50 + (i % 5) * 30;
    
    particles.push({
      id: i,
      size: 60 + (i % 4) * 20,
      initialX: gridX * (cardWidth / 4) + offsetX,
      initialY: gridY * (cardHeight / 4) + offsetY,
      vortexAngle,
      vortexRadius,
    });
  }
  
  return particles;
}

// Generate magic sparkles with initial positions
function generateMagicSparkles(count: number): Omit<MagicSparkle, 'x' | 'y' | 'scale' | 'opacity' | 'twinkle'>[] {
  const sparkles: Omit<MagicSparkle, 'x' | 'y' | 'scale' | 'opacity' | 'twinkle'>[] = [];
  for (let i = 0; i < count; i++) {
    // Distribute sparkles in a circular pattern around the card
    const angle = (i / count) * Math.PI * 2;
    const radius = 80 + (i % 3) * 40;
    sparkles.push({
      id: i,
      size: 4 + (i % 4) * 2,
      delay: (i % 8) * 80,
      initialX: Math.cos(angle) * radius,
      initialY: Math.sin(angle) * radius,
    });
  }
  return sparkles;
}

// Get sparkle color variants based on alignment
function getSparkleColors(alignment: RoleAlignment): string[] {
  switch (alignment) {
    case 'wolf':
      return ['#FF6666', '#FF4444', '#FF8888', '#FFAAAA'];
    case 'god':
      return ['#88BBFF', '#6699FF', '#AADDFF', '#FFFFFF'];
    default:
      return ['#88DD88', '#66CC66', '#AAFFAA', '#CCFFCC'];
  }
}

// Generate light beams
function generateLightBeams(count: number): Omit<LightBeam, 'opacity' | 'scale'>[] {
  const beams: Omit<LightBeam, 'opacity' | 'scale'>[] = [];
  for (let i = 0; i < count; i++) {
    beams.push({
      id: i,
      angle: -30 + (i * 60) / count,
      width: 20 + (i % 3) * 10,
    });
  }
  return beams;
}

// Generate ripple waves
function generateRippleWaves(count: number): Omit<RippleWave, 'scale' | 'opacity'>[] {
  const waves: Omit<RippleWave, 'scale' | 'opacity'>[] = [];
  for (let i = 0; i < count; i++) {
    waves.push({ id: i, delay: i * 120 });
  }
  return waves;
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
  const sparkleColors = getSparkleColors(role.alignment);

  const [phase, setPhase] = useState<'foggy' | 'dispersing' | 'revealed'>('foggy');

  // Use same calculation as RoleCardSimple: Math.min(SCREEN_WIDTH * 0.75, 280) and ratio 1.4
  const cardWidth = Math.min(280, SCREEN_WIDTH * 0.75);
  const cardHeight = cardWidth * 1.4;

  // Generate particle data - with vortex parameters
  const smokeParticleData = useMemo(
    () => generateSmokeParticles(30, cardWidth, cardHeight), // Increased count
    [cardWidth, cardHeight]
  );

  const lightBeamData = useMemo(() => generateLightBeams(5), []);
  
  // Magic sparkles data
  const sparkleData = useMemo(() => generateMagicSparkles(15), []);
  
  // Ripple waves data
  const rippleData = useMemo(() => generateRippleWaves(4), []);

  // Create animated particles with vortex properties
  const smokeParticles = useMemo<SmokeParticle[]>(
    () => smokeParticleData.map((p) => ({
      ...p,
      x: new Animated.Value(p.initialX),
      y: new Animated.Value(p.initialY),
      scale: new Animated.Value(1),
      opacity: new Animated.Value(0.85 + (p.id % 3) * 0.05),
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
  
  // Create animated magic sparkles
  const magicSparkles = useMemo<MagicSparkle[]>(
    () => sparkleData.map((s) => ({
      ...s,
      x: new Animated.Value(s.initialX),
      y: new Animated.Value(s.initialY),
      scale: new Animated.Value(0),
      opacity: new Animated.Value(0),
      twinkle: new Animated.Value(0),
    })),
    [sparkleData]
  );
  
  // Create animated ripple waves
  const rippleWaves = useMemo<RippleWave[]>(
    () => rippleData.map((r) => ({
      ...r,
      scale: new Animated.Value(0),
      opacity: new Animated.Value(0),
    })),
    [rippleData]
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

    // Animate smoke particles - VORTEX swirl effect
    const particleAnimations = smokeParticles.map((particle, index) => {
      const delay = (index % 5) * 80; // Stagger
      const duration = config.disperseDuration + (index % 3) * 200;

      // Vortex spiral outward: particle spirals out from center
      const spiralAngle = particle.vortexAngle + Math.PI * 1.5; // 1.5 rotations during animation
      const finalRadius = particle.vortexRadius + 150 + (index % 4) * 30;
      const targetX = Math.cos(spiralAngle) * finalRadius;
      const targetY = Math.sin(spiralAngle) * finalRadius - 30; // Slight rise

      return Animated.parallel([
        // Spiral move with vortex
        Animated.timing(particle.x, {
          toValue: targetX,
          duration,
          delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(particle.y, {
          toValue: targetY,
          duration,
          delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: canUseNativeDriver,
        }),
        // Expand and fade
        Animated.timing(particle.scale, {
          toValue: 1.8 + (index % 3) * 0.3,
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
        // Rotate with the vortex
        Animated.timing(particle.rotation, {
          toValue: (index % 2 === 0 ? 1 : -1) * 1.2,
          duration,
          delay,
          useNativeDriver: canUseNativeDriver,
        }),
      ]);
    });

    // Animate magic sparkles - trail behind smoke with twinkle
    const sparkleAnimations = magicSparkles.map((sparkle, index) => {
      const delay = 200 + sparkle.delay;
      const duration = 800 + (index % 3) * 200;
      const spiralAngle = (index / magicSparkles.length) * Math.PI * 2 + Math.PI;
      const finalRadius = 120 + (index % 3) * 50;
      
      return Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          // Appear with scale
          Animated.sequence([
            Animated.timing(sparkle.scale, {
              toValue: 1.2,
              duration: 150,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: canUseNativeDriver,
            }),
            Animated.timing(sparkle.scale, {
              toValue: 0.8,
              duration: duration - 150,
              useNativeDriver: canUseNativeDriver,
            }),
          ]),
          // Fade in and out
          Animated.sequence([
            Animated.timing(sparkle.opacity, {
              toValue: 1,
              duration: 100,
              useNativeDriver: canUseNativeDriver,
            }),
            Animated.timing(sparkle.opacity, {
              toValue: 0,
              duration: duration - 100,
              delay: 200,
              useNativeDriver: canUseNativeDriver,
            }),
          ]),
          // Spiral outward movement
          Animated.timing(sparkle.x, {
            toValue: Math.cos(spiralAngle) * finalRadius,
            duration,
            easing: Easing.out(Easing.quad),
            useNativeDriver: canUseNativeDriver,
          }),
          Animated.timing(sparkle.y, {
            toValue: Math.sin(spiralAngle) * finalRadius - 20,
            duration,
            easing: Easing.out(Easing.quad),
            useNativeDriver: canUseNativeDriver,
          }),
          // Twinkle effect
          Animated.loop(
            Animated.sequence([
              Animated.timing(sparkle.twinkle, {
                toValue: 1,
                duration: 100,
                useNativeDriver: canUseNativeDriver,
              }),
              Animated.timing(sparkle.twinkle, {
                toValue: 0.3,
                duration: 100,
                useNativeDriver: canUseNativeDriver,
              }),
            ]),
            { iterations: 4 }
          ),
        ]),
      ]);
    });

    // Animate ripple waves on card reveal
    const rippleAnimations = rippleWaves.map((ripple) => {
      return Animated.sequence([
        Animated.delay(400 + ripple.delay),
        Animated.parallel([
          Animated.timing(ripple.scale, {
            toValue: 2.5,
            duration: 600,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: canUseNativeDriver,
          }),
          Animated.sequence([
            Animated.timing(ripple.opacity, {
              toValue: 0.6,
              duration: 100,
              useNativeDriver: canUseNativeDriver,
            }),
            Animated.timing(ripple.opacity, {
              toValue: 0,
              duration: 500,
              useNativeDriver: canUseNativeDriver,
            }),
          ]),
        ]),
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

    // Run all animations including sparkles and ripples
    Animated.parallel([
      ...particleAnimations,
      ...sparkleAnimations,
      ...rippleAnimations,
      ...beamAnimations,
      overlayAnimation,
      cardAnimation,
    ]).start(() => {
      handleDisperseComplete();
    });
  }, [
    reducedMotion,
    smokeParticles,
    magicSparkles,
    rippleWaves,
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
                    inputRange: [-1.5, 1.5],
                    outputRange: ['-90deg', '90deg'],
                  }),
                },
              ],
              opacity: particle.opacity,
            },
          ]}
        />
      ))}

      {/* Magic sparkles */}
      {magicSparkles.map((sparkle, index) => (
        <Animated.View
          key={`sparkle-${sparkle.id}`}
          pointerEvents="none"
          style={[
            styles.sparkle,
            {
              width: sparkle.size,
              height: sparkle.size,
              borderRadius: sparkle.size / 2,
              backgroundColor: sparkleColors[index % sparkleColors.length],
              transform: [
                { translateX: sparkle.x },
                { translateY: sparkle.y },
                { scale: sparkle.scale },
              ],
              opacity: Animated.multiply(sparkle.opacity, sparkle.twinkle),
              shadowColor: sparkleColors[index % sparkleColors.length],
              shadowRadius: sparkle.size,
            },
          ]}
        />
      ))}

      {/* Ripple waves */}
      {rippleWaves.map((ripple) => (
        <Animated.View
          key={`ripple-${ripple.id}`}
          pointerEvents="none"
          style={[
            styles.ripple,
            {
              width: cardWidth * 0.8,
              height: cardWidth * 0.8,
              borderRadius: cardWidth * 0.4,
              borderColor: alignmentColors.rippleColor,
              transform: [{ scale: ripple.scale }],
              opacity: ripple.opacity,
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
  sparkle: {
    position: 'absolute',
    zIndex: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
  },
  ripple: {
    position: 'absolute',
    zIndex: 0,
    borderWidth: 3,
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
