/**
 * Accessible indeterminate progress bar shared by bounded loading surfaces.
 *
 * The sweep is a Reanimated CSS animation (`animationName` keyframes): a real `@keyframes` rule
 * on web and a Reanimated-core animation on native, so the loop never touches the JS thread.
 * Honours the system reduced-motion preference by rendering the bar at rest.
 */

import { useState } from 'react';
import {
  type LayoutChangeEvent,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  type CSSAnimationProperties,
  cubicBezier,
  useReducedMotion,
} from 'react-native-reanimated';

import { colors, componentSizes } from '@/theme';

const BAR_WIDTH_RATIO = 0.3;
const PROGRESS_DURATION_MS = 1_500;
/** Penner easeInOutQuad — matches Reanimated's `withTiming` default `Easing.inOut(Easing.quad)`. */
const SWEEP_EASING = cubicBezier(0.455, 0.03, 0.515, 0.955);

interface IndeterminateProgressBarProps {
  readonly accessibilityLabel: string;
  /** Track style; merged over the default full-width themed track. */
  readonly style?: StyleProp<ViewStyle>;
  /** Moving bar style; merged over the default themed bar. */
  readonly barStyle?: StyleProp<ViewStyle>;
}

function sweepAnimation(barWidth: number, trackWidth: number): CSSAnimationProperties {
  return {
    animationName: {
      from: { transform: [{ translateX: -barWidth }] },
      to: { transform: [{ translateX: trackWidth }] },
    },
    animationDuration: PROGRESS_DURATION_MS,
    animationTimingFunction: SWEEP_EASING,
    animationIterationCount: 'infinite',
  };
}

/** Render a looping progress track without implying a measurable completion percentage. */
export function IndeterminateProgressBar({
  accessibilityLabel,
  style,
  barStyle,
}: IndeterminateProgressBarProps) {
  const reducedMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const barWidth = trackWidth * BAR_WIDTH_RATIO;
  const isSweeping = !reducedMotion && trackWidth > 0;

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
      <Animated.View
        style={[
          styles.bar,
          barStyle,
          { width: barWidth },
          isSweeping && sweepAnimation(barWidth, trackWidth),
        ]}
      />
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
