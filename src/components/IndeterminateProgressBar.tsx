/** Accessible indeterminate progress bar shared by bounded loading surfaces. */

import { useEffect, useState } from 'react';
import {
  type LayoutChangeEvent,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors, componentSizes } from '@/theme';

const BAR_WIDTH_RATIO = 0.3;
const PROGRESS_DURATION_MS = 1_500;

interface IndeterminateProgressBarProps {
  readonly accessibilityLabel: string;
  readonly style?: StyleProp<ViewStyle>;
}

/** Render a looping progress track without implying a measurable completion percentage. */
export function IndeterminateProgressBar({
  accessibilityLabel,
  style,
}: IndeterminateProgressBarProps) {
  const reducedMotion = useReducedMotion();
  const progressValue = useSharedValue(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const barWidth = trackWidth * BAR_WIDTH_RATIO;

  useEffect(() => {
    if (reducedMotion || trackWidth === 0) {
      cancelAnimation(progressValue);
      progressValue.value = 0;
      return;
    }
    progressValue.value = 0;
    progressValue.value = withRepeat(withTiming(1, { duration: PROGRESS_DURATION_MS }), -1);
    return () => cancelAnimation(progressValue);
  }, [progressValue, reducedMotion, trackWidth]);

  const progressStyle = useAnimatedStyle(() => ({
    width: barWidth,
    transform: [
      {
        translateX: reducedMotion
          ? 0
          : interpolate(progressValue.value, [0, 1], [-barWidth, trackWidth]),
      },
    ],
  }));

  const handleLayout = (event: LayoutChangeEvent): void => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      onLayout={handleLayout}
      style={[styles.track, style]}
    >
      <Animated.View style={[styles.bar, progressStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    height: componentSizes.progressBar.height,
    borderRadius: componentSizes.progressBar.borderRadius,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  bar: {
    height: '100%',
    borderRadius: componentSizes.progressBar.borderRadius,
    backgroundColor: colors.primary,
  },
});
