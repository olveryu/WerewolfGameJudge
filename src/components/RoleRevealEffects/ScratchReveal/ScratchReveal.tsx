/**
 * ScratchReveal - Scratch card style reveal animation
 *
 * Features:
 * - Touch-based scratch to reveal
 * - Auto-reveal at threshold
 * - Auto-complete button for accessibility
 * - Reduced motion: tap to reveal
 */
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  PanResponder,
  Animated,
} from 'react-native';
import { useColors, spacing, typography, borderRadius } from '../../../theme';
import type { RoleRevealEffectProps } from '../types';
import { ALIGNMENT_THEMES } from '../types';
import { CONFIG } from '../config';
import { canUseNativeDriver } from '../utils/platform';
import { playSound } from '../utils/sound';
import { triggerHaptic } from '../utils/haptics';
import { RoleCard } from '../common/RoleCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ScratchPoint {
  x: number;
  y: number;
  id: string;
}

export const ScratchReveal: React.FC<RoleRevealEffectProps> = ({
  role,
  onComplete,
  reducedMotion = false,
  enableSound = true,
  enableHaptics = true,
  testIDPrefix = 'scratch-reveal',
}) => {
  const colors = useColors();
  const config = CONFIG.scratch;
  const theme = ALIGNMENT_THEMES[role.alignment];

  const [scratchPoints, setScratchPoints] = useState<ScratchPoint[]>([]);
  const [isRevealed, setIsRevealed] = useState(false);
  const [scratchProgress, setScratchProgress] = useState(0);

  const revealAnim = useMemo(() => new Animated.Value(0), []);
  const containerRef = useRef<View>(null);
  const layoutRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const gridRef = useRef<Set<string>>(new Set());

  const cardWidth = Math.min(260, SCREEN_WIDTH * 0.75);
  const cardHeight = cardWidth * 1.4;

  // Pre-generate pattern dot colors to avoid Math.random during render
  // This is frozen on mount to ensure consistent rendering
  const [patternDotColors] = useState<string[][]>(() => {
    const rows = 5;
    const cols = 5;
    const result: string[][] = [];
    for (let row = 0; row < rows; row++) {
      const rowColors: string[] = [];
      for (let col = 0; col < cols; col++) {
        const colorIndex = Math.floor(Math.random() * config.patternColors.length);
        rowColors.push(config.patternColors[colorIndex]);
      }
      result.push(rowColors);
    }
    return result;
  });

  // Calculate scratch progress based on grid cells scratched
  const calculateProgress = useCallback(() => {
    const totalCells =
      Math.ceil(cardWidth / config.gridSize) * Math.ceil(cardHeight / config.gridSize);
    return gridRef.current.size / totalCells;
  }, [cardWidth, cardHeight, config.gridSize]);

  // Handle reveal animation
  const triggerReveal = useCallback(() => {
    if (isRevealed) return;
    setIsRevealed(true);

    if (enableSound) {
      playSound('confirm');
    }
    if (enableHaptics) {
      triggerHaptic('success', true);
    }

    Animated.timing(revealAnim, {
      toValue: 1,
      duration: config.revealDuration,
      useNativeDriver: canUseNativeDriver,
    }).start(() => {
      onComplete();
    });
  }, [isRevealed, revealAnim, config.revealDuration, enableSound, enableHaptics, onComplete]);

  // Add scratch point and update grid
  const addScratchPoint = useCallback(
    (x: number, y: number) => {
      if (isRevealed) return;

      // Add to grid for progress tracking
      const gridX = Math.floor(x / config.gridSize);
      const gridY = Math.floor(y / config.gridSize);

      // Also mark nearby cells for brush radius
      const brushCells = Math.ceil(config.brushRadius / config.gridSize);
      for (let dx = -brushCells; dx <= brushCells; dx++) {
        for (let dy = -brushCells; dy <= brushCells; dy++) {
          gridRef.current.add(`${gridX + dx},${gridY + dy}`);
        }
      }

      // Add visual scratch point
      const newPoint: ScratchPoint = {
        x,
        y,
        id: `scratch-${Date.now()}-${Math.random()}`,
      };
      setScratchPoints((prev) => [...prev, newPoint]);

      // Update progress
      const progress = calculateProgress();
      setScratchProgress(progress);

      // Check threshold
      if (progress >= config.autoRevealThreshold) {
        triggerReveal();
      }
    },
    [isRevealed, config, calculateProgress, triggerReveal]
  );

  // Refs to store latest values for PanResponder (avoids closure issues)
  // This is the standard "latest ref" pattern for React Native gesture handlers.
  const isRevealedRef = useRef(isRevealed);
  const reducedMotionRef = useRef(reducedMotion);
  const addScratchPointRef = useRef(addScratchPoint);

  // Keep refs in sync with latest values
  useEffect(() => {
    isRevealedRef.current = isRevealed;
  }, [isRevealed]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    addScratchPointRef.current = addScratchPoint;
  }, [addScratchPoint]);

  /**
   * PanResponder for scratch gestures.
   *
   * WHY eslint-disable is needed here (react-hooks/refs):
   * - The linter flags passing refs to functions as potentially unsafe
   * - However, PanResponder callbacks execute at RUNTIME (not during render)
   * - We use the "latest ref" pattern: refs are updated via useEffect, callbacks read them
   * - This is the standard React Native pattern for gesture handlers with dynamic state
   * - The ref reads happen in event handlers (onPanResponderGrant/Move), not during render
   *
   * Alternative approaches considered and rejected:
   * - Recreating PanResponder on state change: causes gesture interruption
   * - Passing state directly: creates stale closure issues
   */
  /* eslint-disable react-hooks/refs -- Safe: refs read at runtime in event handlers, not during render */
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () =>
          !reducedMotionRef.current && !isRevealedRef.current,
        onMoveShouldSetPanResponder: () =>
          !reducedMotionRef.current && !isRevealedRef.current,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          addScratchPointRef.current(locationX, locationY);
        },
        onPanResponderMove: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          addScratchPointRef.current(locationX, locationY);
        },
      }),
    []
  );
  /* eslint-enable react-hooks/refs */

  // Handle tap for reduced motion
  const handleTapReveal = useCallback(() => {
    if (reducedMotion) {
      triggerReveal();
    }
  }, [reducedMotion, triggerReveal]);

  // Reduced motion: auto-reveal on mount
  useEffect(() => {
    if (reducedMotion) {
      // Show the card immediately with fade
      const timer = setTimeout(() => {
        triggerReveal();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [reducedMotion, triggerReveal]);

  // Overlay opacity for reveal
  const overlayOpacity = revealAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  return (
    <View
      testID={`${testIDPrefix}-container`}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <Text style={[styles.instruction, { color: colors.textSecondary }]}>
        {reducedMotion ? '点击揭示身份' : `刮开卡片查看身份 (${Math.round(scratchProgress * 100)}%)`}
      </Text>

      <View
        ref={containerRef}
        style={[styles.cardContainer, { width: cardWidth, height: cardHeight }]}
        onLayout={(e) => {
          layoutRef.current = e.nativeEvent.layout;
        }}
        {...(reducedMotion ? {} : panResponder.panHandlers)}
      >
        {/* Role card underneath */}
        <RoleCard
          role={role}
          width={cardWidth}
          height={cardHeight}
          testID={`${testIDPrefix}-card`}
        />

        {/* Scratch overlay */}
        <Animated.View
          style={[
            styles.overlay,
            {
              backgroundColor: config.overlayColor,
              opacity: overlayOpacity,
              borderRadius: borderRadius.large,
            },
          ]}
          pointerEvents={isRevealed ? 'none' : 'auto'}
        >
          {/* Scratch pattern */}
          <View style={styles.patternContainer}>
            {[0, 1, 2, 3, 4].map((row) =>
              [0, 1, 2, 3, 4].map((col) => (
                <View
                  key={`pattern-${row}-${col}`}
                  style={[
                    styles.patternDot,
                    {
                      backgroundColor: patternDotColors[row][col],
                      left: `${20 * col + 10}%`,
                      top: `${20 * row + 10}%`,
                    },
                  ]}
                />
              ))
            )}
          </View>

          {/* Scratch holes */}
          {scratchPoints.map((point) => (
            <View
              key={point.id}
              style={[
                styles.scratchHole,
                {
                  left: point.x - config.brushRadius,
                  top: point.y - config.brushRadius,
                  width: config.brushRadius * 2,
                  height: config.brushRadius * 2,
                  borderRadius: config.brushRadius,
                },
              ]}
            />
          ))}

          {/* Hint text */}
          {!reducedMotion && scratchProgress < 0.1 && (
            <View style={styles.hintContainer}>
              <Text style={styles.hintText}>刮一刮</Text>
              <Text style={styles.hintIcon}>👆</Text>
            </View>
          )}
        </Animated.View>

        {/* Tap overlay for reduced motion */}
        {reducedMotion && !isRevealed && (
          <TouchableOpacity
            style={styles.tapOverlay}
            onPress={handleTapReveal}
            testID={`${testIDPrefix}-tap-reveal`}
          >
            <Text style={styles.tapText}>点击揭示</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Auto-complete button */}
      {!reducedMotion && !isRevealed && (
        <TouchableOpacity
          style={[styles.autoButton, { backgroundColor: theme.primaryColor }]}
          onPress={triggerReveal}
          testID={`${testIDPrefix}-auto-reveal`}
        >
          <Text style={styles.autoButtonText}>直接揭示</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.large,
  },
  instruction: {
    fontSize: typography.body,
    marginBottom: spacing.large,
  },
  cardContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: borderRadius.large,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  patternContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  patternDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.3,
  },
  scratchHole: {
    position: 'absolute',
    backgroundColor: 'transparent',
    // Use a "punch through" effect by making the hole transparent
    // In React Native, we simulate this with a shadow trick
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    // Actually hide the overlay in this spot
    borderWidth: 0,
  },
  hintContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintText: {
    color: '#FFFFFF',
    fontSize: typography.title,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  hintIcon: {
    fontSize: 32,
    marginTop: spacing.small,
  },
  tapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.large,
  },
  tapText: {
    color: '#FFFFFF',
    fontSize: typography.title,
    fontWeight: 'bold',
  },
  autoButton: {
    marginTop: spacing.xlarge,
    paddingHorizontal: spacing.xlarge,
    paddingVertical: spacing.medium,
    borderRadius: borderRadius.medium,
  },
  autoButtonText: {
    color: '#FFFFFF',
    fontSize: typography.body,
    fontWeight: '600',
  },
});
