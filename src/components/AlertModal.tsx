import React, { useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useColors, spacing, typography, borderRadius, type ThemeColors } from '../theme';

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
  const styles = useMemo(() => createStyles(colors), [colors]);

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
      <View style={styles.overlay} testID="alert-modal-overlay">
        <View style={styles.alertBox} testID="alert-modal">
          <Text style={styles.title} testID="alert-title">
            {title}
          </Text>
          {message ? (
            <Text style={styles.message} testID="alert-message">
              {message}
            </Text>
          ) : null}

          <View style={styles.buttonContainer}>
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={`alert-btn-${button.text}-${index}`}
                testID={`alert-button-${index}`}
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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    alertBox: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      minWidth: 280,
      maxWidth: Dimensions.get('window').width * 0.85,
    },
    title: {
      fontSize: typography.lg,
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    message: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    buttonContainer: {
      marginTop: spacing.sm,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      marginVertical: spacing.xs,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: colors.surfaceHover,
    },
    destructiveButton: {
      backgroundColor: colors.error,
    },
    buttonText: {
      fontSize: typography.base,
      color: colors.textInverse,
      fontWeight: '600',
    },
    cancelButtonText: {
      color: colors.textSecondary,
    },
    destructiveButtonText: {
      color: colors.textInverse,
    },
  });
}

export default AlertModal;
