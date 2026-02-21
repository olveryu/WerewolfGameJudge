/**
 * RoleInfoSheet - 角色技能说明底部弹窗
 *
 * 长按角色 chip 时弹出，展示角色名称与技能描述。
 * 纯 UI 组件，不 import service，不包含业务逻辑。
 */
import { isValidRoleId, ROLE_SPECS } from '@werewolf/game-engine/models/roles';
import { memo } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

import type { ConfigScreenStyles } from './styles';

export interface RoleInfoSheetProps {
  /** The roleId to display info for, or null when hidden. */
  roleId: string | null;
  onClose: () => void;
  styles: ConfigScreenStyles;
}

export const RoleInfoSheet = memo(function RoleInfoSheet({
  roleId,
  onClose,
  styles,
}: RoleInfoSheetProps) {
  const spec = roleId && isValidRoleId(roleId) ? ROLE_SPECS[roleId] : null;

  return (
    <Modal visible={roleId !== null} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.variantPickerOverlay} activeOpacity={1} onPress={onClose}>
        <View
          style={styles.variantPickerContent}
          onStartShouldSetResponder={() => true}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <View style={styles.variantPickerHandle} />
          <Text style={styles.variantPickerTitle}>{spec?.displayName ?? roleId}</Text>
          {spec?.description ? <Text style={styles.roleInfoDesc}>{spec.description}</Text> : null}
        </View>
      </TouchableOpacity>
    </Modal>
  );
});
