/** FashionBackdrop — decorative low-cost city glow layer; never owns interaction state. */
import { LinearGradient } from 'expo-linear-gradient';
import type React from 'react';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { borderRadius } from '@/theme';
import { fashionShadowColors } from '@/theme/fashionShadowColors';

export const FashionBackdrop: React.FC = () => {
  const pulse = useSharedValue(0);
  const drift = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2800, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    drift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 7200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 7200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(pulse);
      cancelAnimation(drift);
    };
  }, [drift, pulse]);

  const pinkStyle = useAnimatedStyle(
    () => ({
      opacity: 0.18 + pulse.value * 0.14,
      transform: [{ translateX: drift.value * 18 }, { translateY: drift.value * 10 }],
    }),
    [drift, pulse],
  );
  const cyanStyle = useAnimatedStyle(
    () => ({
      opacity: 0.14 + (1 - pulse.value) * 0.12,
      transform: [{ translateX: -drift.value * 16 }, { translateY: -drift.value * 8 }],
    }),
    [drift, pulse],
  );

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.backdrop]}>
      <LinearGradient
        colors={[
          fashionShadowColors.backgroundDeep,
          fashionShadowColors.background,
          fashionShadowColors.backgroundDeep,
        ]}
        locations={[0, 0.56, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[styles.pinkGlow, pinkStyle]} />
      <Animated.View style={[styles.cyanGlow, cyanStyle]} />
      <View style={styles.horizon} />
      <View style={styles.cityRow}>
        <View style={[styles.tower, styles.towerTall]} />
        <View style={[styles.tower, styles.towerShort]} />
        <View style={[styles.tower, styles.towerMedium]} />
        <View style={[styles.tower, styles.towerTall]} />
        <View style={[styles.tower, styles.towerShort]} />
        <View style={[styles.tower, styles.towerMedium]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    overflow: 'hidden',
  },
  pinkGlow: {
    position: 'absolute',
    top: '-12%',
    right: '-24%',
    width: '82%',
    aspectRatio: 1,
    borderRadius: borderRadius.full,
    backgroundColor: fashionShadowColors.neonPink,
  },
  cyanGlow: {
    position: 'absolute',
    bottom: '-18%',
    left: '-24%',
    width: '76%',
    aspectRatio: 1,
    borderRadius: borderRadius.full,
    backgroundColor: fashionShadowColors.neonCyan,
  },
  horizon: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '20%',
    borderTopWidth: 1,
    borderTopColor: fashionShadowColors.neonCyanSoft,
  },
  cityRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '22%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    opacity: 0.26,
  },
  tower: {
    width: '13%',
    backgroundColor: fashionShadowColors.surfaceRaised,
    borderTopWidth: 1,
    borderColor: fashionShadowColors.neonPinkSoft,
  },
  towerShort: { height: '42%' },
  towerMedium: { height: '68%' },
  towerTall: { height: '92%' },
});
