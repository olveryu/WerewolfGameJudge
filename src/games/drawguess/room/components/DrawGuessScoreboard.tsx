/**
 * 计分板：座位、得分与排名。终局按竞赛排名 1、2、2、4 顺延。
 */

import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { borderRadius, colors, fixed, spacing, textStyles } from '@/theme';

export interface DrawGuessScoreboardRow {
  readonly seat: number;
  readonly displayName: string;
  readonly isBot: boolean;
  readonly isDrawer: boolean;
  readonly score: number;
}

interface DrawGuessScoreboardProps {
  readonly title: string;
  /** 按竞赛排名展示（同分并列，下一名次跳过）；false 则只按得分降序。 */
  readonly competitionRanking: boolean;
  readonly rows: readonly DrawGuessScoreboardRow[];
}

/** 按得分降序排列；同分并列时按竞赛排名顺延。 */
function rankDrawGuessScoreboard(
  rows: readonly DrawGuessScoreboardRow[],
): readonly (DrawGuessScoreboardRow & { readonly rank: number })[] {
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  let rank = 0;
  let previousScore: number | null = null;
  return sorted.map((row, index) => {
    if (previousScore === null || row.score !== previousScore) rank = index + 1;
    previousScore = row.score;
    return { ...row, rank };
  });
}

function rankLabel(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `第${rank}名`;
}

/** 本轮得分 / 终局总分榜。 */
export const DrawGuessScoreboard: React.FC<DrawGuessScoreboardProps> = ({
  title,
  competitionRanking,
  rows,
}) => {
  const ranked = competitionRanking
    ? rankDrawGuessScoreboard(rows)
    : [...rows]
        .sort((a, b) => b.score - a.score)
        .map((row, index) => ({ ...row, rank: index + 1 }));
  return (
    <View style={styles.container} accessibilityLabel={title}>
      <Text style={styles.title}>{title}</Text>
      {ranked.map((row) => (
        <View key={row.seat} style={styles.row}>
          <Text style={styles.rank}>
            {competitionRanking ? rankLabel(row.rank) : `${row.rank}`}
          </Text>
          <Text style={styles.name} numberOfLines={1}>
            {row.displayName}
            {row.isBot ? ' · 机器人' : ''}
            {row.isDrawer ? ' · 画手' : ''}
          </Text>
          <Text style={styles.score}>{row.score} 分</Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    gap: spacing.tight,
  },
  title: {
    ...textStyles.subtitleSemibold,
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    paddingVertical: spacing.tight,
  },
  rank: {
    ...textStyles.secondarySemibold,
    color: colors.textSecondary,
    minWidth: 52,
  },
  name: {
    ...textStyles.body,
    color: colors.text,
    flex: 1,
  },
  score: {
    ...textStyles.bodySemibold,
    color: colors.primary,
  },
});
