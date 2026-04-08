/**
 * VolumeSlider — 简单音量滑块组件
 *
 * 使用 PanResponder 实现水平拖拽。展示当前值百分比。
 * 纯 UI 组件：接收 value + onValueChange 回调，不 import service。
 */
import { memo, useCallback, useMemo, useRef } from 'react';
import {
  type LayoutChangeEvent,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';

import { borderRadius, spacing, type ThemeColors, typography } from '@/theme';

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
  colors,
}) {
  const trackWidthRef = useRef(0);

  const clamp = (v: number) => Math.max(0, Math.min(1, v));

  const resolveValue = useCallback(
    (pageX: number, trackX: number) => {
      const width = trackWidthRef.current;
      if (width <= 0) return value;
      return clamp((pageX - trackX) / width);
    },
    [value],
  );

  const trackRef = useRef<View>(null);

  /* eslint-disable react-hooks/refs -- trackRef is only read in PanResponder event callbacks, not during render */
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          trackRef.current?.measure((_x, _y, _w, _h, pageX) => {
            const newVal = resolveValue(evt.nativeEvent.pageX, pageX);
            onValueChange(newVal);
          });
        },
        onPanResponderMove: (evt) => {
          trackRef.current?.measure((_x, _y, _w, _h, pageX) => {
            const newVal = resolveValue(evt.nativeEvent.pageX, pageX);
            onValueChange(newVal);
          });
        },
        onPanResponderRelease: (evt) => {
          trackRef.current?.measure((_x, _y, _w, _h, pageX) => {
            const newVal = resolveValue(evt.nativeEvent.pageX, pageX);
            onSlidingComplete?.(newVal);
          });
        },
      }),
    [resolveValue, onValueChange, onSlidingComplete],
  );
  /* eslint-enable react-hooks/refs */

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    trackWidthRef.current = e.nativeEvent.layout.width;
  }, []);

  const percent = Math.round(clamp(value) * 100);

  const styles = getStyles(colors);

  return (
    <View style={styles.container}>
      <View
        ref={trackRef}
        style={styles.track}
        onLayout={handleLayout}
        {...panResponder.panHandlers}
      >
        <View style={[styles.fill, { width: `${percent}%` }]} />
        <View style={[styles.thumb, { left: `${percent}%` }]} />
      </View>
      <Text style={styles.label}>{percent}%</Text>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

interface SliderStyles {
  container: ViewStyle;
  track: ViewStyle;
  fill: ViewStyle;
  thumb: ViewStyle;
  label: TextStyle;
}

function getStyles(colors: ThemeColors): SliderStyles {
  return StyleSheet.create<SliderStyles>({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
    },
    track: {
      flex: 1,
      height: spacing.small,
      backgroundColor: colors.border,
      borderRadius: borderRadius.small,
      justifyContent: 'center',
      position: 'relative',
      // Web: prevent browser scroll/swipe while dragging the slider
      ...(Platform.OS === 'web' && ({ touchAction: 'none', cursor: 'pointer' } as ViewStyle)),
    },
    fill: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.small,
    },
    thumb: {
      position: 'absolute',
      width: spacing.large,
      height: spacing.large,
      borderRadius: spacing.large / 2,
      backgroundColor: colors.primary,
      marginLeft: -(spacing.large / 2),
      top: -(spacing.large / 2 - spacing.small / 2),
    },
    label: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.textSecondary,
      width: 40,
      textAlign: 'right',
    },
  });
}
