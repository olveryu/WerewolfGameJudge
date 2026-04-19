/**
 * NameSection - 昵称显示组件（Memoized）
 *
 * 点击触发 onStartEdit 回调，由父组件弹出 prompt modal 编辑昵称。
 * 渲染 UI 并上报用户 intent，不 import service，不包含业务逻辑判断。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { memo } from 'react';
import { Text, TouchableOpacity } from 'react-native';

import { NameStyleText } from '@/components/nameStyles';
import { UI_ICONS } from '@/config/iconTokens';
import { typography } from '@/theme';

import { SettingsScreenStyles } from './styles';

interface NameSectionProps {
  isAnonymous: boolean;
  displayName: string | null;
  nameStyle?: string | null;
  onStartEdit: () => void;
  styles: SettingsScreenStyles;
}

export const NameSection = memo<NameSectionProps>(
  ({ isAnonymous, displayName, nameStyle, onStartEdit, styles }) => {
    if (isAnonymous) {
      return null;
    }

    const nameText = displayName ? (
      <NameStyleText styleId={nameStyle} style={styles.userName}>
        {displayName}
      </NameStyleText>
    ) : (
      <Text style={styles.userName}>点击设置名字</Text>
    );

    return (
      <TouchableOpacity style={styles.nameRow} onPress={onStartEdit}>
        {nameText}
        <Ionicons name={UI_ICONS.EDIT} size={typography.secondary} style={styles.editIcon} />
      </TouchableOpacity>
    );
  },
);

NameSection.displayName = 'NameSection';
