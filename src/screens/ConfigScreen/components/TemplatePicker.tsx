/**
 * TemplatePicker - 模板选择 Modal
 *
 * 全屏滑出 Modal，展示预设模板列表供用户选择。
 *
 * ✅ 允许：渲染 UI + 上报 onSelect
 * ❌ 禁止：import service / 业务逻辑判断
 */
import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { typography } from '@/theme';

import type { DropdownOption } from './Dropdown';
import type { ConfigScreenStyles } from './styles';

export interface TemplatePickerProps {
  visible: boolean;
  onClose: () => void;
  options: DropdownOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  styles: ConfigScreenStyles;
}

const arePropsEqual = (prev: TemplatePickerProps, next: TemplatePickerProps): boolean =>
  prev.visible === next.visible &&
  prev.selectedValue === next.selectedValue &&
  prev.options === next.options &&
  prev.styles === next.styles;

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
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.modalContent}>
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
          <ScrollView>
            {options.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.modalOption,
                  option.value === selectedValue && styles.modalOptionSelected,
                ]}
                onPress={() => handleSelect(option.value)}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    option.value === selectedValue && styles.modalOptionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
                {option.value === selectedValue && (
                  <Ionicons
                    name="checkmark"
                    size={typography.body}
                    color={styles.modalOptionCheck.color as string}
                  />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}, arePropsEqual);
