/**
 * VolumeSlider — 音量滑块组件
 *
 * 基于 react-native-awesome-slider（Reanimated + Gesture Handler），
 * 全程 UI Thread 驱动，拖动丝滑无延迟。
 * 自定义 thumb（白底+阴影+主色内圆）+ 左右音量图标。
 * 纯 Presentational 组件：接收 value + onValueChange 回调，不 import service。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, type TextStyle, View, type ViewStyle } from 'react-native';
import { Slider } from 'react-native-awesome-slider';
import { useSharedValue } from 'react-native-reanimated';

import { borderRadius, colors, componentSizes, shadows, spacing, type ThemeColors } from '@/theme';

const SLIDER_HEIGHT = 10;
const THUMB_OUTER = 32;
const THUMB_INNER = 16;

interface VolumeSliderProps {
  value: number; // 0.0–1.0
  onValueChange: (value: number) => void;
  /** Called when user releases the slider */
  onSlidingComplete?: (value: number) => void;
  colors: ThemeColors;
}

export const VolumeSlider = memo<VolumeSliderProps>(function VolumeSlider({
  value,
  onValueChange,
  onSlidingComplete,
}) {
  const progress = useSharedValue(value);
  const min = useSharedValue(0);
  const max = useSharedValue(100);

  // Sync external value → shared value (e.g. on initial load)
  useEffect(() => {
    progress.value = Math.round(value * 100);
  }, [value, progress]);

  const handleValueChange = useCallback(
    (v: number) => {
      onValueChange(v / 100);
    },
    [onValueChange],
  );

  const handleSlidingComplete = useCallback(
    (v: number) => {
      onSlidingComplete?.(v / 100);
    },
    [onSlidingComplete],
  );

  const formatBubble = useCallback((v: number) => `${Math.round(v)}%`, []);

  const theme = useMemo(
    () => ({
      minimumTrackTintColor: colors.primary,
      maximumTrackTintColor: colors.border,
      bubbleBackgroundColor: colors.primary,
    }),
    [],
  );

  const styles = useMemo(() => getStyles(colors), []);

  const renderThumb = useCallback(
    () => (
      <View style={styles.thumbOuter}>
        <View style={[styles.thumbInner, { backgroundColor: colors.primary }]} />
      </View>
    ),
    [styles],
  );

  return (
    <View style={styles.container}>
      <Ionicons name="volume-low" size={componentSizes.icon.sm} color={colors.textSecondary} />
      <View style={styles.sliderWrap}>
        <Slider
          progress={progress}
          minimumValue={min}
          maximumValue={max}
          onValueChange={handleValueChange}
          onSlidingComplete={handleSlidingComplete}
          theme={theme}
          sliderHeight={SLIDER_HEIGHT}
          thumbWidth={THUMB_OUTER}
          renderThumb={renderThumb}
          bubble={formatBubble}
          containerStyle={styles.slider}
        />
      </View>
      <Ionicons name="volume-high" size={componentSizes.icon.sm} color={colors.textSecondary} />
    </View>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

interface SliderStyles {
  container: ViewStyle;
  sliderWrap: ViewStyle;
  slider: ViewStyle;
  thumbOuter: ViewStyle;
  thumbInner: ViewStyle;
  label: TextStyle;
}

function getStyles(colors: ThemeColors): SliderStyles {
  return StyleSheet.create<SliderStyles>({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
    },
    sliderWrap: {
      flex: 1,
      justifyContent: 'center',
    },
    slider: {
      borderRadius: borderRadius.full,
    },
    thumbOuter: {
      width: THUMB_OUTER,
      height: THUMB_OUTER,
      borderRadius: THUMB_OUTER / 2,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      ...shadows.md,
    },
    thumbInner: {
      width: THUMB_INNER,
      height: THUMB_INNER,
      borderRadius: THUMB_INNER / 2,
    },
    label: {
      // kept for potential future use
    },
  });
}
