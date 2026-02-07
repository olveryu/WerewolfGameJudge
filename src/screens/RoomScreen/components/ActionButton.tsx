/**
 * ActionButton.tsx - Action button with theme support
 *
 * ⚠️ IMPORTANT: This component NEVER uses RN `disabled` to block onPress.
 * Per copilot-instructions.md, components must always report intent.
 * Visual disabled state is preserved via styles only.
 *
 * Performance: Memoized, receives pre-created styles from parent.
 */
import React, { memo } from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { type ActionButtonStyles } from './styles';

export interface ActionButtonProps {
  /** Button label text */
  label: string;
  /** Callback when pressed - always called, even when visually disabled */
  onPress: (meta: { disabled: boolean }) => void;
  /** Whether the button appears disabled (greyed out) - does NOT block onPress */
  disabled?: boolean;
  /** Optional test ID */
  testID?: string;
  /** Pre-created styles from parent */
  styles: ActionButtonStyles;
}

function arePropsEqual(prev: ActionButtonProps, next: ActionButtonProps): boolean {
  return (
    prev.label === next.label &&
    prev.disabled === next.disabled &&
    prev.testID === next.testID &&
    prev.styles === next.styles
    // onPress excluded - stable via useCallback
  );
}

const ActionButtonComponent: React.FC<ActionButtonProps> = ({
  label,
  onPress,
  disabled = false,
  testID,
  styles,
}) => {
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

export const ActionButton = memo(ActionButtonComponent, arePropsEqual);

ActionButton.displayName = 'ActionButton';
