/** Werewolf-only statistics rendered inside the shared player profile card. */

import { getRoleDisplayName } from '@werewolf/game-engine/models/roles';
import type React from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { useWerewolfPublicStats } from '@/games/werewolf/hooks/useWerewolfPublicStats';
import { colors, spacing, typography } from '@/theme';

import { CampDistributionBar } from './CampDistributionBar';

export const WerewolfProfileDetails: React.FC<{ readonly userId: string }> = ({ userId }) => {
  const { data, isPending, isError } = useWerewolfPublicStats(userId);

  if (isPending) return <ActivityIndicator color={colors.primary} />;
  if (isError) return <Text style={styles.errorText}>阵营统计加载失败</Text>;
  return <CampDistributionBar campStats={data.campStats} compact />;
};

export function resolveWerewolfBuiltinAvatarName(avatarId: string): string {
  return getRoleDisplayName(avatarId);
}

const styles = StyleSheet.create({
  errorText: {
    paddingVertical: spacing.small,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.error,
  },
});
