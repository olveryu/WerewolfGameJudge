/**
 * FlipReveal - 3D card flip reveal animation
 *
 * Features:
 * - 3D flip animation with dynamic shadow
 * - Shine sweep effect on reveal
 * - Alignment-based particle burst
 * - Glow effects matching faction
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { useColors, borderRadius } from '../../../theme';
import type { RoleRevealEffectProps } from '../types';
import { ALIGNMENT_THEMES } from '../types';
import { CONFIG } from '../config';
import { canUseNativeDriver, getOptimalParticleCount } from '../utils/platform';
import { playSound } from '../utils/sound';
import { triggerHaptic } from '../utils/haptics';
import { RoleCard } from '../common/RoleCard';
import { ShineEffect } from '../common/ShineEffect';
import { ParticleBurst } from '../common/ParticleBurst';
import { GlowBorder } from '../common/GlowBorder';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const FlipReveal: React.FC<RoleRevealEffectProps> = ({
  role,
  onComplete,
  reducedMotion = false,
  enableSound = true,
  enableHaptics = true,
  testIDPrefix = 'flip-reveal',
}) => {
  const colors = useColors();
  const config = CONFIG.flip;
  const theme = ALIGNMENT_THEMES[role.alignment];

  const [showShine, setShowShine] = useState(false);
  const [showParticles, setShowParticles] = useState(false);
  const [showGlow, setShowGlow] = useState(false);

  // Use useMemo to create stable Animated values (avoids lint rules about ref.current during render)
  const flipAnim = useMemo(() => new Animated.Value(0), []);
  const scaleAnim = useMemo(() => new Animated.Value(0.8), []);
  const opacityAnim = useMemo(() => new Animated.Value(0), []);
  const shadowAnim = useMemo(() => new Animated.Value(0), []);

  const cardWidth = Math.min(config.cardWidth, SCREEN_WIDTH * 0.7);
  const cardHeight = cardWidth * (config.cardHeight / config.cardWidth);

  // Handle flip complete
  const handleFlipComplete = useCallback(() => {
    // Trigger effects
    if (enableSound) {
      playSound('whoosh');
    }
    if (enableHaptics) {
      triggerHaptic('medium', true);
    }

    // Show shine and particles
    setShowShine(true);
    setShowParticles(true);

    setTimeout(() => {
      setShowGlow(true);
    }, config.shineDelay);
  }, [enableSound, enableHaptics, config.shineDelay]);

  // Handle entry animation complete - start flip
  const handleEntryComplete = useCallback(() => {
    // Animate flip
    Animated.parallel([
      Animated.timing(flipAnim, {
        toValue: 1,
        duration: config.flipDuration,
        useNativeDriver: canUseNativeDriver,
      }),
      Animated.timing(shadowAnim, {
        toValue: 1,
        duration: config.flipDuration,
        useNativeDriver: canUseNativeDriver,
      }),
    ]).start(handleFlipComplete);
  }, [flipAnim, shadowAnim, config.flipDuration, handleFlipComplete]);

  // Entry animation
  useEffect(() => {
    if (reducedMotion) {
      // Reduced motion: simple fade in
      opacityAnim.setValue(0);
      scaleAnim.setValue(CONFIG.common.reducedMotionMinScale);
      flipAnim.setValue(1);

      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: CONFIG.common.reducedMotionFadeDuration,
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: CONFIG.common.reducedMotionFadeDuration,
          useNativeDriver: canUseNativeDriver,
        }),
      ]).start(() => {
        onComplete();
      });
      return;
    }

    // Normal animation sequence - fade in the back of the card
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: canUseNativeDriver,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 100,
        useNativeDriver: canUseNativeDriver,
      }),
    ]).start(() => {
      // Start flip after short delay
      setTimeout(handleEntryComplete, 400);
    });
  }, [
    reducedMotion,
    flipAnim,
    scaleAnim,
    opacityAnim,
    shadowAnim,
    onComplete,
    handleEntryComplete,
  ]);

  // Handle glow animation complete
  const handleGlowComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // Flip interpolations
  const frontRotateY = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['180deg', '90deg', '0deg'],
  });

  const backRotateY = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '90deg', '180deg'],
  });

  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });

  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });

  // Dynamic shadow based on flip progress
  const shadowOpacity = shadowAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [
      config.shadowOpacityRange[0],
      config.shadowOpacityRange[1],
      config.shadowOpacityRange[0],
    ],
  });

  return (
    <View
      testID={`${testIDPrefix}-container`}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Particle burst */}
      <ParticleBurst
        centerX={SCREEN_WIDTH / 2}
        centerY={cardHeight / 2 + 100}
        color={theme.particleColor}
        count={getOptimalParticleCount(config.particleCount)}
        radius={config.particleSpreadRadius}
        durationRange={[config.particleDuration, config.particleDuration * 1.5]}
        active={showParticles}
      />

      {/* Card container */}
      <Animated.View
        style={[
          styles.cardContainer,
          {
            width: cardWidth,
            height: cardHeight,
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Back of card */}
        <Animated.View
          style={[
            styles.cardFace,
            {
              width: cardWidth,
              height: cardHeight,
              opacity: backOpacity,
              transform: [{ rotateY: backRotateY }],
              shadowOpacity: shadowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.2, 0.4],
              }),
            },
          ]}
        >
          <RoleCard
            role={role}
            width={cardWidth}
            height={cardHeight}
            showBack
            testID={`${testIDPrefix}-card-back`}
          />
        </Animated.View>

        {/* Front of card */}
        <Animated.View
          style={[
            styles.cardFace,
            styles.cardFront,
            {
              width: cardWidth,
              height: cardHeight,
              opacity: frontOpacity,
              transform: [{ rotateY: frontRotateY }],
              shadowOpacity,
            },
          ]}
        >
          <RoleCard
            role={role}
            width={cardWidth}
            height={cardHeight}
            testID={`${testIDPrefix}-card-front`}
          />

          {/* Shine effect overlay */}
          <ShineEffect
            width={cardWidth}
            height={cardHeight}
            active={showShine}
            duration={config.shineDuration}
            delay={config.shineDelay}
            color="rgba(255, 255, 255, 0.5)"
            style={styles.shineOverlay}
          />
        </Animated.View>

        {/* Glow border */}
        {showGlow && (
          <GlowBorder
            width={cardWidth + 8}
            height={cardHeight + 8}
            color={theme.primaryColor}
            glowColor={theme.glowColor}
            borderWidth={3}
            borderRadius={borderRadius.large + 4}
            animate={!reducedMotion}
            flashCount={2}
            flashDuration={200}
            onComplete={handleGlowComplete}
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
  },
  cardContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFace: {
    position: 'absolute',
    backfaceVisibility: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 8,
  },
  cardFront: {
    zIndex: 1,
  },
  shineOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: borderRadius.large,
  },
  glowBorder: {
    position: 'absolute',
    top: -4,
    left: -4,
  },
});
