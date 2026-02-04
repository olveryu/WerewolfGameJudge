/**
 * ShineEffect - Animated light sweep effect
 */
import React, { useEffect, useMemo } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { canUseNativeDriver } from '../utils/platform';

export interface ShineEffectProps {
  /** Width of the container */
  width: number;
  /** Height of the container */
  height: number;
  /** Shine color */
  color?: string;
  /** Animation duration */
  duration?: number;
  /** Delay before starting */
  delay?: number;
  /** Whether to animate */
  active: boolean;
  /** Callback when animation completes */
  onComplete?: () => void;
  /** Additional style */
  style?: ViewStyle;
}

export const ShineEffect: React.FC<ShineEffectProps> = ({
  width,
  height,
  color = 'rgba(255, 255, 255, 0.6)',
  duration = 400,
  delay = 0,
  active,
  onComplete,
  style,
}) => {
  const translateX = useMemo(() => new Animated.Value(-width * 0.5), [width]);
  const opacity = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    if (!active) {
      translateX.setValue(-width * 0.5);
      opacity.setValue(0);
      return;
    }

    // Reset position
    translateX.setValue(-width * 0.5);
    opacity.setValue(0);

    // Animate sweep
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 50,
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(translateX, {
          toValue: width * 1.5,
          duration,
          useNativeDriver: canUseNativeDriver,
        }),
      ]),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 50,
        useNativeDriver: canUseNativeDriver,
      }),
    ]).start(() => {
      onComplete?.();
    });
  }, [active, width, duration, delay, translateX, opacity, onComplete]);

  if (!active) return null;

  return (
    <View style={[styles.container, { width, height }, style]} pointerEvents="none">
      <Animated.View
        style={[
          styles.shine,
          {
            height,
            opacity,
            transform: [{ translateX }, { rotate: '-20deg' }],
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    overflow: 'hidden',
  },
  shine: {
    position: 'absolute',
    width: 40,
    top: -20,
    bottom: -20,
  },
});
