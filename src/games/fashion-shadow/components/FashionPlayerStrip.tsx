/** FashionPlayerStrip — compact public roster; reveals role names only when projection allows it. */
import {
  FASHION_PLAYER_COUNT,
  FASHION_ROLE_BY_ID,
  type FashionPublicState,
} from '@game-judge/game-engine/games/fashion-shadow/public';
import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { borderRadius, fixed, spacing, typography } from '@/theme';
import { fashionShadowColors } from '@/theme/fashionShadowColors';

interface FashionPlayerStripProps {
  readonly state: FashionPublicState;
  readonly mySeat: number | null;
}

export const FashionPlayerStrip: React.FC<FashionPlayerStripProps> = ({ state, mySeat }) => (
  <View style={styles.grid}>
    {Array.from({ length: FASHION_PLAYER_COUNT }, (_, seat) => {
      const occupant = state.realSeats[seat];
      const isSelf = seat === mySeat;
      const isAttacker = state.interrogation?.attackerSeat === seat;
      const isDefender = state.interrogation?.defenderSeat === seat;
      const isRevealed = state.revealedSecrets[seat] !== undefined;
      const isWinner = state.phase === 'ended' && state.winners.includes(seat);
      const revealedRoleId = state.revealedRoles[seat];
      const status =
        revealedRoleId !== undefined
          ? FASHION_ROLE_BY_ID[revealedRoleId].name
          : isAttacker
            ? '攻击方'
            : isDefender
              ? '防守方'
              : isRevealed
                ? '秘密公开'
                : '调查中';
      return (
        <View
          key={seat}
          style={[
            styles.player,
            isSelf ? styles.self : null,
            isAttacker ? styles.attacker : null,
            isDefender ? styles.defender : null,
            isWinner ? styles.winner : null,
          ]}
        >
          <Text style={styles.seat}>{seat + 1}</Text>
          <Text numberOfLines={1} style={styles.name}>
            {occupant?.profile.displayName ?? '空位'}
          </Text>
          <Text numberOfLines={1} style={styles.status}>
            {isSelf ? `你 · ${status}` : status}
            {isWinner ? ' · 胜利' : ''}
          </Text>
        </View>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.small,
  },
  player: {
    width: '31%',
    minWidth: 0,
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.border,
    backgroundColor: fashionShadowColors.surfaceMuted,
    padding: spacing.small,
    gap: spacing.micro,
  },
  self: {
    borderColor: fashionShadowColors.neonPink,
  },
  attacker: {
    borderColor: fashionShadowColors.neonPink,
    backgroundColor: fashionShadowColors.neonPinkSoft,
  },
  defender: {
    borderColor: fashionShadowColors.neonCyan,
    backgroundColor: fashionShadowColors.neonCyanSoft,
  },
  winner: {
    borderColor: fashionShadowColors.success,
    backgroundColor: fashionShadowColors.successSoft,
  },
  seat: {
    color: fashionShadowColors.neonCyan,
    fontSize: typography.captionSmall,
    lineHeight: typography.lineHeights.captionSmall,
    fontWeight: typography.weights.bold,
  },
  name: {
    color: fashionShadowColors.text,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.semibold,
  },
  status: {
    color: fashionShadowColors.textMuted,
    fontSize: typography.captionSmall,
    lineHeight: typography.lineHeights.captionSmall,
  },
});
