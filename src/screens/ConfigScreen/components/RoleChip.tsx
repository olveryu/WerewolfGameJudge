/**
 * RoleChip - 角色选择标签（Memoized）
 *
 * 带阵营色选中状态。
 *
 * ✅ 允许：渲染 UI + 上报 onToggle
 * ❌ 禁止：import service / 业务逻辑判断
 */
import React, { memo } from 'react';
import { Text,TouchableOpacity } from 'react-native';

import { ConfigScreenStyles } from './styles';

export type FactionColorKey = 'wolf' | 'good' | 'neutral';

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
}

const FACTION_STYLE_MAP: Record<FactionColorKey, keyof ConfigScreenStyles> = {
  wolf: 'chipSelectedWolf',
  good: 'chipSelectedGood',
  neutral: 'chipSelectedNeutral',
};

const arePropsEqual = (prev: RoleChipProps, next: RoleChipProps): boolean => {
  return (
    prev.id === next.id &&
    prev.label === next.label &&
    prev.selected === next.selected &&
    prev.factionColor === next.factionColor &&
    prev.accentColor === next.accentColor &&
    prev.styles === next.styles
    // onToggle excluded - stable via useCallback
  );
};

export const RoleChip = memo<RoleChipProps>(
  ({ id, label, selected, onToggle, styles, factionColor, accentColor }) => {
    const selectedStyle = factionColor
      ? styles[FACTION_STYLE_MAP[factionColor]]
      : styles.chipSelected;

    return (
      <TouchableOpacity
        testID={`config-role-chip-${id}`}
        style={[styles.chip, selected && selectedStyle]}
        onPress={() => onToggle(id)}
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
  arePropsEqual,
);

RoleChip.displayName = 'RoleChip';
