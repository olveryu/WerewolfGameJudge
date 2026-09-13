/** FashionPhaseRail — four-case route indicator derived only from public round state. */
import {
  FASHION_ROUND_BY_NUMBER,
  type FashionPublicState,
} from '@game-judge/game-engine/games/fashion-shadow/public';
import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { borderRadius, fixed, spacing, typography } from '@/theme';
import { fashionShadowColors } from '@/theme/fashionShadowColors';

interface FashionPhaseRailProps {
  readonly currentRound: FashionPublicState['currentRound'];
  readonly phase: FashionPublicState['phase'];
}

export const FashionPhaseRail: React.FC<FashionPhaseRailProps> = ({ currentRound, phase }) => (
  <View style={styles.rail}>
    {([1, 2, 3, 4] as const).map((roundNumber) => {
      const round = FASHION_ROUND_BY_NUMBER[roundNumber];
      const isCurrent = roundNumber === currentRound && phase !== 'ended';
      const isComplete = roundNumber < currentRound || phase === 'ended';
      return (
        <View
          key={roundNumber}
          style={[
            styles.stop,
            isCurrent ? styles.stopCurrent : null,
            isComplete ? styles.stopComplete : null,
          ]}
        >
          <Text style={[styles.number, isCurrent ? styles.numberCurrent : null]}>
            {String(roundNumber).padStart(2, '0')}
          </Text>
          <Text numberOfLines={1} style={styles.location}>
            {round.location}
          </Text>
          <Text style={styles.esg}>{round.esg}</Text>
        </View>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  rail: {
    flexDirection: 'row',
    gap: spacing.small,
  },
  stop: {
    flex: 1,
    minWidth: 0,
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.border,
    backgroundColor: fashionShadowColors.surfaceMuted,
    padding: spacing.small,
    gap: spacing.micro,
  },
  stopCurrent: {
    borderColor: fashionShadowColors.neonPink,
    backgroundColor: fashionShadowColors.neonPinkSoft,
  },
  stopComplete: {
    borderColor: fashionShadowColors.neonCyanSoft,
  },
  number: {
    color: fashionShadowColors.textMuted,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
  },
  numberCurrent: {
    color: fashionShadowColors.neonPink,
  },
  location: {
    color: fashionShadowColors.text,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.semibold,
  },
  esg: {
    color: fashionShadowColors.neonCyan,
    fontSize: typography.captionSmall,
    lineHeight: typography.lineHeights.captionSmall,
  },
});
