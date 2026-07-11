/** Werewolf statistics extension rendered on the account settings screen. */

import type React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useWerewolfPublicStats } from '@/games/werewolf/hooks/useWerewolfPublicStats';
import { colors, spacing, typography } from '@/theme';

import { CampDistributionBar } from './CampDistributionBar';

export const WerewolfAccountStatsSection: React.FC<{ readonly userId: string }> = ({ userId }) => {
  const { data, isPending, isError } = useWerewolfPublicStats(userId);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>狼人杀阵营分布</Text>
        {data && <Text style={styles.headerCount}>{data.campStats.total} 局</Text>}
      </View>
      {isPending ? (
        <ActivityIndicator color={colors.primary} />
      ) : isError ? (
        <Text style={styles.errorText}>阵营统计加载失败</Text>
      ) : (
        <CampDistributionBar campStats={data.campStats} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.medium,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.small,
  },
  headerTitle: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  headerCount: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.textMuted,
  },
  errorText: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.error,
  },
});
