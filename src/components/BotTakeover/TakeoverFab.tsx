/** 右下角浮钮：待机半透明，紧急时变红呼吸。 */

import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { borderRadius, colors, componentSizes, fixed, spacing, textStyles } from '@/theme';

interface TakeoverFabProps {
  readonly botCount: number;
  readonly isUrgent: boolean;
  readonly onPress: () => void;
}

export const TakeoverFab: React.FC<TakeoverFabProps> = ({ botCount, isUrgent, onPress }) => {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isUrgent) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isUrgent, pulse]);

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale: pulse }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          isUrgent
            ? `机器人需要接管，有 ${botCount} 个机器人`
            : `机器人接管，有 ${botCount} 个机器人`
        }
        onPress={onPress}
        style={[styles.fab, isUrgent ? styles.fabUrgent : styles.fabIdle]}
      >
        <Ionicons
          name="game-controller-outline"
          size={componentSizes.icon.md}
          color={isUrgent ? colors.textInverse : colors.text}
        />
        <View style={[styles.badge, isUrgent && styles.badgeUrgent]}>
          <Text style={[styles.badgeText, isUrgent && styles.badgeTextUrgent]}>
            {isUrgent ? '!' : String(botCount)}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    right: spacing.medium,
    bottom: spacing.medium,
    zIndex: 100,
  },
  fab: {
    width: fixed.minTouchTarget,
    height: fixed.minTouchTarget,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: fixed.borderWidth,
  },
  fabIdle: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    opacity: 0.6,
  },
  fabUrgent: {
    backgroundColor: colors.error,
    borderColor: colors.error,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: componentSizes.badge.dot * 2,
    height: componentSizes.badge.dot * 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.tight / 2,
  },
  badgeUrgent: {
    backgroundColor: colors.textInverse,
  },
  badgeText: {
    ...textStyles.caption,
    color: colors.textInverse,
  },
  badgeTextUrgent: {
    color: colors.error,
  },
});
