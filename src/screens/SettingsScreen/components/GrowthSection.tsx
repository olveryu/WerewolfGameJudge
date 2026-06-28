/**
 * GrowthSection - Growth section (Memoized)
 *
 * Full-width XP progress bar + dresserEntry-style growth entry row.
 * Taps navigate to UnlocksScreen.
 * Embedded inside account card; does not include its own card container.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  FREE_AVATAR_IDS,
  FREE_FLAIR_IDS,
  FREE_FRAME_IDS,
  getLevelProgress,
  LEVEL_THRESHOLDS,
  TOTAL_UNLOCKABLE_COUNT,
} from '@werewolf/game-engine/growth';
import { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { CampDistributionBar } from '@/components/CampDistributionBar';
import type { UserStats } from '@/services/feature/StatsService';
import { colors, componentSizes, fixed } from '@/theme';

import type { SettingsScreenStyles } from './styles';

interface GrowthSectionProps {
  stats: UserStats;
  styles: SettingsScreenStyles;
  onPressUnlocks?: () => void;
}

/** Level / XP section. */
export const GrowthSection = memo<GrowthSectionProps>(({ stats, styles, onPressUnlocks }) => {
  const progress = getLevelProgress(stats.xp);
  const nextThreshold =
    stats.level < LEVEL_THRESHOLDS.length - 1
      ? LEVEL_THRESHOLDS[stats.level + 1]
      : LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];

  const unlockCount = new Set([
    ...stats.unlockedItems,
    ...FREE_AVATAR_IDS,
    ...FREE_FRAME_IDS,
    ...FREE_FLAIR_IDS,
  ]).size;

  return (
    <>
      {/* XP progress bar — full width */}
      <View style={styles.growthXpRow}>
        <Text style={styles.growthXpLabel}>XP</Text>
        <View style={styles.growthProgressBarBg}>
          <View style={[styles.growthProgressBarFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.growthXpValue}>
          {stats.xp}/{nextThreshold}
        </Text>
      </View>

      {/* Unlocks entry — dresserEntry style */}
      <TouchableOpacity
        style={styles.dresserEntry}
        onPress={onPressUnlocks}
        activeOpacity={fixed.activeOpacity}
      >
        <Ionicons name="trophy-outline" size={componentSizes.icon.md} color={colors.primary} />
        <View style={styles.growthEntryContent}>
          <Text style={styles.dresserEntryText}>
            {stats.gamesPlayed} 局 · 已解锁 {unlockCount}/{TOTAL_UNLOCKABLE_COUNT}
          </Text>
          <View style={styles.growthMiniProgress}>
            <View
              style={[
                styles.growthMiniProgressFill,
                { width: `${(unlockCount / TOTAL_UNLOCKABLE_COUNT) * 100}%` },
              ]}
            />
          </View>
        </View>
        <Ionicons name="chevron-forward" size={componentSizes.icon.md} color={colors.textMuted} />
      </TouchableOpacity>

      {/* Camp distribution — 2h-delayed view (same anti-cheat delay as others' view) */}
      <View style={styles.campSection}>
        <View style={styles.campHeaderRow}>
          <Text style={styles.campHeaderTitle}>阵营分布</Text>
          <Text style={styles.campHeaderCount}>{stats.campStats.total} 局</Text>
        </View>
        <CampDistributionBar campStats={stats.campStats} />
      </View>
    </>
  );
});

GrowthSection.displayName = 'GrowthSection';
