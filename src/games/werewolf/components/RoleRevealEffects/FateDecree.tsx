/** Mythic decree reveal. Animates a sealed scroll around the authoritative role card; no role selection or IO. */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { NightCrownMotif } from '@/components/avatarFrames/NightCrownMotif';
import { MYTHIC_COLORS, MYTHIC_ENTRY_DURATION } from '@/config/mythicVisual';
import { borderRadius, colors, spacing, typography } from '@/theme';

import { RoleCardContent } from './common/RoleCardContent';
import { CONFIG } from './config';
import { useRevealLifecycle } from './hooks/useRevealLifecycle';
import { createAlignmentThemes, type RoleRevealEffectProps } from './types';

/** Opens once, then waits for explicit acknowledgement of the revealed identity. */
export function FateDecree({
  role,
  onComplete,
  reducedMotion = false,
  testIDPrefix = 'role-reveal',
}: RoleRevealEffectProps) {
  const { width, height } = useWindowDimensions();
  const cardWidth = Math.min(
    CONFIG.common.cardMaxWidth,
    width * CONFIG.common.cardWidthRatio,
    (height * 0.58) / CONFIG.common.cardAspectRatio,
  );
  const cardHeight = cardWidth * CONFIG.common.cardAspectRatio;
  const themes = createAlignmentThemes(colors);
  const [isRevealed, setIsRevealed] = useState(reducedMotion);
  const progress = useSharedValue(reducedMotion ? 1 : 0);
  const { fireComplete } = useRevealLifecycle({ onComplete });
  const reveal = useCallback(() => setIsRevealed(true), []);
  useEffect(() => {
    progress.value = withTiming(
      1,
      { duration: reducedMotion ? 0 : MYTHIC_ENTRY_DURATION, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        if (finished) scheduleOnRN(reveal);
      },
    );
    return () => cancelAnimation(progress);
  }, [progress, reducedMotion, reveal]);
  const leftStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -progress.value * cardWidth * 0.52 }],
    opacity: 1 - Math.max(0, (progress.value - 0.9) * 10),
  }));
  const rightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * cardWidth * 0.52 }],
    opacity: 1 - Math.max(0, (progress.value - 0.9) * 10),
  }));
  const sealStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, progress.value * 3),
    transform: [{ scale: 1 + progress.value * 0.3 }],
  }));
  return (
    <View style={styles.container} testID={`${testIDPrefix}-fateDecree`}>
      <View style={[styles.scroll, { width: cardWidth, height: cardHeight }]}>
        <View
          accessibilityElementsHidden={!isRevealed}
          importantForAccessibility={isRevealed ? 'auto' : 'no-hide-descendants'}
        >
          <RoleCardContent
            roleId={role.id}
            width={cardWidth}
            height={cardHeight}
            revealMode
            revealGradient={themes[role.alignment].revealGradient}
            testID={`${testIDPrefix}-decree-card`}
          />
        </View>
        <Animated.View pointerEvents="none" style={[styles.scrollHalf, styles.left, leftStyle]} />
        <Animated.View pointerEvents="none" style={[styles.scrollHalf, styles.right, rightStyle]} />
        <Animated.View pointerEvents="none" style={[styles.seal, sealStyle]}>
          <Svg width="100%" height="100%" viewBox="0 0 100 70">
            <NightCrownMotif />
          </Svg>
        </Animated.View>
      </View>
      {isRevealed ? (
        <Pressable
          accessibilityRole="button"
          onPress={fireComplete}
          testID={`${testIDPrefix}-decree-confirm`}
          style={[styles.confirm, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.confirmText, { color: colors.textInverse }]}>我知道了</Text>
        </Pressable>
      ) : (
        <Text style={styles.title}>命运敕令</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.large,
    paddingTop: spacing.xlarge,
  },
  scroll: {
    overflow: 'hidden',
    borderRadius: borderRadius.medium,
    borderWidth: 2,
    borderColor: MYTHIC_COLORS.silver,
  },
  scrollHalf: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '50%',
    backgroundColor: MYTHIC_COLORS.obsidian,
    borderWidth: 2,
    borderColor: MYTHIC_COLORS.crimson,
  },
  left: { left: 0, borderRightColor: MYTHIC_COLORS.silver, borderRightWidth: 5 },
  right: { right: 0, borderLeftColor: MYTHIC_COLORS.silver, borderLeftWidth: 5 },
  seal: { position: 'absolute', left: '32%', top: '36%', width: '36%', height: '25%' },
  title: {
    color: MYTHIC_COLORS.silver,
    fontSize: typography.title,
    paddingVertical: spacing.small,
  },
  confirm: {
    paddingHorizontal: spacing.xlarge,
    paddingVertical: spacing.medium,
    borderRadius: borderRadius.medium,
  },
  confirmText: { fontSize: typography.body },
});
