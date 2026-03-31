/**
 * NameSection - 昵称显示/编辑组件（Memoized）
 *
 * 接收父组件 styles，通过回调上报编辑/保存/取消意图。
 * 渲染 UI 并上报用户 intent，不 import service，不包含业务逻辑判断。
 */
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components/Button';
import { FormTextField } from '@/components/FormTextField';
import { UI_ICONS } from '@/config/iconTokens';
import { ThemeColors, typography } from '@/theme';

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
    colors: _colors,
  }) => {
    if (isAnonymous) {
      return null;
    }

    if (isEditingName) {
      return (
        <View style={styles.editNameRow}>
          <FormTextField
            style={styles.nameInput}
            value={editName}
            onChangeText={onEditNameChange}
            placeholder="输入名字"
          />
          <Button variant="primary" size="sm" onPress={onSave}>
            保存
          </Button>
          <Button variant="ghost" size="sm" onPress={onCancel}>
            取消
          </Button>
        </View>
      );
    }

    return (
      <TouchableOpacity style={styles.nameRow} onPress={onStartEdit}>
        <Text style={styles.userName}>{displayName || '点击设置名字'}</Text>
        <Ionicons name={UI_ICONS.EDIT} size={typography.secondary} style={styles.editIcon} />
      </TouchableOpacity>
    );
  },
);

NameSection.displayName = 'NameSection';
