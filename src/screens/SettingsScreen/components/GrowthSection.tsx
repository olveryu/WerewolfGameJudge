/**
 * GrowthSection — 成长区块（Memoized）
 *
 * 全宽 XP 进度条 + dresserEntry 风格的成长入口行。
 * 点击跳转 UnlocksScreen。
 * 嵌入账户 card 内部，不自带 card 容器。
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

import type { UserStats } from '@/services/feature/StatsService';
import { colors, componentSizes, fixed } from '@/theme';

import type { SettingsScreenStyles } from './styles';

interface GrowthSectionProps {
  stats: UserStats;
  styles: SettingsScreenStyles;
  onPressUnlocks?: () => void;
}

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
    </>
  );
});

GrowthSection.displayName = 'GrowthSection';
