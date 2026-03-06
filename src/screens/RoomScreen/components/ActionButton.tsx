/**
 * ActionButton - 行动按钮（Memoized）
 *
 * 永不使用 RN `disabled` 阻断 onPress — 始终上报 intent。
 * 视觉禁用仅通过样式表达。渲染 UI 并通过回调上报 onPress（含 meta），
 * 不 import service，不包含业务逻辑判断，不使用 disabled={true}。
 */
import React, { memo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { spacing } from '@/theme';

import { type ActionButtonStyles } from './styles';

const localStyles = StyleSheet.create({
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.tight },
});

interface ActionButtonProps {
  /** Button label text */
  label: string;
  /** Optional icon rendered before label */
  icon?: ReactNode;
  /** Callback when pressed - always called, even when visually disabled */
  onPress: (meta: { disabled: boolean }) => void;
  /** Whether the button appears disabled (greyed out) - does NOT block onPress */
  disabled?: boolean;
  /** Optional style overrides (e.g. background color) */
  styleOverride?: ActionButtonStyles['actionButton'];
  /** Optional test ID */
  testID?: string;
  /** Pre-created styles from parent */
  styles: ActionButtonStyles;
}

const ActionButtonComponent: React.FC<ActionButtonProps> = ({
  label,
  icon,
  onPress,
  disabled = false,
  styleOverride,
  testID,
  styles,
}) => {
  return (
    <PressableScale
      style={[styles.actionButton, disabled && styles.disabledButton, styleOverride]}
      onPress={onPress}
      disabled={disabled}
      fireWhenDisabled
      activeScale={disabled ? 1 : 0.97}
      testID={testID}
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      {icon ? (
        <View style={localStyles.iconRow}>
          {icon}
          <Text style={styles.buttonText}>{label}</Text>
        </View>
      ) : (
        <Text style={styles.buttonText}>{label}</Text>
      )}
    </PressableScale>
  );
};

export const ActionButton = memo(ActionButtonComponent);

ActionButton.displayName = 'ActionButton';
