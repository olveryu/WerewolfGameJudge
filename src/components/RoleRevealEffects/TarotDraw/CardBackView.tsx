/**
 * CardBackView — 塔罗牌背面纯 RN View 实现
 *
 * 替代 Skia useTexture + SkiaImage。
 * 渲染：渐变背景 + 金色边框 + 新月 + 星形装饰 + 中央菱形。
 */
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { borderRadius } from '@/theme';

const TAROT_COLORS = {
  cardBack: ['#2a2a4e', '#3d3d64', '#2a2a4e'] as const,
  gold: '#d4af37',
  goldGlow: '#ffd700',
};

interface CardBackViewProps {
  width: number;
  height: number;
}

export const CardBackView: React.FC<CardBackViewProps> = React.memo(({ width, height }) => {
  const cx = width / 2;
  const moonY = height * 0.32;
  const starY = height * 0.48;
  const vineY = height * 0.62;

  return (
    <View style={[styles.container, { width, height, borderRadius: borderRadius.medium }]}>
      <LinearGradient
        colors={[...TAROT_COLORS.cardBack]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      {/* Gold border (inset) */}
      <View
        style={[
          styles.goldBorder,
          {
            top: 6,
            left: 6,
            width: width - 12,
            height: height - 12,
            borderRadius: borderRadius.small,
          },
        ]}
      />
      {/* Crescent moon */}
      <View style={[styles.moon, { top: moonY - 10, left: cx - 10 }]} />
      <View style={[styles.moonCutout, { top: moonY - 12, left: cx - 6 }]} />
      {/* Three sparkle stars */}
      {[-1, 0, 1].map((offset) => (
        <View
          key={`star-${offset}`}
          style={[styles.starDot, { top: starY - 2, left: cx + offset * 24 - 2 }]}
        />
      ))}
      {/* Vine dots */}
      <View style={[styles.vineDot, { top: vineY - 3, left: cx - 23 }]} />
      <View style={[styles.vineLine, { top: vineY - 0.5, left: cx - 12, width: 24 }]} />
      <View style={[styles.vineDot, { top: vineY - 3, left: cx + 17 }]} />
      {/* Central diamond */}
      <View style={[styles.diamond, { top: vineY - 5, left: cx - 4 }]} />
    </View>
  );
});
CardBackView.displayName = 'CardBackView';

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  goldBorder: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: TAROT_COLORS.gold,
  },
  moon: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: TAROT_COLORS.gold,
  },
  moonCutout: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#2a2a4e',
  },
  starDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: TAROT_COLORS.gold,
  },
  vineDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: TAROT_COLORS.gold,
    opacity: 0.5,
  },
  vineLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: TAROT_COLORS.gold,
    opacity: 0.4,
  },
  diamond: {
    position: 'absolute',
    width: 8,
    height: 10,
    backgroundColor: TAROT_COLORS.gold,
    opacity: 0.6,
    transform: [{ rotate: '45deg' }],
  },
});
