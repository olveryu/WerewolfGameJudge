/**
 * FragmentAssemble - Fragment assembly reveal animation
 *
 * Features:
 * - Image fragments fly in from random positions
 * - Each fragment has rotation and scale animation
 * - Staggered animation for visual effect
 * - Flash on completion
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions } from 'react-native';
import { useColors, spacing, typography, borderRadius } from '../../../theme';
import type { RoleRevealEffectProps, RoleAlignment } from '../types';
import { ALIGNMENT_THEMES } from '../types';
import { CONFIG } from '../config';
import { canUseNativeDriver, getOptimalFragmentGrid } from '../utils/platform';
import { playSound } from '../utils/sound';
import { triggerHaptic } from '../utils/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function getAlignmentLabel(alignment: RoleAlignment): string {
  switch (alignment) {
    case 'wolf':
      return '狼人阵营';
    case 'god':
      return '神职阵营';
    default:
      return '平民阵营';
  }
}

interface FragmentData {
  id: string;
  row: number;
  col: number;
  initialX: number;
  initialY: number;
  initialRotation: number;
  initialScale: number;
  delay: number;
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
      // Deterministic position based on grid position
      const index = row * cols + col;
      const totalFrags = rows * cols;
      const angle = (index / totalFrags) * Math.PI * 2;
      const distanceVariation = (index % 3) / 3; // 0, 0.33, 0.66
      const distance =
        distanceRange[0] + distanceVariation * (distanceRange[1] - distanceRange[0]);

      const rotationVariation = ((index % 5) - 2) / 2; // -1 to 1
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
  enableSound = true,
  enableHaptics = true,
  testIDPrefix = 'fragment-assemble',
}) => {
  const colors = useColors();
  const config = CONFIG.fragment;
  const theme = ALIGNMENT_THEMES[role.alignment];

  const [showFlash, setShowFlash] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

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
    () => fragments.map(() => new Animated.Value(0)),
    [fragments]
  );

  const flashAnim = useMemo(() => new Animated.Value(0), []);
  const opacityAnim = useMemo(() => new Animated.Value(0), []);

  // Handle assembly complete
  const handleAssemblyComplete = useCallback(() => {
    if (enableSound) {
      playSound('confirm');
    }
    if (enableHaptics) {
      triggerHaptic('success', true);
    }

    // Flash effect
    setShowFlash(true);
    Animated.sequence([
      Animated.timing(flashAnim, {
        toValue: 1,
        duration: config.flashDuration / 2,
        useNativeDriver: canUseNativeDriver,
      }),
      Animated.timing(flashAnim, {
        toValue: 0,
        duration: config.flashDuration / 2,
        useNativeDriver: canUseNativeDriver,
      }),
    ]).start(() => {
      setIsComplete(true);
      onComplete();
    });
  }, [enableSound, enableHaptics, flashAnim, config.flashDuration, onComplete]);

  // Start assembly animation
  useEffect(() => {
    if (reducedMotion) {
      // Reduced motion: simple fade in
      animValues.forEach((anim) => anim.setValue(1));

      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: CONFIG.common.reducedMotionFadeDuration,
        useNativeDriver: canUseNativeDriver,
      }).start(() => {
        setIsComplete(true);
        onComplete();
      });
      return;
    }

    // Fade in container
    Animated.timing(opacityAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: canUseNativeDriver,
    }).start();

    // Animate all fragments with stagger
    const animations = fragments.map((frag, index) =>
      Animated.timing(animValues[index], {
        toValue: 1,
        duration: config.assembleDuration,
        delay: frag.delay,
        useNativeDriver: canUseNativeDriver,
      })
    );

    Animated.parallel(animations).start(handleAssemblyComplete);
  }, [
    reducedMotion,
    fragments,
    animValues,
    opacityAnim,
    config.assembleDuration,
    handleAssemblyComplete,
    onComplete,
  ]);

  return (
    <Animated.View
      testID={`${testIDPrefix}-container`}
      style={[
        styles.container,
        { backgroundColor: colors.background, opacity: opacityAnim },
      ]}
    >
      <Text style={[styles.title, { color: colors.text }]}>{role.name}</Text>

      {/* Card container */}
      <View
        style={[
          styles.cardContainer,
          {
            width: cardWidth,
            height: cardHeight,
            borderRadius: borderRadius.large,
          },
        ]}
      >
        {/* Background */}
        <View
          style={[
            styles.cardBackground,
            {
              backgroundColor: theme.gradientColors[0],
              borderColor: theme.primaryColor,
            },
          ]}
        />

        {/* Fragments */}
        {fragments.map((frag, index) => {
          const anim = animValues[index];

          const translateX = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [frag.initialX, 0],
          });

          const translateY = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [frag.initialY, 0],
          });

          const rotate = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [`${frag.initialRotation}deg`, '0deg'],
          });

          const scale = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [frag.initialScale, 1],
          });

          const opacity = anim.interpolate({
            inputRange: [0, 0.3, 1],
            outputRange: [0, 1, 1],
          });

          // Calculate fragment content based on position
          const isCenter = frag.row === Math.floor(rows / 2) && frag.col === Math.floor(cols / 2);

          return (
            <Animated.View
              key={frag.id}
              style={[
                styles.fragment,
                {
                  width: fragmentWidth,
                  height: fragmentHeight,
                  left: frag.col * fragmentWidth,
                  top: frag.row * fragmentHeight,
                  backgroundColor: theme.gradientColors[1],
                  borderColor: theme.primaryColor,
                  opacity,
                  transform: [
                    { translateX },
                    { translateY },
                    { rotate },
                    { scale },
                  ],
                },
              ]}
            >
              {isCenter && (
                <Text style={styles.fragmentIcon}>{role.avatar || '❓'}</Text>
              )}
            </Animated.View>
          );
        })}

        {/* Flash overlay */}
        {showFlash && (
          <Animated.View
            style={[
              styles.flashOverlay,
              {
                opacity: flashAnim,
                backgroundColor: theme.glowColor,
              },
            ]}
          />
        )}
      </View>

      {/* Alignment badge */}
      {isComplete && (
        <View
          style={[
            styles.alignmentBadge,
            { backgroundColor: theme.primaryColor },
          ]}
        >
          <Text style={styles.alignmentText}>
            {getAlignmentLabel(role.alignment)}
          </Text>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.heading,
    fontWeight: 'bold',
    marginBottom: spacing.large,
  },
  cardContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  cardBackground: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderRadius: borderRadius.large,
  },
  fragment: {
    position: 'absolute',
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fragmentIcon: {
    fontSize: 48,
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: borderRadius.large,
  },
  alignmentBadge: {
    marginTop: spacing.large,
    paddingHorizontal: spacing.xlarge,
    paddingVertical: spacing.medium,
    borderRadius: borderRadius.medium,
  },
  alignmentText: {
    color: '#FFFFFF',
    fontSize: typography.body,
    fontWeight: '600',
  },
});
