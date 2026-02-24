/**
 * NameSection - 昵称显示/编辑组件（Memoized）
 *
 * 接收父组件 styles，通过回调上报编辑/保存/取消意图。
 * 渲染 UI 并上报用户 intent，不 import service，不包含业务逻辑判断。
 */
import { memo } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import { ThemeColors } from '@/theme';

import { SettingsScreenStyles } from './styles';

interface NameSectionProps {
  isAnonymous: boolean;
  displayName: string | null;
  isEditingName: boolean;
  editName: string;
  onEditNameChange: (text: string) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  styles: SettingsScreenStyles;
  colors: ThemeColors;
}

export const NameSection = memo<NameSectionProps>(
  ({
    isAnonymous,
    displayName,
    isEditingName,
    editName,
    onEditNameChange,
    onStartEdit,
    onSave,
    onCancel,
    styles,
    colors,
  }) => {
    if (isAnonymous) {
      return <Text style={styles.userName}>匿名用户</Text>;
    }

    if (isEditingName) {
      return (
        <View style={styles.editNameRow}>
          <TextInput
            style={styles.nameInput}
            value={editName}
            onChangeText={onEditNameChange}
            placeholder="输入名字"
            placeholderTextColor={colors.textSecondary}
          />
          <TouchableOpacity style={styles.saveBtn} onPress={onSave}>
            <Text style={styles.saveBtnText}>保存</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>取消</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <TouchableOpacity style={styles.nameRow} onPress={onStartEdit}>
        <Text style={styles.userName}>{displayName || '点击设置名字'}</Text>
        <Text style={styles.editIcon}>✏️</Text>
      </TouchableOpacity>
    );
  },
);

NameSection.displayName = 'NameSection';
