/** FashionIdentityCard — private identity presentation; callers must pass projected self-only data. */
import type { FashionPublicState } from '@game-judge/game-engine/games/fashion-shadow/public';
import type React from 'react';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { borderRadius, fixed, spacing, typography } from '@/theme';
import { fashionShadowColors } from '@/theme/fashionShadowColors';

interface FashionIdentityCardProps {
  readonly identity: NonNullable<FashionPublicState['privateIdentity']>;
  readonly actionTokens: number | null;
}

export const FashionIdentityCard: React.FC<FashionIdentityCardProps> = ({
  identity,
  actionTokens,
}) => {
  const reveal = useSharedValue(1);

  useEffect(() => {
    reveal.value = 0;
    reveal.value = withSequence(
      withTiming(0.55, { duration: 180 }),
      withTiming(1, { duration: 420 }),
    );
    return () => cancelAnimation(reveal);
  }, [identity.roleId, reveal]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ scale: 0.96 + reveal.value * 0.04 }],
  }));

  return (
    <Animated.View style={[styles.card, animatedStyle]}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.kicker}>PRIVATE IDENTITY / 仅你可见</Text>
          <Text style={styles.roleName}>{identity.roleName}</Text>
        </View>
        {actionTokens !== null ? (
          <View style={styles.tokenBadge}>
            <Text style={styles.tokenValue}>{actionTokens}</Text>
            <Text style={styles.tokenLabel}>行动点</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.divider} />
      <Text style={styles.label}>公开立场</Text>
      <Text style={styles.body}>{identity.publicStance}</Text>
      <Text style={styles.label}>隐藏秘密</Text>
      <Text style={styles.secret}>{identity.secret}</Text>
      <Text style={styles.label}>个人胜利条件</Text>
      <Text style={styles.body}>{identity.victoryCondition}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.large,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.neonPink,
    backgroundColor: fashionShadowColors.surfaceMuted,
    padding: spacing.large,
    gap: spacing.small,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.medium,
  },
  kicker: {
    color: fashionShadowColors.neonPink,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
  },
  roleName: {
    color: fashionShadowColors.text,
    fontSize: typography.heading,
    lineHeight: typography.lineHeights.heading,
    fontWeight: typography.weights.bold,
  },
  tokenBadge: {
    minWidth: '22%',
    alignItems: 'center',
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.neonCyan,
    backgroundColor: fashionShadowColors.neonCyanSoft,
    padding: spacing.small,
  },
  tokenValue: {
    color: fashionShadowColors.neonCyan,
    fontSize: typography.heading,
    lineHeight: typography.lineHeights.heading,
    fontWeight: typography.weights.bold,
  },
  tokenLabel: {
    color: fashionShadowColors.textSecondary,
    fontSize: typography.captionSmall,
    lineHeight: typography.lineHeights.captionSmall,
  },
  divider: {
    borderTopWidth: fixed.borderWidth,
    borderTopColor: fashionShadowColors.neonPinkSoft,
  },
  label: {
    color: fashionShadowColors.neonCyan,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
  },
  body: {
    color: fashionShadowColors.textSecondary,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
  },
  secret: {
    color: fashionShadowColors.text,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
  },
});
