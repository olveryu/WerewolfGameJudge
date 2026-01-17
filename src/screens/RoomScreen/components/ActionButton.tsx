/**
 * ActionButton.tsx - Action button using RoomScreen styles
 *
 * Uses the real styles from RoomScreen.styles.ts
 */

import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { styles } from '../RoomScreen.styles';

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
  return (
    <TouchableOpacity
      style={[
        styles.actionButton,
        disabled && styles.disabledButton,
      ]}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      activeOpacity={0.7}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
};

export default ActionButton;
