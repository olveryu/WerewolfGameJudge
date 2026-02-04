/**
 * FogReveal - Fog disperse reveal animation
 *
 * Features:
 * - Multiple fog layers that disperse
 * - Alignment-based fog coloring
 * - Staggered layer animations
 * - Role card revealed underneath
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { useColors, borderRadius } from '../../../theme';
import type { RoleRevealEffectProps, RoleAlignment } from '../types';
import { ALIGNMENT_THEMES } from '../types';
import { CONFIG } from '../config';
import { canUseNativeDriver } from '../utils/platform';
import { playSound } from '../utils/sound';
import { triggerHaptic } from '../utils/haptics';
import { RoleCard } from '../common/RoleCard';
import { GlowBorder } from '../common/GlowBorder';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface FogLayerData {
  id: string;
  initialOpacity: number;
  direction: 'left' | 'right' | 'up';
  scale: number;
  delay: number;
}

// Get fog color based on alignment
function getFogColor(alignment: RoleAlignment): string {
  switch (alignment) {
    case 'wolf':
      return 'rgba(127, 29, 29, 0.8)'; // Dark red
    case 'god':
      return 'rgba(30, 58, 95, 0.8)'; // Blue gray
    default:
      return 'rgba(20, 83, 45, 0.8)'; // Green gray
  }
}

// Generate fog layer config (without random, uses deterministic values)
function generateFogLayers(layerCount: number, staggerDelay: number): FogLayerData[] {
  const layers: FogLayerData[] = [];
  const directions: Array<'left' | 'right' | 'up'> = ['left', 'right', 'up'];
  const opacityValues = [0.7, 0.8, 0.6, 0.75, 0.85]; // Deterministic opacity values
  const scaleValues = [1.1, 1.2, 1.05, 1.15, 1.25]; // Deterministic scale values

  for (let i = 0; i < layerCount; i++) {
    layers.push({
      id: `fog-layer-${i}`,
      initialOpacity: opacityValues[i % opacityValues.length],
      direction: directions[i % directions.length],
      scale: scaleValues[i % scaleValues.length],
      delay: i * staggerDelay,
    });
  }
  return layers;
}

export const FogReveal: React.FC<RoleRevealEffectProps> = ({
  role,
  onComplete,
  reducedMotion = false,
  enableSound = true,
  enableHaptics = true,
  testIDPrefix = 'fog-reveal',
}) => {
  const colors = useColors();
  const config = CONFIG.fog;
  const theme = ALIGNMENT_THEMES[role.alignment];
  const fogColor = getFogColor(role.alignment);

  const [showGlow, setShowGlow] = useState(false);

  const cardWidth = Math.min(240, SCREEN_WIDTH * 0.7);
  const cardHeight = cardWidth * 1.35;

  // Generate fog layers (deterministic)
  const fogLayers = useMemo<FogLayerData[]>(
    () => generateFogLayers(config.layerCount, config.layerStaggerDelay),
    [config.layerCount, config.layerStaggerDelay]
  );

  // Animation values for each layer
  const layerAnims = useMemo(
    () => fogLayers.map(() => new Animated.Value(0)),
    [fogLayers]
  );

  const cardOpacity = useMemo(() => new Animated.Value(0), []);
  const cardScale = useMemo(() => new Animated.Value(0.9), []);

  // Handle disperse complete
  const handleDisperseComplete = useCallback(() => {
    if (enableSound) {
      playSound('whoosh');
    }
    if (enableHaptics) {
      triggerHaptic('medium', true);
    }

    setShowGlow(true);
  }, [enableSound, enableHaptics]);

  // Handle glow complete
  const handleGlowComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // Start fog animation
  useEffect(() => {
    if (reducedMotion) {
      // Reduced motion: simple fade
      layerAnims.forEach((anim) => anim.setValue(1));
      cardOpacity.setValue(1);
      cardScale.setValue(1);
      setShowGlow(true);
      return;
    }

    // Fade in card slightly
    Animated.timing(cardOpacity, {
      toValue: 0.3,
      duration: 200,
      useNativeDriver: canUseNativeDriver,
    }).start();

    // Start fog disperse with stagger
    const animations = fogLayers.map((layer, index) =>
      Animated.timing(layerAnims[index], {
        toValue: 1,
        duration: config.disperseDuration,
        delay: layer.delay,
        useNativeDriver: canUseNativeDriver,
      })
    );

    // Reveal card as fog clears
    const cardAnimation = Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: config.disperseDuration,
        delay: config.layerStaggerDelay * 2,
        useNativeDriver: canUseNativeDriver,
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        friction: 8,
        tension: 100,
        delay: config.disperseDuration * 0.5,
        useNativeDriver: canUseNativeDriver,
      }),
    ]);

    Animated.parallel([...animations, cardAnimation]).start(handleDisperseComplete);
  }, [
    reducedMotion,
    fogLayers,
    layerAnims,
    cardOpacity,
    cardScale,
    config,
    handleDisperseComplete,
  ]);

  return (
    <View
      testID={`${testIDPrefix}-container`}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Role card */}
      <Animated.View
        style={[
          styles.cardWrapper,
          {
            opacity: cardOpacity,
            transform: [{ scale: cardScale }],
          },
        ]}
      >
        <RoleCard
          role={role}
          width={cardWidth}
          height={cardHeight}
          testID={`${testIDPrefix}-card`}
        />

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

      {/* Fog layers */}
      {fogLayers.map((layer, index) => {
        const anim = layerAnims[index];

        // Calculate translation based on direction
        let translateX: Animated.AnimatedInterpolation<number>;
        let translateY: Animated.AnimatedInterpolation<number>;

        switch (layer.direction) {
          case 'left':
            translateX = anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -config.translateDistance],
            });
            translateY = anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0],
            });
            break;
          case 'right':
            translateX = anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, config.translateDistance],
            });
            translateY = anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0],
            });
            break;
          case 'up':
          default:
            translateX = anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0],
            });
            translateY = anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -config.translateDistance],
            });
            break;
        }

        const opacity = anim.interpolate({
          inputRange: [0, 0.7, 1],
          outputRange: [layer.initialOpacity, layer.initialOpacity * 0.3, 0],
        });

        const scale = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [layer.scale, layer.scale * config.scaleExpansion],
        });

        return (
          <Animated.View
            key={layer.id}
            style={[
              styles.fogLayer,
              {
                backgroundColor: fogColor,
                opacity,
                transform: [
                  { translateX },
                  { translateY },
                  { scale },
                ],
              },
            ]}
            pointerEvents="none"
          >
            {/* Cloud-like shapes using overlapping circles */}
            <View style={[styles.fogBlob, styles.fogBlob1, { backgroundColor: fogColor }]} />
            <View style={[styles.fogBlob, styles.fogBlob2, { backgroundColor: fogColor }]} />
            <View style={[styles.fogBlob, styles.fogBlob3, { backgroundColor: fogColor }]} />
            <View style={[styles.fogBlob, styles.fogBlob4, { backgroundColor: fogColor }]} />
          </Animated.View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardWrapper: {
    zIndex: 1,
  },
  glowBorder: {
    position: 'absolute',
    top: -4,
    left: -4,
  },
  fogLayer: {
    position: 'absolute',
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    borderRadius: SCREEN_WIDTH / 2,
  },
  fogBlob: {
    position: 'absolute',
    borderRadius: 100,
  },
  fogBlob1: {
    width: 200,
    height: 150,
    left: '10%',
    top: '20%',
  },
  fogBlob2: {
    width: 180,
    height: 180,
    right: '10%',
    top: '30%',
  },
  fogBlob3: {
    width: 220,
    height: 160,
    left: '20%',
    bottom: '20%',
  },
  fogBlob4: {
    width: 160,
    height: 140,
    right: '20%',
    bottom: '30%',
  },
});
