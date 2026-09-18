/** One-shot collection entrances reveal the real children and report only completed animations. */
import { memo, useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import {
  MYTHIC_COLLECTION_COLORS,
  MYTHIC_ENTRY_DURATION,
  type MythicCollection,
} from '@/config/mythicVisual';

import { AnimatedPath } from '../seatFlairs/svgAnimatedPrimitives';
import type { SeatAnimationProps } from './SeatAnimationProps';

const containerStyle: ViewStyle = { overflow: 'hidden' };
const contentPosition: ViewStyle = { position: 'absolute', bottom: 0, left: 0 };

function CollectionArrival({
  size,
  borderRadius,
  children,
  onComplete,
  collection,
}: SeatAnimationProps & { collection: MythicCollection }) {
  const colors = MYTHIC_COLLECTION_COLORS[collection];
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(
      1,
      { duration: MYTHIC_ENTRY_DURATION, easing: Easing.linear },
      (finished) => {
        if (finished) scheduleOnRN(onComplete);
      },
    );
    return () => cancelAnimation(progress);
  }, [progress, onComplete]);
  const contentStyle = useAnimatedStyle(() => {
    const formed = Math.min(1, Math.max(0, (progress.value - 0.15) / 0.65));
    return {
      width: collection === 'ocean' ? size : size * formed,
      height: collection === 'ocean' ? size * formed : size,
    };
  });
  const effectStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.value * 6) * (1 - Math.max(0, (progress.value - 0.7) / 0.3)),
  }));
  const strokes = useAnimatedProps(() => {
    const formed = Math.min(1, Math.max(0, (progress.value - 0.15) / 0.65));
    if (collection === 'astral')
      return {
        d: `M${formed * 100} 0 V100 M0 20 H${formed * 100} M0 40 H${formed * 100} M0 60 H${formed * 100} M0 80 H${formed * 100}`,
        strokeWidth: 1.5,
      };
    if (collection === 'ocean')
      return {
        d: `M0 ${100 - formed * 100} Q25 ${85 - formed * 100} 50 ${100 - formed * 100} T100 ${100 - formed * 100}`,
        strokeWidth: 5,
      };
    return {
      d: `M${formed * 110 - 5} -10 L${formed * 110 - 15} 28 L${formed * 110 + 4} 52 L${formed * 110 - 10} 78 L${formed * 110} 110`,
      strokeWidth: 15,
    };
  });
  return (
    <View style={[containerStyle, { width: size, height: size, borderRadius }]}>
      <Animated.View style={[containerStyle, contentPosition, contentStyle]}>
        <View style={[contentPosition, { width: size, height: size }]}>{children}</View>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, effectStyle]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <AnimatedPath
            animatedProps={strokes}
            fill="none"
            stroke={colors.primary}
            strokeLinecap="round"
          />
          {collection === 'astral' ? (
            <Path
              d="M10 0 V100 M30 0 V100 M50 0 V100 M70 0 V100 M90 0 V100"
              stroke={colors.secondary}
              strokeWidth={0.7}
            />
          ) : collection === 'ocean' ? (
            <Path
              d="M5 94 Q25 78 45 92 T96 90 M10 84 Q30 73 50 82 T93 83"
              fill="none"
              stroke={colors.pearl}
              strokeWidth={1.5}
            />
          ) : (
            <Path
              d="M80 8 H94 V26 H80 Z M84 12 V22 H90 V12 Z"
              fill={colors.secondary}
              fillRule="evenodd"
            />
          )}
        </Svg>
      </Animated.View>
    </View>
  );
}

/** Threads assemble the portrait from left to right. */
export const WovenArrival = memo<SeatAnimationProps>((props) => (
  <CollectionArrival {...props} collection="astral" />
));
/** A rising tide uncovers the portrait. */
export const TidalArrival = memo<SeatAnimationProps>((props) => (
  <CollectionArrival {...props} collection="ocean" />
));
/** A moving brush uncovers the portrait before its seal fades. */
export const InkArrival = memo<SeatAnimationProps>((props) => (
  <CollectionArrival {...props} collection="ink" />
));
WovenArrival.displayName = 'WovenArrival';
TidalArrival.displayName = 'TidalArrival';
InkArrival.displayName = 'InkArrival';
