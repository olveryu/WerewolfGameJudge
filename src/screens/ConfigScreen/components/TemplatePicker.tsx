/**
 * TemplatePicker - 模板选择 Modal
 *
 * 底部滑出 Modal，使用 chip 平铺展示预设模板供用户选择。
 * 选中即关闭 Modal。
 * 渲染 UI 并通过回调上报 onSelect，不 import service，不包含业务逻辑判断。
 */
import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

import { spacing, typography } from '@/theme';

import type { DropdownOption } from './Dropdown';
import type { ConfigScreenStyles } from './styles';

interface TemplatePickerProps {
  visible: boolean;
  onClose: () => void;
  options: DropdownOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  styles: ConfigScreenStyles;
}

export const TemplatePicker = memo(function TemplatePicker({
  visible,
  onClose,
  options,
  selectedValue,
  onSelect,
  styles,
}: TemplatePickerProps) {
  const handleSelect = useCallback(
    (value: string) => {
      onSelect(value);
    },
    [onSelect],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View
          style={styles.modalContent}
          onStartShouldSetResponder={() => true}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>选择板子</Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <Ionicons
                name="close"
                size={typography.title}
                color={styles.modalCloseBtnText.color as string}
              />
            </TouchableOpacity>
          </View>
          <View style={[styles.settingsChipWrap, { padding: spacing.medium }]}>
            {options.map((option) => {
              const selected = option.value === selectedValue;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.settingsChip, selected && styles.settingsChipSelected]}
                  onPress={() => handleSelect(option.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.settingsChipText, selected && styles.settingsChipTextSelected]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
});
