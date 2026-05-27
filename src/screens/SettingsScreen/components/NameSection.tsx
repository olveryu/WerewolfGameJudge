/**
 * NameSection - Display name component (Memoized)
 *
 * Tap triggers the onStartEdit callback; the parent opens a prompt modal to edit the display name.
 * Renders UI and reports user intent; no service imports, no business logic.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { memo } from 'react';
import { Text, TouchableOpacity } from 'react-native';

import { NameStyleText } from '@/components/nameStyles';
import { UI_ICONS } from '@/config/iconTokens';
import { typography } from '@/theme';

import { type SettingsScreenStyles } from './styles';

interface NameSectionProps {
  isAnonymous: boolean;
  displayName: string | null;
  nameStyle?: string | null;
  onStartEdit: () => void;
  styles: SettingsScreenStyles;
}

/** Display name section. */
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
