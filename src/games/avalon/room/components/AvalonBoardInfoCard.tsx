/**
 * 阿瓦隆板子信息卡：显示本局角色配置，点角色看技能介绍。
 * 对齐狼人杀 BoardInfoCard（可折叠、角色可点）；chip 复用共享 FactionChip。
 */

import {
  AVALON_BOARDS,
  type AvalonRoleId,
  isAvalonPlayerCount,
} from '@game-judge/game-engine/games/avalon/public';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { FactionChip } from '@/components/FactionChip';
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

  // 按 roleId 分组计数，对齐狼人杀"村民×3"显示。
  const groupRoles = (roles: readonly AvalonRoleId[]) => {
    const counts = new Map<AvalonRoleId, number>();
    for (const roleId of roles) {
      counts.set(roleId, (counts.get(roleId) ?? 0) + 1);
    }
    return [...counts.entries()];
  };
  const goodRoles = groupRoles(board.filter((r) => !getAvalonRoleMeta(r).isEvil));
  const evilRoles = groupRoles(board.filter((r) => getAvalonRoleMeta(r).isEvil));
  const goodCount = goodRoles.reduce((sum, [, count]) => sum + count, 0);
  const evilCount = evilRoles.reduce((sum, [, count]) => sum + count, 0);

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setIsCollapsed(!isCollapsed)}
        testID="avalon-board-info-toggle"
      >
        <Text style={styles.title}>
          {playerCount}人局 · 好人{goodCount} vs 坏人{evilCount}
        </Text>
        <Text style={styles.toggle}>{isCollapsed ? '展开' : '收起'}</Text>
      </TouchableOpacity>
      {!isCollapsed && (
        <View style={styles.body}>
          <View style={styles.factionRow}>
            <Text style={styles.factionLabel}>好人</Text>
            {goodRoles.map(([roleId, count]) => (
              <FactionChip
                key={roleId}
                label={
                  count > 1
                    ? `${getAvalonRoleMeta(roleId).displayName}×${count}`
                    : getAvalonRoleMeta(roleId).displayName
                }
                color={colors.primary}
                size="md"
                onPress={() => onRolePress(roleId)}
              />
            ))}
          </View>
          <View style={styles.factionRow}>
            <Text style={styles.factionLabel}>坏人</Text>
            {evilRoles.map(([roleId, count]) => (
              <FactionChip
                key={roleId}
                label={
                  count > 1
                    ? `${getAvalonRoleMeta(roleId).displayName}×${count}`
                    : getAvalonRoleMeta(roleId).displayName
                }
                color={colors.error}
                size="md"
                onPress={() => onRolePress(roleId)}
              />
            ))}
          </View>
        </View>
      )}
    </View>
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
});
