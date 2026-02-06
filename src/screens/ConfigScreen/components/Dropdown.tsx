/**
 * Dropdown - Memoized dropdown selector with Modal
 *
 * Performance: Receives pre-created styles from parent.
 */
import React, { memo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { ConfigScreenStyles } from './styles';

export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownProps {
  label: string;
  value: string;
  options: DropdownOption[];
  onSelect: (value: string) => void;
  styles: ConfigScreenStyles;
}

const arePropsEqual = (prev: DropdownProps, next: DropdownProps): boolean => {
  return (
    prev.label === next.label &&
    prev.value === next.value &&
    prev.styles === next.styles &&
    // options rarely change, but check length for safety
    prev.options.length === next.options.length
    // onSelect excluded - stable via useCallback
  );
};

export const Dropdown = memo<DropdownProps>(({ label, value, options, onSelect, styles }) => {
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
      <TouchableOpacity style={styles.settingsSelector} onPress={handleOpen} activeOpacity={0.7}>
        <Text style={styles.settingsSelectorText} numberOfLines={1}>
          {selectedOption?.label ?? value}
        </Text>
        <Text style={styles.settingsSelectorArrow}>▼</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={handleClose}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label || '选择'}</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={handleClose}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {options.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.modalOption, option.value === value && styles.modalOptionSelected]}
                  onPress={() => handleSelect(option.value)}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      option.value === value && styles.modalOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {option.value === value && <Text style={styles.modalOptionCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}, arePropsEqual);

Dropdown.displayName = 'Dropdown';
