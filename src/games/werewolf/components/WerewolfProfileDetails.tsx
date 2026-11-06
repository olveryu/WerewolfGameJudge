/** Werewolf-only statistics rendered inside the shared player profile card. */

import type React from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { useWerewolfPublicStats } from '@/games/werewolf/hooks/useWerewolfPublicStats';
import { colors, spacing, typography } from '@/theme';

import { CampDistributionBar } from './CampDistributionBar';

export const WerewolfProfileDetails: React.FC<{ readonly userId: string }> = ({ userId }) => {
  const { data, isPending, isError } = useWerewolfPublicStats(userId);

  if (isPending) return <ActivityIndicator color={colors.primary} />;
  if (isError) return <Text style={styles.errorText}>阵营统计加载失败</Text>;
  return (
    <>
      <Text style={styles.gameCount}>统计 {data.campStats.total} 局</Text>
      <CampDistributionBar campStats={data.campStats} compact />
    </>
  );
};

const styles = StyleSheet.create({
  gameCount: {
    marginBottom: spacing.small,
    textAlign: 'right',
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.textMuted,
  },
  errorText: {
    paddingVertical: spacing.small,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.error,
  },
});
