/**
 * GradientOverlay - Gradient mask for edge fading effects
 */
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

export interface GradientOverlayProps {
  /** Position of the gradient */
  position: 'top' | 'bottom' | 'left' | 'right';
  /** Height/width of the gradient area */
  size: number;
  /** Gradient color (typically the background color) */
  color: string;
  /** Additional style */
  style?: ViewStyle;
}

/**
 * Creates a gradient-like fade effect using multiple semi-transparent layers
 * This is a simpler alternative to LinearGradient that works everywhere
 */
export const GradientOverlay: React.FC<GradientOverlayProps> = ({
  position,
  size,
  color,
  style,
}) => {
  const layerCount = 8;

  const getPositionStyle = (): ViewStyle => {
    switch (position) {
      case 'top':
        return { top: 0, left: 0, right: 0, height: size };
      case 'bottom':
        return { bottom: 0, left: 0, right: 0, height: size };
      case 'left':
        return { left: 0, top: 0, bottom: 0, width: size };
      case 'right':
        return { right: 0, top: 0, bottom: 0, width: size };
    }
  };

  const getLayerStyle = (index: number): ViewStyle => {
    // Calculate opacity - more opaque at the edge, transparent toward center
    const progress = index / (layerCount - 1);
    const opacity = 1 - progress;

    const layerSize = size / layerCount;
    const offset = index * layerSize;

    const baseStyle: ViewStyle = {
      position: 'absolute',
      backgroundColor: color,
      opacity: opacity * 0.9, // Max opacity at edge
    };

    switch (position) {
      case 'top':
        return { ...baseStyle, top: offset, left: 0, right: 0, height: layerSize + 1 };
      case 'bottom':
        return { ...baseStyle, bottom: offset, left: 0, right: 0, height: layerSize + 1 };
      case 'left':
        return { ...baseStyle, left: offset, top: 0, bottom: 0, width: layerSize + 1 };
      case 'right':
        return { ...baseStyle, right: offset, top: 0, bottom: 0, width: layerSize + 1 };
    }
  };

  return (
    <View style={[styles.container, getPositionStyle(), style]} pointerEvents="none">
      {Array.from({ length: layerCount }).map((_, index) => (
        <View key={`gradient-layer-${position}-${index}`} style={getLayerStyle(index)} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    overflow: 'hidden',
  },
});
