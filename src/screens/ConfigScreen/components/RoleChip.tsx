/**
 * RoleChip - 角色选择标签（Memoized）
 *
 * 带阵营色选中状态。渲染 UI 并通过回调上报 onToggle，不 import service，不包含业务逻辑判断。
 * 当 hasVariants 为 true 时，chip 右下角显示 ▾ 指示器，长按触发变体选择。
 */
import { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { TESTIDS } from '@/testids';

import { ConfigScreenStyles } from './styles';

export type FactionColorKey = 'wolf' | 'god' | 'villager' | 'neutral';

export interface RoleChipProps {
  id: string;
  label: string;
  selected: boolean;
  onToggle: (id: string) => void;
  styles: ConfigScreenStyles;
  /** Faction color key for the selected state. Falls back to primary if omitted. */
  factionColor?: FactionColorKey;
  /** Accent color for selected text. Falls back to text color if omitted. */
  accentColor?: string;
  /** Whether this chip has variant alternatives (shows ▾ indicator). */
  hasVariants?: boolean;
  /** Long-press handler for opening variant picker. */
  onLongPress?: (id: string) => void;
}

const FACTION_STYLE_MAP: Record<FactionColorKey, keyof ConfigScreenStyles> = {
  wolf: 'chipSelectedWolf',
  god: 'chipSelectedGod',
  villager: 'chipSelectedVillager',
  neutral: 'chipSelectedNeutral',
};

export const RoleChip = memo<RoleChipProps>(
  ({
    id,
    label,
    selected,
    onToggle,
    styles,
    factionColor,
    accentColor,
    hasVariants,
    onLongPress,
  }) => {
    const selectedStyle = factionColor
      ? styles[FACTION_STYLE_MAP[factionColor]]
      : styles.chipSelected;

    return (
      <TouchableOpacity
        testID={TESTIDS.configRoleChip(id)}
        style={[styles.chip, selected && selectedStyle]}
        onPress={() => onToggle(id)}
        onLongPress={hasVariants && onLongPress ? () => onLongPress(id) : undefined}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.chipText,
            selected && styles.chipTextSelected,
            selected && accentColor ? { color: accentColor } : undefined,
          ]}
        >
          {label}
        </Text>
        {hasVariants && (
          <View style={styles.chipVariantBadge}>
            <Text style={styles.chipVariantBadgeText}>▾</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  },
);

RoleChip.displayName = 'RoleChip';
