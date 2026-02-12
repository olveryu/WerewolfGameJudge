/**
 * TypingIndicator - AI 回复中的 ··· 动画气泡
 *
 * 三个圆点依次弹跳，表示 AI 正在思考/生成中。
 *
 * ✅ 允许：纯 UI 动画
 * ❌ 禁止：业务逻辑
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

import { borderRadius, spacing, type ThemeColors } from '@/theme';

interface TypingIndicatorProps {
  colors: ThemeColors;
}

const DOT_SIZE = 6;
const DOT_COUNT = 3;
const ANIMATION_DURATION = 400;
const STAGGER_DELAY = 150;

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ colors }) => {
  const dots = useRef(Array.from({ length: DOT_COUNT }, () => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * STAGGER_DELAY),
          Animated.timing(dot, {
            toValue: 1,
            duration: ANIMATION_DURATION,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: ANIMATION_DURATION,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
      ),
    );

    const composite = Animated.parallel(animations);
    composite.start();

    return () => composite.stop();
  }, [dots]);

  return (
    <View style={styles.row}>
      <View style={[styles.bubble, { backgroundColor: colors.background }]}>
        {dots.map((dot, i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: colors.textMuted },
              {
                transform: [
                  {
                    translateY: dot.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -4],
                    }),
                  },
                ],
                opacity: dot.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.4, 1],
                }),
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: spacing.tight,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    borderRadius: borderRadius.medium,
    borderBottomLeftRadius: 4,
    gap: 4,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
});
