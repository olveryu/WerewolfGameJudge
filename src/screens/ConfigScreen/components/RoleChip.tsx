/**
 * RoleChip - Memoized role selection chip
 *
 * Performance: Receives pre-created styles from parent.
 */
import React, { memo } from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { ConfigScreenStyles } from './styles';

export interface RoleChipProps {
  id: string;
  label: string;
  selected: boolean;
  onToggle: (id: string) => void;
  styles: ConfigScreenStyles;
}

const arePropsEqual = (prev: RoleChipProps, next: RoleChipProps): boolean => {
  return (
    prev.id === next.id &&
    prev.label === next.label &&
    prev.selected === next.selected &&
    prev.styles === next.styles
    // onToggle excluded - stable via useCallback
  );
};

export const RoleChip = memo<RoleChipProps>(({ id, label, selected, onToggle, styles }) => {
  return (
    <TouchableOpacity
      testID={`config-role-chip-${id}`}
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={() => onToggle(id)}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}, arePropsEqual);

RoleChip.displayName = 'RoleChip';
