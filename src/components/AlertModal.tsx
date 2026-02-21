/**
 * AlertModal - 跨平台自定义 Alert Modal
 *
 * Web 端替代 RN Alert.alert，提供统一的 Modal 弹窗样式。
 * 渲染 Modal UI，通过 onPress 回调上报用户操作。不 import service，不含业务逻辑。
 */
import React, { useMemo } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

import { TESTIDS } from '@/testids';
import { borderRadius, spacing, type ThemeColors, typography, useColors } from '@/theme';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertModalProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AlertButton[];
  onClose: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  visible,
  title,
  message,
  buttons,
  onClose,
}) => {
  const colors = useColors();
  const { width: screenWidth } = useWindowDimensions();
  const styles = useMemo(
    () => createStyles(colors, buttons.length, screenWidth),
    [colors, buttons.length, screenWidth],
  );

  const handleButtonPress = (button: AlertButton) => {
    // First close the modal, then execute the callback
    // Use setTimeout to ensure modal is fully closed before callback
    onClose();
    if (button.onPress) {
      setTimeout(() => {
        button.onPress?.();
      }, 0);
    }
  };

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

          <View style={styles.buttonContainer}>
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={`alert-btn-${button.text}-${index}`}
                testID={TESTIDS.alertButton(index)}
                style={[
                  styles.button,
                  button.style === 'cancel' && styles.cancelButton,
                  button.style === 'destructive' && styles.destructiveButton,
                ]}
                onPress={() => handleButtonPress(button)}
              >
                <Text
                  style={[
                    styles.buttonText,
                    button.style === 'cancel' && styles.cancelButtonText,
                    button.style === 'destructive' && styles.destructiveButtonText,
                  ]}
                >
                  {button.text}
                </Text>
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
      minWidth: spacing.xxlarge * 6, // ~280
      maxWidth: screenWidth * 0.85,
    },
    title: {
      fontSize: typography.subtitle,
      fontWeight: typography.weights.bold,
      color: colors.text,
      textAlign: 'center',
      marginBottom: spacing.small,
    },
    message: {
      fontSize: typography.secondary,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.large,
    },
    buttonContainer: {
      marginTop: spacing.small,
      flexDirection: buttonCount === 2 ? 'row' : 'column',
      gap: spacing.small,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.medium,
      paddingVertical: spacing.medium,
      paddingHorizontal: spacing.large,
      alignItems: 'center',
      ...(buttonCount === 2 ? { flex: 1 } : {}),
    },
    cancelButton: {
      backgroundColor: colors.surfaceHover,
    },
    destructiveButton: {
      backgroundColor: colors.error,
    },
    buttonText: {
      fontSize: typography.body,
      color: colors.textInverse,
      fontWeight: typography.weights.semibold,
    },
    cancelButtonText: {
      color: colors.textSecondary,
    },
    destructiveButtonText: {
      color: colors.textInverse,
    },
  });
}
