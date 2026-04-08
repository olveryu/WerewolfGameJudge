/**
 * EqualizerBars — 均衡器竖条动画
 *
 * 3 根竖条做高度跳动循环，用 Animated API (useNativeDriver)。
 * 纯 UI 组件：接收 active + color，不 import service。
 */
import { memo, useEffect, useState } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';

import { borderRadius, spacing, type ThemeColors } from '@/theme';

const BAR_COUNT = 3;
const BAR_WIDTH = 3;
const BAR_MAX_HEIGHT = 14;
const BAR_MIN_HEIGHT = 3;
const DURATIONS = [400, 550, 350]; // staggered per bar

function createAnimValues(): Animated.Value[] {
  return Array.from({ length: BAR_COUNT }, () => new Animated.Value(BAR_MIN_HEIGHT));
}

interface EqualizerBarsProps {
  active: boolean;
  colors: ThemeColors;
}

export const EqualizerBars = memo<EqualizerBarsProps>(function EqualizerBars({ active, colors }) {
  // useState (not useRef) because Animated.Values are consumed during render
  const [anims] = useState(createAnimValues);

  useEffect(() => {
    if (active) {
      const loops = anims.map((anim, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: BAR_MAX_HEIGHT,
              duration: DURATIONS[i],
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: BAR_MIN_HEIGHT,
              duration: DURATIONS[i],
              useNativeDriver: false,
            }),
          ]),
        ),
      );
      loops.forEach((l) => l.start());
      return () => loops.forEach((l) => l.stop());
    } else {
      anims.forEach((anim) => {
        anim.stopAnimation();
        Animated.timing(anim, {
          toValue: BAR_MIN_HEIGHT,
          duration: 150,
          useNativeDriver: false,
        }).start();
      });
    }
  }, [active, anims]);

  return (
    <View style={styles.container}>
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            {
              height: anim,
              backgroundColor: colors.primary,
            },
          ]}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create<{ container: ViewStyle; bar: ViewStyle }>({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.micro,
    height: BAR_MAX_HEIGHT,
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: borderRadius.small,
  },
});
