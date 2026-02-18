/**
 * ActionButton - 行动按钮（Memoized）
 *
 * 永不使用 RN `disabled` 阻断 onPress — 始终上报 intent。
 * 视觉禁用仅通过样式表达。渲染 UI 并通过回调上报 onPress（含 meta），
 * 不 import service，不包含业务逻辑判断，不使用 disabled={true}。
 */
import React, { memo } from 'react';
import { Text, TouchableOpacity } from 'react-native';

import { type ActionButtonStyles } from './styles';

interface ActionButtonProps {
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

export const ActionButton = memo(ActionButtonComponent);

ActionButton.displayName = 'ActionButton';
