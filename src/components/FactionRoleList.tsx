/**
 * FactionRoleList — 阵营统计 badge + 分阵营 FactionChip 行
 *
 * 共享展示组件，BoardPickerScreen（展开卡）和 BoardNominationModal 均使用。
 * 接收 roles 数组，内部调用 computeFactionStats / groupRolesByFaction，
 * 渲染"狼N 神N 民N 特N"badge 行 + 按阵营分组的 FactionChip 行。
 * 纯展示组件，不 import service，不包含业务逻辑。
 */
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FactionChip } from '@/components/FactionChip';
import { computeFactionStats, groupRolesByFaction } from '@/screens/ConfigScreen/configHelpers';
import { borderRadius, componentSizes, spacing, typography, useColors, withAlpha } from '@/theme';

interface FactionRoleListProps {
  roles: readonly RoleId[];
  /** Callback when a role chip is pressed (e.g. show role detail). Omit to make chips non-interactive. */
  onRolePress?: (roleId: string) => void;
  /** Whether to show faction stat badges row. Default: true */
  showStats?: boolean;
}

export const FactionRoleList = memo<FactionRoleListProps>(function FactionRoleList({
  roles,
  onRolePress,
  showStats = true,
}) {
  const colors = useColors();

  const stats = useMemo(() => computeFactionStats(roles as RoleId[]), [roles]);
  const { wolfItems, godItems, villagerItems, thirdItems } = useMemo(
    () => groupRolesByFaction(roles as RoleId[]),
    [roles],
  );

  return (
    <View>
      {/* Faction stat badges */}
      {showStats && (
        <View style={styles.factionStatRow}>
          <View
            style={[styles.factionStatBadge, { backgroundColor: withAlpha(colors.wolf, 0.12) }]}
          >
            <Text style={[styles.factionStatText, { color: colors.wolf }]}>
              狼{stats.wolfCount}
            </Text>
          </View>
          <View style={[styles.factionStatBadge, { backgroundColor: withAlpha(colors.god, 0.12) }]}>
            <Text style={[styles.factionStatText, { color: colors.god }]}>神{stats.godCount}</Text>
          </View>
          <View
            style={[styles.factionStatBadge, { backgroundColor: withAlpha(colors.villager, 0.12) }]}
          >
            <Text style={[styles.factionStatText, { color: colors.villager }]}>
              民{stats.villagerCount}
            </Text>
          </View>
          {stats.thirdCount > 0 && (
            <View
              style={[styles.factionStatBadge, { backgroundColor: withAlpha(colors.third, 0.12) }]}
            >
              <Text style={[styles.factionStatText, { color: colors.third }]}>
                特{stats.thirdCount}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Faction chip rows */}
      <View style={styles.roleListContainer}>
        {wolfItems.length > 0 && (
          <View style={styles.factionRow}>
            <Text style={[styles.factionRowLabel, { color: colors.textSecondary }]}>狼人</Text>
            <View style={styles.factionChipWrap}>
              {wolfItems.map((item) => (
                <FactionChip
                  key={item.roleId}
                  label={item.count > 1 ? `${item.displayName}×${item.count}` : item.displayName}
                  color={colors.wolf}
                  size="sm"
                  onPress={onRolePress ? () => onRolePress(item.roleId) : undefined}
                />
              ))}
            </View>
          </View>
        )}
        {godItems.length > 0 && (
          <View style={styles.factionRow}>
            <Text style={[styles.factionRowLabel, { color: colors.textSecondary }]}>神职</Text>
            <View style={styles.factionChipWrap}>
              {godItems.map((item) => (
                <FactionChip
                  key={item.roleId}
                  label={item.count > 1 ? `${item.displayName}×${item.count}` : item.displayName}
                  color={colors.god}
                  size="sm"
                  onPress={onRolePress ? () => onRolePress(item.roleId) : undefined}
                />
              ))}
            </View>
          </View>
        )}
        {villagerItems.length > 0 && (
          <View style={styles.factionRow}>
            <Text style={[styles.factionRowLabel, { color: colors.textSecondary }]}>村民</Text>
            <View style={styles.factionChipWrap}>
              {villagerItems.map((item) => (
                <FactionChip
                  key={item.roleId}
                  label={item.count > 1 ? `${item.displayName}×${item.count}` : item.displayName}
                  color={colors.villager}
                  size="sm"
                  onPress={onRolePress ? () => onRolePress(item.roleId) : undefined}
                />
              ))}
            </View>
          </View>
        )}
        {thirdItems.length > 0 && (
          <View style={styles.factionRow}>
            <Text style={[styles.factionRowLabel, { color: colors.textSecondary }]}>特殊</Text>
            <View style={styles.factionChipWrap}>
              {thirdItems.map((item) => (
                <FactionChip
                  key={item.roleId}
                  label={item.count > 1 ? `${item.displayName}×${item.count}` : item.displayName}
                  color={colors.third}
                  size="sm"
                  onPress={onRolePress ? () => onRolePress(item.roleId) : undefined}
                />
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  factionStatRow: {
    flexDirection: 'row',
    gap: spacing.small,
    marginBottom: spacing.small,
  },
  factionStatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.micro,
    borderRadius: borderRadius.full,
  },
  factionStatText: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.semibold,
  },
  roleListContainer: {
    gap: spacing.small,
  },
  factionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.small,
  },
  factionRowLabel: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.medium,
    width: componentSizes.button.sm + spacing.tight,
    flexShrink: 0,
  },
  factionChipWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.tight,
  },
});
