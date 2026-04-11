/**
 * GrowthSection — 成长区块（Memoized）
 *
 * 显示等级、XP 进度条、下一级解锁预告。
 * 嵌入账户 card 内部，不自带 card 容器。
 */
import { getLevelProgress, getLevelReward, LEVEL_THRESHOLDS } from '@werewolf/game-engine/growth';
import { memo } from 'react';
import { Text, View } from 'react-native';

import type { UserStats } from '@/services/feature/StatsService';
import { useColors } from '@/theme';

import type { SettingsScreenStyles } from './styles';

interface GrowthSectionProps {
  stats: UserStats;
  styles: SettingsScreenStyles;
}

export const GrowthSection = memo<GrowthSectionProps>(({ stats, styles }) => {
  const colors = useColors();

  const progress = getLevelProgress(stats.xp);
  const nextThreshold =
    stats.level < LEVEL_THRESHOLDS.length - 1
      ? LEVEL_THRESHOLDS[stats.level + 1]
      : LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];

  // Next level reward preview
  const nextReward = getLevelReward(stats.level + 1);
  const rewardLabel = nextReward
    ? nextReward.type === 'frame'
      ? `头像框「${nextReward.id}」`
      : `头像「${nextReward.id}」`
    : null;

  return (
    <>
      {/* Level row */}
      <View style={styles.growthLevelRow}>
        <Text style={styles.growthLevelLabel}>Lv.{stats.level}</Text>
        <Text style={styles.growthLevelValue}>{stats.gamesPlayed} 局</Text>
      </View>

      {/* XP progress bar */}
      <View style={styles.growthXpRow}>
        <Text style={styles.growthXpLabel}>XP</Text>
        <View style={styles.growthProgressBarBg}>
          <View style={[styles.growthProgressBarFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.growthXpValue}>
          {stats.xp}/{nextThreshold}
        </Text>
      </View>

      {/* Next reward preview */}
      {rewardLabel && (
        <Text style={[styles.growthLevelValue, { color: colors.textMuted }]}>
          下一级解锁：{rewardLabel}
        </Text>
      )}
    </>
  );
});

GrowthSection.displayName = 'GrowthSection';
