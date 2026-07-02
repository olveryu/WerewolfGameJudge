/**
 * CampDistributionBar — per-user camp distribution (狼人 / 神 / 平民 / 第三方).
 *
 * Pure presentational: renders one horizontal bar per camp bucket (fixed CAMP_ORDER),
 * each filled to its share of the visible games, with a trailing percentage.
 * Shows an empty-state line when no games are visible (total === 0).
 * Used by SettingsScreen growth section (self) and room PlayerProfileCard (public).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type { CampBucket } from '@werewolf/game-engine/werewolf/models/roles';
import { CAMP_ORDER } from '@werewolf/game-engine/werewolf/models/roles';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CAMP_VISUAL } from '@/config/campVisual';
import type { CampStats } from '@/services/feature/StatsService';
import { borderRadius, colors, componentSizes, spacing, typography, withAlpha } from '@/theme';

interface CampDistributionBarProps {
  campStats: CampStats;
  /** Narrow layout for the 300pt room card (smaller label column). */
  compact?: boolean;
}

/** Integer percentage of a camp count within the visible total. */
function toPercent(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

const CampDistributionBarComponent: React.FC<CampDistributionBarProps> = ({
  campStats,
  compact = false,
}) => {
  return (
    <View style={styles.container}>
      {campStats.total === 0 ? (
        <Text style={styles.emptyText}>暂无阵营数据</Text>
      ) : (
        CAMP_ORDER.map((bucket: CampBucket) => {
          const visual = CAMP_VISUAL[bucket];
          const count = campStats.counts[bucket];
          const percent = toPercent(count, campStats.total);
          return (
            <View key={bucket} style={styles.row}>
              <Text style={[styles.label, compact && styles.labelCompact]} numberOfLines={1}>
                {visual.emoji} {visual.label}
              </Text>
              <View style={styles.track}>
                <View
                  style={[styles.fill, { width: `${percent}%`, backgroundColor: visual.color }]}
                />
              </View>
              <Text style={styles.percent}>{percent}%</Text>
            </View>
          );
        })
      )}
      <Text style={styles.delayHint}>
        <Ionicons
          name="information-circle-outline"
          size={componentSizes.icon.xs}
          color={colors.textMuted}
        />{' '}
        仅统计两小时前结束的对局
      </Text>
    </View>
  );
};

export const CampDistributionBar = memo(CampDistributionBarComponent);
CampDistributionBar.displayName = 'CampDistributionBar';

const styles = StyleSheet.create({
  container: {
    gap: spacing.tight,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    width: 64,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.textSecondary,
  },
  labelCompact: {
    width: 56,
  },
  track: {
    flex: 1,
    height: 6,
    backgroundColor: withAlpha(colors.textMuted, 0.12),
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginHorizontal: spacing.small,
  },
  fill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  percent: {
    width: 36,
    textAlign: 'right',
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  emptyText: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.textMuted,
  },
  delayHint: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.textMuted,
    marginTop: spacing.tight,
  },
});
