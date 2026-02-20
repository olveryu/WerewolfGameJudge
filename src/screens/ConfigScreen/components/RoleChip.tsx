/**
 * RoleChip - 角色选择标签（Memoized）
 *
 * 带阵营色选中状态。渲染 UI 并通过回调上报 onToggle，不 import service，不包含业务逻辑判断。
 * 变体 chip 用双色边框区分，长按触发变体选择。
 * 所有 chip 长按可查看技能说明。
 */
import { memo } from 'react';
import { Text, TouchableOpacity } from 'react-native';

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
  /** Whether this chip has variant alternatives (dual-color border hint). */
  hasVariants?: boolean;
  /** Long-press handler for opening variant picker (variant chips). */
  onVariantPress?: (id: string) => void;
  /** Long-press handler for showing role info (all chips). */
  onInfoPress?: (id: string) => void;
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
    onVariantPress,
    onInfoPress,
  }) => {
    const selectedStyle = factionColor
      ? styles[FACTION_STYLE_MAP[factionColor]]
      : styles.chipSelected;

    // Variant chips → variant picker; non-variant chips → role info sheet
    const handleLongPress =
      hasVariants && onVariantPress
        ? () => onVariantPress(id)
        : onInfoPress
          ? () => onInfoPress(id)
          : undefined;

    return (
      <TouchableOpacity
        testID={TESTIDS.configRoleChip(id)}
        style={[
          styles.chip,
          hasVariants && !selected && styles.chipVariant,
          selected && selectedStyle,
        ]}
        onPress={() => onToggle(id)}
        onLongPress={handleLongPress}
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
      </TouchableOpacity>
    );
  },
);

RoleChip.displayName = 'RoleChip';
