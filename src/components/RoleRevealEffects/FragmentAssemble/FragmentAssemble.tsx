/**
 * FragmentAssemble - Enhanced fragment assembly reveal animation
 *
 * Features:
 * - 3D flip effect on each fragment
 * - Metallic edge sheen
 * - Spark particles on assembly
 * - Shake effect on completion
 * - Glowing border pulse
 * - Shockwave on reveal
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
import { canUseNativeDriver, getOptimalFragmentGrid } from '../utils/platform';
import { triggerHaptic } from '../utils/haptics';
import { RoleCardContent } from '../common/RoleCardContent';
import { GlowBorder } from '../common/GlowBorder';
import type { RoleId } from '../../../models/roles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Colors for effects
const EFFECT_COLORS = {
  spark: ['#FFD700', '#FFA500', '#FF6347', '#FFFFFF'],
  shockwave: 'rgba(255, 215, 0, 0.6)',
  metalSheen: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.4)', 'rgba(255,255,255,0)'],
};

interface FragmentData {
  id: string;
  row: number;
  col: number;
  initialX: number;
  initialY: number;
  initialRotation: number;
  initialScale: number;
  flipDirection: 'horizontal' | 'vertical';
  delay: number;
}

interface SparkParticle {
  id: number;
  x: Animated.Value;
  y: Animated.Value;
  scale: Animated.Value;
  opacity: Animated.Value;
  color: string;
}

// Generate deterministic fragment positions based on grid position
function generateFragmentData(
  rows: number,
  cols: number,
  distanceRange: readonly [number, number],
  rotationRange: readonly [number, number],
  scaleRange: readonly [number, number],
  staggerDelay: number
): FragmentData[] {
  const frags: FragmentData[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      const totalFrags = rows * cols;
      const angle = (index / totalFrags) * Math.PI * 2;
      const distanceVariation = (index % 3) / 3;
      const distance =
        distanceRange[0] + distanceVariation * (distanceRange[1] - distanceRange[0]);

      const rotationVariation = ((index % 5) - 2) / 2;
      const rotation =
        rotationRange[0] +
        ((rotationVariation + 1) / 2) * (rotationRange[1] - rotationRange[0]);

      const scaleVariation = (index % 4) / 4;
      const scale = scaleRange[0] + scaleVariation * (scaleRange[1] - scaleRange[0]);

      frags.push({
        id: `fragment-${row}-${col}`,
        row,
        col,
        initialX: Math.cos(angle) * distance,
        initialY: Math.sin(angle) * distance,
        initialRotation: rotation,
        initialScale: scale,
        flipDirection: index % 2 === 0 ? 'horizontal' : 'vertical',
        delay: index * staggerDelay,
      });
    }
  }
  return frags;
}

export const FragmentAssemble: React.FC<RoleRevealEffectProps> = ({
  role,
  onComplete,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'fragment-assemble',
}) => {
  const colors = useColors();
  const config = CONFIG.fragment;
  const theme = ALIGNMENT_THEMES[role.alignment];

  const [phase, setPhase] = useState<'assembling' | 'complete'>('assembling');
  const [sparks, setSparks] = useState<SparkParticle[]>([]);

  // Calculate optimal grid size
  const { rows, cols } = useMemo(
    () => getOptimalFragmentGrid(config.gridRows, config.gridCols),
    [config.gridRows, config.gridCols]
  );

  const cardWidth = Math.min(280, SCREEN_WIDTH * 0.75);
  const cardHeight = cardWidth * 1.3;
  const fragmentWidth = cardWidth / cols;
  const fragmentHeight = cardHeight / rows;

  // Generate fragment data (deterministic)
  const fragments = useMemo<FragmentData[]>(
    () =>
      generateFragmentData(
        rows,
        cols,
        config.initialDistanceRange,
        config.initialRotationRange,
        config.initialScaleRange,
        config.staggerDelay
      ),
    [
      rows,
      cols,
      config.initialDistanceRange,
      config.initialRotationRange,
      config.initialScaleRange,
      config.staggerDelay,
    ]
  );

  // Animation values for each fragment
  const animValues = useMemo(
    () => fragments.map(() => ({
      progress: new Animated.Value(0),
      flip: new Animated.Value(0),
      sheen: new Animated.Value(0),
    })),
    [fragments]
  );

  // Global animation values
  const shakeAnim = useMemo(() => new Animated.Value(0), []);
  const shockwaveScale = useMemo(() => new Animated.Value(0), []);
  const shockwaveOpacity = useMemo(() => new Animated.Value(0.8), []);

  // Create spark particles at fragment positions
  const createSparks = useCallback((fragmentIndex: number) => {
    const fragment = fragments[fragmentIndex];
    const centerX = (fragment.col + 0.5) * fragmentWidth - cardWidth / 2;
    const centerY = (fragment.row + 0.5) * fragmentHeight - cardHeight / 2;
    
    const newSparks: SparkParticle[] = [];
    const sparkCount = 3;

    for (let i = 0; i < sparkCount; i++) {
      const angle = (Math.PI * 2 * i) / sparkCount + (fragmentIndex * 0.5);
      const distance = 20 + (fragmentIndex % 3) * 10;
      const targetX = centerX + Math.cos(angle) * distance;
      const targetY = centerY + Math.sin(angle) * distance;

      const spark: SparkParticle = {
        id: fragmentIndex * 100 + i,
        x: new Animated.Value(centerX),
        y: new Animated.Value(centerY),
        scale: new Animated.Value(1),
        opacity: new Animated.Value(1),
        color: EFFECT_COLORS.spark[i % EFFECT_COLORS.spark.length],
      };

      newSparks.push(spark);

      // Animate spark
      Animated.parallel([
        Animated.timing(spark.x, {
          toValue: targetX,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(spark.y, {
          toValue: targetY,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(spark.scale, {
          toValue: 0,
          duration: 300,
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(spark.opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: canUseNativeDriver,
        }),
      ]).start();
    }

    setSparks((prev) => [...prev, ...newSparks]);
  }, [fragments, fragmentWidth, fragmentHeight, cardWidth, cardHeight]);

  // Handle assembly complete
  const handleAssemblyComplete = useCallback(() => {
    if (enableHaptics) {
      triggerHaptic('heavy', true);
    }

    // Shake effect
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: canUseNativeDriver }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: canUseNativeDriver }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: canUseNativeDriver }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: canUseNativeDriver }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 50, useNativeDriver: canUseNativeDriver }),
      Animated.timing(shakeAnim, { toValue: -5, duration: 50, useNativeDriver: canUseNativeDriver }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: canUseNativeDriver }),
    ]).start();

    // Shockwave effect
    Animated.parallel([
      Animated.timing(shockwaveScale, {
        toValue: 2,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: canUseNativeDriver,
      }),
      Animated.timing(shockwaveOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: canUseNativeDriver,
      }),
    ]).start();

    setPhase('complete');
  }, [enableHaptics, shakeAnim, shockwaveScale, shockwaveOpacity]);

  // Handle glow complete
  const handleGlowComplete = useCallback(() => {
    setTimeout(() => {
      onComplete();
    }, config.revealHoldDuration);
  }, [onComplete, config.revealHoldDuration]);

  // Start fragment animation
  useEffect(() => {
    if (reducedMotion) {
      animValues.forEach((anim) => {
        anim.progress.setValue(1);
        anim.flip.setValue(1);
      });
      setPhase('complete');
      return;
    }

    // Animate each fragment with stagger
    const animations = fragments.map((fragment, index) => {
      const delay = fragment.delay;

      // Progress animation (position, rotation, scale)
      const progressAnim = Animated.timing(animValues[index].progress, {
        toValue: 1,
        duration: config.assembleDuration,
        delay,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: canUseNativeDriver,
      });

      // Flip animation
      const flipAnim = Animated.timing(animValues[index].flip, {
        toValue: 1,
        duration: config.assembleDuration * 0.8,
        delay: delay + config.assembleDuration * 0.2,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: canUseNativeDriver,
      });

      // Sheen animation
      const sheenAnim = Animated.timing(animValues[index].sheen, {
        toValue: 1,
        duration: 400,
        delay: delay + config.assembleDuration * 0.7,
        useNativeDriver: canUseNativeDriver,
      });

      // Create sparks when fragment arrives
      setTimeout(() => {
        createSparks(index);
      }, delay + config.assembleDuration * 0.9);

      return Animated.parallel([progressAnim, flipAnim, sheenAnim]);
    });

    Animated.stagger(0, animations).start(() => {
      handleAssemblyComplete();
    });
  }, [
    reducedMotion,
    fragments,
    animValues,
    config.assembleDuration,
    createSparks,
    handleAssemblyComplete,
  ]);

  // Render fragment
  const renderFragment = (fragment: FragmentData, index: number) => {
    const anim = animValues[index];

    // Position interpolation
    const translateX = anim.progress.interpolate({
      inputRange: [0, 1],
      outputRange: [fragment.initialX, 0],
    });

    const translateY = anim.progress.interpolate({
      inputRange: [0, 1],
      outputRange: [fragment.initialY, 0],
    });

    // Rotation interpolation
    const rotate = anim.progress.interpolate({
      inputRange: [0, 1],
      outputRange: [`${fragment.initialRotation}deg`, '0deg'],
    });

    // Scale interpolation
    const scale = anim.progress.interpolate({
      inputRange: [0, 0.8, 1],
      outputRange: [fragment.initialScale, 1.1, 1],
    });

    // 3D flip interpolation
    const flipRotate = anim.flip.interpolate({
      inputRange: [0, 1],
      outputRange: ['180deg', '0deg'],
    });

    // Sheen position
    const sheenTranslate = anim.sheen.interpolate({
      inputRange: [0, 1],
      outputRange: [-fragmentWidth, fragmentWidth],
    });

    // Fragment position on the card
    const left = fragment.col * fragmentWidth;
    const top = fragment.row * fragmentHeight;

    return (
      <Animated.View
        key={fragment.id}
        style={[
          styles.fragment,
          {
            width: fragmentWidth,
            height: fragmentHeight,
            left: left - cardWidth / 2,
            top: top - cardHeight / 2,
            transform: [
              { translateX },
              { translateY },
              { rotate },
              { scale },
              fragment.flipDirection === 'horizontal'
                ? { rotateY: flipRotate }
                : { rotateX: flipRotate },
            ],
          },
        ]}
      >
        {/* Fragment content - clip from the full card */}
        <View
          style={[
            styles.fragmentContent,
            {
              width: cardWidth,
              height: cardHeight,
              left: -left,
              top: -top,
            },
          ]}
        >
          <RoleCardContent
            roleId={role.id as RoleId}
            width={cardWidth}
            height={cardHeight}
          />
        </View>

        {/* Metallic edge */}
        <View style={styles.metallicEdge}>
          <LinearGradient
            colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.2)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {/* Sheen sweep */}
        <Animated.View
          style={[
            styles.sheen,
            {
              transform: [{ translateX: sheenTranslate }],
            },
          ]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.4)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </Animated.View>
    );
  };

  return (
    <View
      testID={`${testIDPrefix}-container`}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Shockwave */}
      <Animated.View
        style={[
          styles.shockwave,
          {
            width: cardWidth * 1.5,
            height: cardHeight * 1.5,
            borderRadius: borderRadius.large,
            borderColor: theme.primaryColor,
            transform: [{ scale: shockwaveScale }],
            opacity: shockwaveOpacity,
          },
        ]}
      />

      {/* Main content with shake */}
      <Animated.View
        style={[
          styles.cardContainer,
          {
            width: cardWidth,
            height: cardHeight,
            transform: [{ translateX: shakeAnim }],
          },
        ]}
      >
        {/* Fragments */}
        {fragments.map((fragment, index) => renderFragment(fragment, index))}

        {/* Spark particles */}
        {sparks.map((spark) => (
          <Animated.View
            key={spark.id}
            style={[
              styles.spark,
              {
                backgroundColor: spark.color,
                transform: [
                  { translateX: spark.x },
                  { translateY: spark.y },
                  { scale: spark.scale },
                ],
                opacity: spark.opacity,
              },
            ]}
          />
        ))}

        {/* Glow border on complete */}
        {phase === 'complete' && (
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
              top: -cardHeight / 2 - 4,
              left: -cardWidth / 2 - 4,
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
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fragment: {
    position: 'absolute',
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
  },
  fragmentContent: {
    position: 'absolute',
  },
  metallicEdge: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 30,
    opacity: 0.6,
  },
  spark: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  shockwave: {
    position: 'absolute',
    borderWidth: 3,
  },
});
