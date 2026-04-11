/**
 * NameSection - 昵称显示组件（Memoized）
 *
 * 点击触发 onStartEdit 回调，由父组件弹出 prompt modal 编辑昵称。
 * 渲染 UI 并上报用户 intent，不 import service，不包含业务逻辑判断。
 */
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Text, TouchableOpacity } from 'react-native';

import { UI_ICONS } from '@/config/iconTokens';
import { typography } from '@/theme';

import { SettingsScreenStyles } from './styles';

interface NameSectionProps {
  isAnonymous: boolean;
  displayName: string | null;
  onStartEdit: () => void;
  styles: SettingsScreenStyles;
}

export const NameSection = memo<NameSectionProps>(
  ({ isAnonymous, displayName, onStartEdit, styles }) => {
    if (isAnonymous) {
      return null;
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
