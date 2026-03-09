/**
 * RoleListByFaction - 按阵营分组的角色展示组件
 *
 * 将 roles[] 按阵营分为 🐺狼人 / ✨神职 / 👤村民 / 🎭特殊 四组，
 * 每组渲染带阵营色的 chip 行。复用 BoardInfoCard 的展示模式。
 * 渲染 UI，不 import service，不包含业务逻辑判断。
 */
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { memo, useMemo } from 'react';
import { Text, View } from 'react-native';

import { useColors, withAlpha } from '@/theme';

import { type FactionStats, groupRolesByFaction, type TemplateRoleItem } from '../configHelpers';
import type { TemplatePickerStyles } from './templatePicker.styles';

// ─────────────────────────────────────────────────────────────────────────────

interface RoleListByFactionProps {
  roles: RoleId[];
  styles: TemplatePickerStyles;
}

/** Render a single faction group row with chips */
function FactionRow({
  label,
  items,
  colorToken,
  styles,
}: {
  label: string;
  items: readonly TemplateRoleItem[];
  colorToken: string;
  styles: TemplatePickerStyles;
}) {
  if (items.length === 0) return null;
  return (
    <View style={styles.factionRow}>
      <Text style={styles.factionRowLabel}>{label}</Text>
      <View style={styles.factionChipWrap}>
        {items.map((item) => (
          <View
            key={item.roleId}
            style={[
              styles.factionChip,
              { borderColor: colorToken, backgroundColor: withAlpha(colorToken, 0.08) },
            ]}
          >
            <Text style={[styles.factionChipText, { color: colorToken }]}>
              {item.count > 1 ? `${item.displayName}×${item.count}` : item.displayName}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export const RoleListByFaction = memo<RoleListByFactionProps>(({ roles, styles }) => {
  const colors = useColors();

  const { wolfItems, godItems, villagerItems, thirdItems } = useMemo(
    () => groupRolesByFaction(roles),
    [roles],
  );

  return (
    <View style={styles.roleListContainer}>
      <FactionRow label="🐺 狼人" items={wolfItems} colorToken={colors.wolf} styles={styles} />
      <FactionRow label="✨ 神职" items={godItems} colorToken={colors.god} styles={styles} />
      <FactionRow
        label="👤 村民"
        items={villagerItems}
        colorToken={colors.villager}
        styles={styles}
      />
      <FactionRow label="🎭 特殊" items={thirdItems} colorToken={colors.third} styles={styles} />
    </View>
  );
});

RoleListByFaction.displayName = 'RoleListByFaction';

/** Inline faction stat badges for the collapsed card view */
export const FactionStatBadges = memo<{
  stats: FactionStats;
  styles: TemplatePickerStyles;
}>(({ stats, styles }) => {
  const colors = useColors();
  return (
    <View style={styles.factionStatRow}>
      <View style={[styles.factionStatBadge, { backgroundColor: withAlpha(colors.wolf, 0.12) }]}>
        <Text style={[styles.factionStatText, { color: colors.wolf }]}>🐺{stats.wolfCount}</Text>
      </View>
      <View style={[styles.factionStatBadge, { backgroundColor: withAlpha(colors.god, 0.12) }]}>
        <Text style={[styles.factionStatText, { color: colors.god }]}>✨{stats.godCount}</Text>
      </View>
      <View
        style={[styles.factionStatBadge, { backgroundColor: withAlpha(colors.villager, 0.12) }]}
      >
        <Text style={[styles.factionStatText, { color: colors.villager }]}>
          👤{stats.villagerCount}
        </Text>
      </View>
      {stats.thirdCount > 0 && (
        <View style={[styles.factionStatBadge, { backgroundColor: withAlpha(colors.third, 0.12) }]}>
          <Text style={[styles.factionStatText, { color: colors.third }]}>
            🎭{stats.thirdCount}
          </Text>
        </View>
      )}
    </View>
  );
});

FactionStatBadges.displayName = 'FactionStatBadges';
