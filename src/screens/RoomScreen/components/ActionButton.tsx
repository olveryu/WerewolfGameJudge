/**
 * ActionButton.tsx - Action button with theme support
 */
import React, { useMemo } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useColors, spacing, typography, borderRadius, type ThemeColors } from '../../../theme';

export interface ActionButtonProps {
  /** Button label text */
  label: string;
  /** Callback when pressed */
  onPress: () => void;
  /** Whether the button is disabled (greyed out) */
  disabled?: boolean;
  /** Optional test ID */
  testID?: string;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  onPress,
  disabled = false,
  testID,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={[styles.actionButton, disabled && styles.disabledButton]}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      activeOpacity={0.7}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    actionButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.large,
      paddingVertical: spacing.medium,
      borderRadius: borderRadius.full,
      marginBottom: spacing.small,
    },
    disabledButton: {
      backgroundColor: colors.textMuted,
    },
    buttonText: {
      color: colors.textInverse,
      fontSize: typography.secondary,
      fontWeight: '600',
    },
  });
}

export default ActionButton;
