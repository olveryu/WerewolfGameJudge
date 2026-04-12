/**
 * AlertModal - 跨平台自定义 Alert Modal
 *
 * Web 端替代 RN Alert.alert，提供统一的 Modal 弹窗样式。
 * 支持可选文本输入（prompt 模式）。
 * 渲染 Modal UI，通过 onPress 回调上报用户操作。不 import service，不含业务逻辑。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { TESTIDS } from '@/testids';
import {
  borderRadius,
  colors,
  fixed,
  shadows,
  spacing,
  textStyles,
  type ThemeColors,
  typography,
} from '@/theme';

export interface AlertButton {
  text: string;
  /** Called when pressed. For prompt mode, receives the current input value. */
  onPress?: (inputValue?: string) => void;
  style?: 'default' | 'cancel' | 'destructive';
  loading?: boolean;
  disabled?: boolean;
}

export interface AlertInputConfig {
  placeholder?: string;
  defaultValue?: string;
}

/**
 * Reorder buttons to match iOS Alert convention:
 * - 2 buttons (row): cancel on the left (index 0), action on the right
 * - 3+ buttons (column): actions first, cancel at the bottom
 */
function sortButtons(buttons: AlertButton[]): AlertButton[] {
  const cancel = buttons.filter((b) => b.style === 'cancel');
  const rest = buttons.filter((b) => b.style !== 'cancel');
  if (cancel.length === 0) return buttons;
  if (buttons.length === 2) {
    // Row layout: cancel left, action right
    return [...cancel, ...rest];
  }
  // Column layout: actions top, cancel bottom
  return [...rest, ...cancel];
}

interface AlertModalProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AlertButton[];
  input?: AlertInputConfig;
  onClose: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  visible,
  title,
  message,
  buttons,
  input,
  onClose,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const orderedButtons = useMemo(() => sortButtons(buttons), [buttons]);
  const styles = useMemo(
    () => createStyles(colors, orderedButtons.length, screenWidth),
    [orderedButtons.length, screenWidth],
  );

  const [inputValue, setInputValue] = useState(input?.defaultValue ?? '');

  // Reset input value when modal opens with new config
  useEffect(() => {
    if (visible) {
      setInputValue(input?.defaultValue ?? '');
    }
  }, [visible, input?.defaultValue]);

  const handleButtonPress = useCallback(
    (button: AlertButton) => {
      onClose();
      button.onPress?.(input ? inputValue : undefined);
    },
    [onClose, input, inputValue],
  );

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay} testID={TESTIDS.alertModalOverlay}>
        <View style={styles.alertBox} testID={TESTIDS.alertModal}>
          <Text style={styles.title} testID={TESTIDS.alertTitle}>
            {title}
          </Text>
          {message ? (
            <Text style={styles.message} testID={TESTIDS.alertMessage}>
              {message}
            </Text>
          ) : null}

          {input ? (
            <TextInput
              style={styles.input}
              value={inputValue}
              onChangeText={setInputValue}
              placeholder={input.placeholder}
              placeholderTextColor={colors.textMuted}
              autoFocus
              testID={TESTIDS.alertInput}
            />
          ) : null}

          <View style={styles.buttonContainer}>
            {orderedButtons.map((button, index) => (
              <TouchableOpacity
                key={`alert-btn-${button.text}-${index}`}
                testID={TESTIDS.alertButton(index)}
                style={[
                  styles.button,
                  button.style === 'cancel' && styles.cancelButton,
                  button.style === 'destructive' && styles.destructiveButton,
                  (button.loading || button.disabled) && styles.disabledButton,
                ]}
                onPress={() => handleButtonPress(button)}
                disabled={button.loading || button.disabled}
              >
                {button.loading ? (
                  <ActivityIndicator
                    size="small"
                    color={button.style === 'cancel' ? colors.textSecondary : colors.textInverse}
                  />
                ) : (
                  <Text
                    style={[
                      styles.buttonText,
                      button.style === 'cancel' && styles.cancelButtonText,
                      button.style === 'destructive' && styles.destructiveButtonText,
                    ]}
                  >
                    {button.text}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

function createStyles(colors: ThemeColors, buttonCount: number, screenWidth: number) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    alertBox: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      padding: spacing.large,
      width: screenWidth * 0.85,
      ...shadows.lg,
    },
    title: {
      ...textStyles.subtitleSemibold,
      color: colors.text,
      textAlign: 'center',
      marginBottom: spacing.small,
    },
    message: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.large,
    },
    input: {
      backgroundColor: colors.background,
      borderRadius: borderRadius.medium,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.small,
      fontSize: typography.body,
      lineHeight: typography.lineHeights.body,
      color: colors.text,
      marginBottom: spacing.medium,
    },
    buttonContainer: {
      marginTop: spacing.small,
      flexDirection: buttonCount === 2 ? 'row' : 'column',
      gap: spacing.small,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.full,
      paddingVertical: spacing.small,
      paddingHorizontal: spacing.medium,
      alignItems: 'center',
      ...(buttonCount === 2 ? { flex: 1 } : {}),
    },
    cancelButton: {
      backgroundColor: colors.surfaceHover,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
    },
    destructiveButton: {
      backgroundColor: colors.error,
    },
    disabledButton: {
      opacity: 0.5,
    },
    buttonText: {
      ...textStyles.bodySemibold,
      color: colors.textInverse,
    },
    cancelButtonText: {
      color: colors.textSecondary,
    },
    destructiveButtonText: {
      color: colors.textInverse,
    },
  });
}
