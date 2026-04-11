/**
 * GrowthSection — 成长区块（Memoized）
 *
 * 显示等级 + 称号、XP 进度条、上局月相结算横幅、角色收集入口。
 * 嵌入账户 card 内部，不自带 card 容器。
 */
import { Ionicons } from '@expo/vector-icons';
import { getLevelProgress, getLevelTitle, LEVEL_THRESHOLDS } from '@werewolf/game-engine/growth';
import { MOON_PHASES } from '@werewolf/game-engine/growth';
import { memo, useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import type { UserStats } from '@/services/feature/StatsService';
import { typography, useColors } from '@/theme';

import type { SettingsScreenStyles } from './styles';

interface GrowthSectionProps {
  stats: UserStats;
  styles: SettingsScreenStyles;
  showMoonBanner: boolean;
  onDismissMoon: () => void;
  onOpenCollection: () => void;
}

export const GrowthSection = memo<GrowthSectionProps>(
  ({ stats, styles, showMoonBanner, onDismissMoon, onOpenCollection }) => {
    const colors = useColors();

    const title = getLevelTitle(stats.level);
    const progress = getLevelProgress(stats.xp);
    const nextThreshold =
      stats.level < LEVEL_THRESHOLDS.length - 1
        ? LEVEL_THRESHOLDS[stats.level + 1]
        : LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];

    const moonPhase = useMemo(() => {
      if (!stats.lastMoonPhase) return null;
      return MOON_PHASES.find((p) => p.id === stats.lastMoonPhase!.id) ?? null;
    }, [stats.lastMoonPhase]);

    return (
      <>
        {/* Level + title */}
        <View style={styles.growthLevelRow}>
          <Text style={styles.growthLevelLabel}>
            Lv.{stats.level} · {title}
          </Text>
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

        {/* Moon phase banner (dismissable) */}
        {showMoonBanner && moonPhase && stats.lastMoonPhase && (
          <TouchableOpacity
            style={styles.growthMoonBanner}
            onPress={onDismissMoon}
            activeOpacity={0.7}
          >
            <Text style={styles.growthMoonIcon}>{moonPhase.icon}</Text>
            <Text style={styles.growthMoonText}>上局抽到「{moonPhase.name}」</Text>
            <Text style={styles.growthMoonXp}>+{stats.lastMoonPhase.xpEarned} XP</Text>
          </TouchableOpacity>
        )}

        {/* Collection entry */}
        <TouchableOpacity style={styles.growthCollectionEntry} onPress={onOpenCollection}>
          <View style={styles.growthCollectionContent}>
            <Text style={styles.growthCollectionText}>角色收集</Text>
            <Text style={styles.growthCollectionDesc}>
              {stats.rolesCollected}/{stats.totalRoles} 已解锁
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={typography.body} color={colors.textMuted} />
        </TouchableOpacity>
      </>
    );
  },
);

GrowthSection.displayName = 'GrowthSection';
