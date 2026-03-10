/**
 * SettingsChipGroup — 设置面板选项分组（label + chip grid）
 *
 * 声明式组合：label + 自适应列数 chip grid。
 * 内置分组卡片化样式（background 色 + borderRadius.medium），在 surface 底板上形成轻量层级。
 * 纯 UI 组件：接收选项列表、选中值和回调，不 import service，不包含业务逻辑。
 */
import { memo, useCallback } from 'react';
import { Text, type TextStyle, View, type ViewStyle } from 'react-native';

import { SettingsChip } from './SettingsChip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SettingsOption {
  value: string;
  label: string;
}

interface SettingsChipGroupStyles {
  groupCard: ViewStyle;
  groupLabel: TextStyle;
  chipWrap: ViewStyle;
  chip: ViewStyle;
  chipSelected: ViewStyle;
  chipText: TextStyle;
  chipTextSelected: TextStyle;
}

interface SettingsChipGroupProps {
  label: string;
  options: readonly SettingsOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  styles: SettingsChipGroupStyles;
  testIDPrefix: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SettingsChipGroup = memo<SettingsChipGroupProps>(function SettingsChipGroup({
  label,
  options,
  selectedValue,
  onSelect,
  styles,
  testIDPrefix,
}) {
  const handleSelect = useCallback(
    (value: string) => {
      onSelect(value);
    },
    [onSelect],
  );

  return (
    <View style={styles.groupCard} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.chipWrap}>
        {options.map((opt) => (
          <SettingsChip
            key={opt.value}
            value={opt.value}
            label={opt.label}
            selected={opt.value === selectedValue}
            onSelect={handleSelect}
            styles={styles}
            testID={`${testIDPrefix}-option-${opt.value}`}
          />
        ))}
      </View>
    </View>
  );
});
