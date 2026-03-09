/**
 * RoleChip - 角色选择标签（Memoized）
 *
 * 带阵营色选中状态。渲染 UI 并通过回调上报 onToggle，不 import service，不包含业务逻辑判断。
 * 变体 chip 用双色边框区分。所有 chip 长按可查看技能说明（变体角色在卡片内切换变体）。
 */
import { memo } from 'react';
import { Text, TouchableOpacity } from 'react-native';

import { TESTIDS } from '@/testids';
import { fixed } from '@/theme/tokens';

import { ConfigScreenStyles } from './styles';

export type FactionColorKey = 'wolf' | 'god' | 'villager' | 'neutral';

interface RoleChipProps {
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
  /** Long-press handler for showing role info card (all chips). */
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
    onInfoPress,
  }) => {
    const selectedStyle = factionColor
      ? styles[FACTION_STYLE_MAP[factionColor]]
      : styles.chipSelected;

    const handleLongPress = onInfoPress ? () => onInfoPress(id) : undefined;

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
        activeOpacity={fixed.activeOpacity}
        accessibilityLabel={label}
        accessibilityState={{ selected }}
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
