/**
 * SettingsChip — 设置面板选项 chip（可复用）
 *
 * 基于 PressableScale 提供 iOS 风格弹簧缩放微动效。
 * 支持 selected / unselected 视觉状态和 accessibilityRole='radio'。
 * 纯 UI 组件：接收样式 props 和 onPress 回调，不 import service，不包含业务逻辑。
 */
import { memo, useCallback } from 'react';
import { Text, type TextStyle, type ViewStyle } from 'react-native';

import { PressableScale } from '@/components/PressableScale';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SettingsChipStyles {
  chip: ViewStyle;
  chipSelected: ViewStyle;
  chipText: TextStyle;
  chipTextSelected: TextStyle;
}

interface SettingsChipProps {
  value: string;
  label: string;
  selected: boolean;
  onSelect: (value: string) => void;
  styles: SettingsChipStyles;
  testID?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SettingsChip = memo<SettingsChipProps>(function SettingsChip({
  value,
  label,
  selected,
  onSelect,
  styles,
  testID,
}) {
  const handlePress = useCallback(() => {
    onSelect(value);
  }, [onSelect, value]);

  return (
    <PressableScale
      onPress={handlePress}
      style={[styles.chip, selected && styles.chipSelected]}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </PressableScale>
  );
});
