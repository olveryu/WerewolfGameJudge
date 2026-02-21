/**
 * VariantPicker - 角色变体选择底部弹窗
 *
 * 底部 Modal，radio-style 选择。列表项来自 ROLE_SPECS。
 * 渲染 UI 并通过回调上报 onSelect，不 import service，不包含业务逻辑判断。
 */
import { isValidRoleId, ROLE_SPECS } from '@werewolf/game-engine/models/roles';
import { memo, useCallback } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

import type { ConfigScreenStyles } from './styles';

export interface VariantPickerProps {
  visible: boolean;
  onClose: () => void;
  /** All variant roleIds for this slot (including the base role) */
  variantIds: string[];
  /** Currently active variant roleId */
  activeVariant: string;
  /** Called when user selects a variant */
  onSelect: (variantId: string) => void;
  styles: ConfigScreenStyles;
}

export const VariantPicker = memo(function VariantPicker({
  visible,
  onClose,
  variantIds,
  activeVariant,
  onSelect,
  styles,
}: VariantPickerProps) {
  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id);
      onClose();
    },
    [onSelect, onClose],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.variantPickerOverlay} activeOpacity={1} onPress={onClose}>
        <View
          style={styles.variantPickerContent}
          onStartShouldSetResponder={() => true}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <View style={styles.variantPickerHandle} />
          <Text style={styles.variantPickerTitle}>选择变体</Text>

          {variantIds.map((id) => {
            const spec = isValidRoleId(id) ? ROLE_SPECS[id] : undefined;
            const isSelected = id === activeVariant;
            return (
              <TouchableOpacity
                key={id}
                style={[
                  styles.variantPickerOption,
                  isSelected && styles.variantPickerOptionSelected,
                ]}
                onPress={() => handleSelect(id)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.variantPickerRadio,
                    isSelected && styles.variantPickerRadioSelected,
                  ]}
                >
                  {isSelected && <View style={styles.variantPickerRadioDot} />}
                </View>
                <View style={styles.variantPickerOptionContent}>
                  <Text style={styles.variantPickerOptionName}>{spec?.displayName ?? id}</Text>
                  {spec?.description && (
                    <Text style={styles.variantPickerOptionDesc}>{spec.description}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </TouchableOpacity>
    </Modal>
  );
});
