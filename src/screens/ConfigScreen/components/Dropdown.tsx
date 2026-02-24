/**
 * Dropdown - 下拉选择器（Memoized，带 Modal）
 *
 * 支持 testID 子 ID 约定（trigger / option / overlay）。
 * 渲染 UI 并通过回调上报 onSelect，不 import service，不包含业务逻辑判断。
 *
 * ## testID convention (E2E only)
 *
 * When the caller passes `testID="foo"`, three sub-IDs are generated:
 *
 * | Element         | testID                   | Example                       |
 * |-----------------|--------------------------|-------------------------------|
 * | Trigger button  | `{testID}`               | `config-animation`            |
 * | Each option     | `{testID}-option-{value}` | `config-animation-option-none`|
 * | Modal overlay   | `{testID}-overlay`       | `config-animation-overlay`    |
 *
 * - `value` is the **enum/stable value** from `DropdownOption.value`, NOT the
 *   display label. This keeps selectors stable across i18n/label changes.
 * - When `testID` is omitted (undefined), **no extra testID attributes** are
 *   emitted — behavior is identical to the pre-testID version.
 * - Overlay testID is scoped to this Dropdown instance's Modal, so multiple
 *   Dropdowns on the same screen won't collide (each has a unique prefix).
 */
import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { typography } from '@/theme';

import { ConfigScreenStyles } from './styles';

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  label: string;
  value: string;
  options: DropdownOption[];
  onSelect: (value: string) => void;
  styles: ConfigScreenStyles;
  /** Stable testID prefix. Generates: `{testID}` (trigger), `{testID}-option-{value}` (each option), `{testID}-overlay` (backdrop). */
  testID?: string;
}

export const Dropdown = memo<DropdownProps>(
  ({ label, value, options, onSelect, styles, testID }) => {
    const [visible, setVisible] = useState(false);

    const selectedOption = options.find((o) => o.value === value);

    const handleOpen = useCallback(() => {
      setVisible(true);
    }, []);

    const handleClose = useCallback(() => {
      setVisible(false);
    }, []);

    const handleSelect = useCallback(
      (optionValue: string) => {
        onSelect(optionValue);
        setVisible(false);
      },
      [onSelect],
    );

    return (
      <View style={styles.settingsItem}>
        {label ? <Text style={styles.settingsLabel}>{label}</Text> : null}
        <TouchableOpacity
          style={styles.settingsSelector}
          onPress={handleOpen}
          activeOpacity={0.7}
          testID={testID}
        >
          <Text style={styles.settingsSelectorText} numberOfLines={1}>
            {selectedOption?.label ?? value}
          </Text>
          <Text style={styles.settingsSelectorArrow}>▼</Text>
        </TouchableOpacity>

        <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={handleClose}
            testID={testID ? `${testID}-overlay` : undefined}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{label || '选择'}</Text>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={handleClose}>
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
                      option.value === value && styles.modalOptionSelected,
                    ]}
                    onPress={() => handleSelect(option.value)}
                    testID={testID ? `${testID}-option-${option.value}` : undefined}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        option.value === value && styles.modalOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {option.value === value && (
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
      </View>
    );
  },
);

Dropdown.displayName = 'Dropdown';
