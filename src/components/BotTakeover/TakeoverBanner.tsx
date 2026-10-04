/** 顶部细条：接管中状态，可左滑隐藏为小圆点。 */

import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { borderRadius, colors, componentSizes, fixed, spacing, textStyles } from '@/theme';
import { showConfirmAlert } from '@/utils/alertPresets';

interface TakeoverBannerProps {
  readonly seat: number;
  readonly displayName: string;
  readonly onRelease: () => void;
}

export const TakeoverBanner: React.FC<TakeoverBannerProps> = ({ seat, displayName, onRelease }) => {
  const [collapsed, setCollapsed] = useState(false);

  const confirmRelease = () => {
    showConfirmAlert('退出接管', `确定要退出对 ${seat + 1} 号位的接管吗？`, onRelease, {
      confirmText: '退出',
    });
  };

  if (collapsed) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`正在代打 ${seat + 1} 号位，点击展开`}
        onPress={() => setCollapsed(false)}
        style={styles.dot}
      >
        <Ionicons name="game-controller" size={componentSizes.icon.sm} color={colors.textInverse} />
      </Pressable>
    );
  }

  return (
    <View style={styles.banner}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="隐藏接管条"
        onPress={() => setCollapsed(true)}
        style={styles.collapseHit}
      >
        <Text style={styles.text}>
          <Ionicons name="game-controller-outline" size={componentSizes.icon.sm} /> 正在代打{' '}
          {seat + 1} 号位 · {displayName}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="退出接管"
        onPress={confirmRelease}
        style={styles.releaseButton}
      >
        <Text style={styles.releaseText}>退出</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 32,
    paddingHorizontal: spacing.small,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 90,
  },
  collapseHit: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
  },
  text: {
    ...textStyles.secondary,
    color: colors.textInverse,
  },
  releaseButton: {
    minWidth: fixed.minTouchTarget,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.small,
  },
  releaseText: {
    ...textStyles.secondarySemibold,
    color: colors.textInverse,
  },
  dot: {
    position: 'absolute',
    top: spacing.small,
    right: spacing.small,
    width: 24,
    height: 24,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 90,
  },
});
