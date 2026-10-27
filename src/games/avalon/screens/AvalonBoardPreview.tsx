/** Read-only board for the selected player count: roles grouped as shipped, quest sizes, Lady note. */

import {
  AVALON_BOARDS,
  AVALON_LADY_MIN_PLAYERS,
  AVALON_QUEST_SIZES,
  type AvalonConfig,
  type AvalonRoleId,
  isAvalonPlayerCount,
} from '@game-judge/game-engine/games/avalon/public';
import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { borderRadius, colors, fixed, spacing, textStyles } from '@/theme';

import { getAvalonRoleDisplayName } from '../model/avalonRoleDisplay';

/** Renders nothing while the typed count is outside the supported boards (inline issue covers it). */
export const AvalonBoardPreview: React.FC<{ readonly config: AvalonConfig }> = ({ config }) => {
  const playerCount: number = config.numberOfPlayers;
  if (!isAvalonPlayerCount(playerCount)) return null;
  const roles: readonly AvalonRoleId[] = AVALON_BOARDS[playerCount];
  const questSizes = AVALON_QUEST_SIZES[playerCount];
  return (
    <View style={styles.container}>
      <Text style={styles.title}>本局板子（{playerCount} 人）</Text>
      <View style={styles.roleRow}>
        {roles.map((role, index) => (
          <View key={`${role}-${index}`} style={styles.roleChip}>
            <Text style={styles.roleText}>{getAvalonRoleDisplayName(role)}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.hint}>
        任务人数：{questSizes.join('-')}
        {playerCount >= AVALON_LADY_MIN_PLAYERS ? ' · 含湖中仙女' : ''}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: spacing.tight,
    padding: spacing.small,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
  },
  title: { ...textStyles.subtitleSemibold, color: colors.text },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.tight },
  roleChip: {
    paddingVertical: spacing.tight,
    paddingHorizontal: spacing.small,
    backgroundColor: colors.surfaceHover,
    borderRadius: borderRadius.small,
  },
  roleText: { ...textStyles.secondary, color: colors.text },
  hint: { ...textStyles.caption, color: colors.textSecondary },
});
