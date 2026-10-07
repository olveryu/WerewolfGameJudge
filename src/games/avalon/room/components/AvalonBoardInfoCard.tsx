/**
 * 阿瓦隆板子信息卡：显示本局角色配置，点角色看技能介绍。
 * 对齐狼人杀 BoardInfoCard（可折叠、角色可点）。
 */

import {
  AVALON_BOARDS,
  type AvalonRoleId,
  isAvalonPlayerCount,
} from '@game-judge/game-engine/games/avalon/public';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { borderRadius, colors, spacing, textStyles, typography } from '@/theme';

import { getAvalonRoleMeta } from '../../model/avalonRoleMeta';

export function AvalonBoardInfoCard({
  playerCount,
  onRolePress,
  collapsed = false,
}: {
  readonly playerCount: number;
  readonly onRolePress: (roleId: AvalonRoleId) => void;
  readonly collapsed?: boolean;
}) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  if (!isAvalonPlayerCount(playerCount)) return null;
  const board = AVALON_BOARDS[playerCount];

  const goodRoles = board.filter((r) => !getAvalonRoleMeta(r).isEvil);
  const evilRoles = board.filter((r) => getAvalonRoleMeta(r).isEvil);

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setIsCollapsed(!isCollapsed)}
        testID="avalon-board-info-toggle"
      >
        <Text style={styles.title}>
          {playerCount}人局 · 好人{goodRoles.length} vs 坏人{evilRoles.length}
        </Text>
        <Text style={styles.toggle}>{isCollapsed ? '展开' : '收起'}</Text>
      </TouchableOpacity>
      {!isCollapsed && (
        <View style={styles.body}>
          <View style={styles.factionRow}>
            <Text style={styles.factionLabel}>好人</Text>
            {goodRoles.map((roleId, idx) => (
              <RoleChip
                key={`${roleId}-${idx}`}
                roleId={roleId}
                onPress={() => onRolePress(roleId)}
              />
            ))}
          </View>
          <View style={styles.factionRow}>
            <Text style={styles.factionLabel}>坏人</Text>
            {evilRoles.map((roleId, idx) => (
              <RoleChip
                key={`${roleId}-${idx}`}
                roleId={roleId}
                onPress={() => onRolePress(roleId)}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function RoleChip({
  roleId,
  onPress,
}: {
  readonly roleId: AvalonRoleId;
  readonly onPress: () => void;
}) {
  const meta = getAvalonRoleMeta(roleId);
  return (
    <TouchableOpacity
      style={[styles.chip, meta.isEvil ? styles.chipEvil : styles.chipGood]}
      onPress={onPress}
      testID={`avalon-role-chip-${roleId}`}
    >
      <Text style={meta.isEvil ? styles.chipTextEvil : styles.chipText}>{meta.displayName}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
    padding: spacing.small,
    marginBottom: spacing.small,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    ...textStyles.body,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  toggle: {
    ...textStyles.secondary,
    color: colors.primary,
  },
  body: {
    marginTop: spacing.small,
    gap: spacing.small,
  },
  factionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.tight,
  },
  factionLabel: {
    ...textStyles.secondary,
    color: colors.textSecondary,
    minWidth: spacing.large,
  },
  chip: {
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.tight,
    borderRadius: borderRadius.medium,
  },
  chipGood: {
    backgroundColor: colors.primaryLight,
  },
  chipEvil: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.error,
  },
  chipText: {
    ...textStyles.secondary,
    color: colors.text,
  },
  chipTextEvil: {
    ...textStyles.secondary,
    color: colors.error,
  },
});
