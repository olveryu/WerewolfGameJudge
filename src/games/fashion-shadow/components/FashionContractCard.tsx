/** FashionContractCard — private contract status surface; mutation remains server-authoritative. */
import type { FashionContract } from '@game-judge/game-engine/games/fashion-shadow/public';
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

import { FashionButton as Button } from './FashionButton';

interface FashionContractCardProps {
  readonly contract: FashionContract;
  readonly promiseLabel: string;
  readonly canFulfill: boolean;
  readonly isSubmitting: boolean;
  readonly onFulfill: () => void;
}

export const FashionContractCard: React.FC<FashionContractCardProps> = ({
  contract,
  promiseLabel,
  canFulfill,
  isSubmitting,
  onFulfill,
}) => {
  const stamp = useSharedValue(1);

  useEffect(() => {
    stamp.value = 0.72;
    stamp.value = withSequence(
      withTiming(1.08, { duration: 180 }),
      withTiming(1, { duration: 220 }),
    );
    return () => cancelAnimation(stamp);
  }, [contract.status, stamp]);

  const stampStyle = useAnimatedStyle(() => ({ transform: [{ scale: stamp.value }] }));
  const isFulfilled = contract.status === 'fulfilled';

  return (
    <View style={[styles.card, isFulfilled ? styles.fulfilledCard : null]}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.kicker}>PRIVATE CONTRACT</Text>
          <Text style={styles.title}>秘密契约 #{contract.id}</Text>
        </View>
        <Animated.View
          style={[styles.stamp, isFulfilled ? styles.stampFulfilled : null, stampStyle]}
        >
          <Text style={[styles.stampText, isFulfilled ? styles.stampTextFulfilled : null]}>
            {isFulfilled ? '已履行' : '已签署'}
          </Text>
        </Animated.View>
      </View>
      <View style={styles.divider} />
      <Text style={styles.parties}>
        {contract.sellerSeat + 1}号 → {contract.buyerSeat + 1}号
      </Text>
      <Text style={styles.promise}>{promiseLabel}</Text>
      <Text style={styles.body}>
        {isFulfilled
          ? '契约已进入最终胜利条件结算。买家达成个人胜利时，工厂工人的契约条件才成立。'
          : '买家已经签署，但契约尚未履行。只有卖方工厂工人可以确认履行。'}
      </Text>
      {canFulfill ? (
        <Button variant="primary" size="sm" onPress={onFulfill} disabled={isSubmitting}>
          确认履行契约
        </Button>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.large,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.neonCyan,
    backgroundColor: fashionShadowColors.surfaceMuted,
    padding: spacing.medium,
    gap: spacing.small,
  },
  fulfilledCard: {
    borderColor: fashionShadowColors.success,
    backgroundColor: fashionShadowColors.successSoft,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.medium,
  },
  kicker: {
    color: fashionShadowColors.neonCyan,
    fontSize: typography.captionSmall,
    lineHeight: typography.lineHeights.captionSmall,
    fontWeight: typography.weights.bold,
  },
  title: {
    color: fashionShadowColors.text,
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.bold,
  },
  stamp: {
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.neonPink,
    backgroundColor: fashionShadowColors.neonPinkSoft,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.tight,
  },
  stampFulfilled: {
    borderColor: fashionShadowColors.success,
    backgroundColor: fashionShadowColors.successSoft,
  },
  stampText: {
    color: fashionShadowColors.neonPink,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
  },
  stampTextFulfilled: {
    color: fashionShadowColors.success,
  },
  divider: {
    borderTopWidth: fixed.borderWidth,
    borderTopColor: fashionShadowColors.border,
  },
  parties: {
    color: fashionShadowColors.neonPink,
    fontSize: typography.subtitle,
    lineHeight: typography.lineHeights.subtitle,
    fontWeight: typography.weights.bold,
  },
  promise: {
    color: fashionShadowColors.text,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
  },
  body: {
    color: fashionShadowColors.textSecondary,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
  },
});
