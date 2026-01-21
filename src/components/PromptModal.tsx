import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useColors, spacing, typography, borderRadius, type ThemeColors } from '../theme';

interface PromptModalProps {
  visible: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  secureTextEntry?: boolean;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}

export const PromptModal: React.FC<PromptModalProps> = ({
  visible,
  title,
  message,
  placeholder = '',
  secureTextEntry = false,
  onCancel,
  onConfirm,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [value, setValue] = useState('');

  // Reset value when modal opens
  useEffect(() => {
    if (visible) {
      setValue('');
    }
  }, [visible]);

  const handleConfirm = () => {
    onConfirm(value);
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.alertBox}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            secureTextEntry={secureTextEntry}
            autoFocus={true}
            onSubmitEditing={handleConfirm}
          />

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onCancel}>
              <Text style={[styles.buttonText, styles.cancelButtonText]}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={handleConfirm}>
              <Text style={styles.buttonText}>确认</Text>
            </TouchableOpacity>
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
      minWidth: 300,
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
      marginBottom: spacing.md,
    },
    input: {
      backgroundColor: colors.background,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
      fontSize: typography.base,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    button: {
      flex: 1,
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: colors.surfaceHover,
    },
    buttonText: {
      color: colors.textInverse,
      fontSize: typography.base,
      fontWeight: '600',
    },
    cancelButtonText: {
      color: colors.textSecondary,
    },
  });
}

export default PromptModal;
