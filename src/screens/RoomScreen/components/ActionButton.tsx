/**
 * ActionButton.tsx - Action button with theme support
 *
 * ⚠️ IMPORTANT: This component NEVER uses RN `disabled` to block onPress.
 * Per copilot-instructions.md, components must always report intent.
 * Visual disabled state is preserved via styles only.
 */
import React, { useMemo } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useColors, spacing, typography, borderRadius, type ThemeColors } from '../../../theme';

export interface ActionButtonProps {
  /** Button label text */
  label: string;
  /** Callback when pressed - always called, even when visually disabled */
  onPress: (meta: { disabled: boolean }) => void;
  /** Whether the button appears disabled (greyed out) - does NOT block onPress */
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
      onPress={() => onPress({ disabled })}
      testID={testID}
      activeOpacity={disabled ? 1 : 0.7}
      accessibilityState={{ disabled }}
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
      fontWeight: typography.weights.semibold,
    },
  });
}

export default ActionButton;
