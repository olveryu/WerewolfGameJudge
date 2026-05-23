/**
 * VolumeSlider — 音量滑块组件
 *
 * Web-native range input + 自定义 track/thumb 样式。
 * 自定义 thumb（白底+阴影+主色内圆）+ 左右音量图标。
 * 纯 Presentational 组件：接收 value + onValueChange 回调，不 import service。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { memo, useCallback, useMemo, useRef } from 'react';
import {
  type LayoutChangeEvent,
  StyleSheet,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';

import { borderRadius, colors, componentSizes, shadows, spacing, type ThemeColors } from '@/theme';

const SLIDER_HEIGHT = 10;
const THUMB_OUTER = 32;

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
  const trackRef = useRef<View>(null);
  const trackWidthRef = useRef(0);
  const isDragging = useRef(false);

  const handleTrackLayout = useCallback((e: LayoutChangeEvent) => {
    trackWidthRef.current = e.nativeEvent.layout.width;
  }, []);

  const clampValue = useCallback((v: number) => Math.max(0, Math.min(1, v)), []);

  const getValueFromPageX = useCallback(
    (pageX: number) => {
      const trackNode = trackRef.current as unknown as HTMLElement | null;
      if (!trackNode) return value;
      const rect = trackNode.getBoundingClientRect();
      const x = pageX - rect.left;
      return clampValue(x / rect.width);
    },
    [value, clampValue],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      isDragging.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const v = getValueFromPageX(e.clientX);
      onValueChange(v);
    },
    [getValueFromPageX, onValueChange],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      const v = getValueFromPageX(e.clientX);
      onValueChange(v);
    },
    [getValueFromPageX, onValueChange],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      const v = getValueFromPageX(e.clientX);
      onSlidingComplete?.(v);
    },
    [getValueFromPageX, onSlidingComplete],
  );

  const percentage = Math.round(value * 100);

  const sliderStyles = useMemo(() => getStyles(colors), []);

  return (
    <View style={sliderStyles.container}>
      <Ionicons name="volume-low" size={componentSizes.icon.sm} color={colors.textSecondary} />
      <View
        ref={trackRef}
        style={sliderStyles.sliderWrap}
        onLayout={handleTrackLayout}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <View style={sliderStyles.track}>
          <View style={[sliderStyles.trackFill, { width: `${percentage}%` }]} />
        </View>
        <View
          style={[sliderStyles.thumb, { left: `${percentage}%`, marginLeft: -(THUMB_OUTER / 2) }]}
        >
          <View style={[sliderStyles.thumbInner, { backgroundColor: colors.primary }]} />
        </View>
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
  track: ViewStyle;
  trackFill: ViewStyle;
  thumb: ViewStyle;
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
      height: THUMB_OUTER,
      justifyContent: 'center',
      position: 'relative',
      cursor: 'pointer',
    } as ViewStyle,
    track: {
      width: '100%',
      height: SLIDER_HEIGHT,
      borderRadius: borderRadius.full,
      backgroundColor: colors.border,
      overflow: 'hidden',
    },
    trackFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: borderRadius.full,
    },
    thumb: {
      position: 'absolute',
      top: '50%',
      width: THUMB_OUTER,
      height: THUMB_OUTER,
      borderRadius: THUMB_OUTER / 2,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: -(THUMB_OUTER / 2),
      ...shadows.md,
    },
    thumbInner: {
      width: 16,
      height: 16,
      borderRadius: borderRadius.full,
    },
    label: {},
  });
}
