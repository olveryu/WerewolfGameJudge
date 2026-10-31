/**
 * AlertModal - cross-platform custom Alert Modal
 *
 * Replaces RN Alert.alert on web, providing unified Modal popup styles.
 * Supports optional text input (prompt mode).
 * Renders Modal UI and reports user actions via onPress callbacks. Imports no service, contains no business logic.
 *
 * Per-open state (typed input, pending button) lives in `AlertModalBody`, which
 * `Modal` mounts only while visible, so every opening starts clean and parent
 * re-renders with fresh `buttons` references never reset it. A host that swaps
 * one alert for another while open must change `key` (see App.tsx).
 */
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { Modal } from '@/components/AppModal';
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
import { getAlertGeneration } from '@/utils/alert';

export interface AlertButton {
  text: string;
  /** Called when pressed. For prompt mode, receives the current input value.
   *  If the callback returns a Promise, the button enters loading state and
   *  the modal stays open until the Promise resolves. On rejection the button
   *  recovers so the user can retry.
   */
  onPress?: (inputValue?: string) => void | Promise<void>;
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

export const AlertModal: React.FC<AlertModalProps> = ({ visible, onClose, ...body }) => (
  <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
    <AlertModalBody {...body} onClose={onClose} />
  </Modal>
);

const AlertModalBody: React.FC<Omit<AlertModalProps, 'visible'>> = ({
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
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);

  const handleButtonPress = useCallback(
    (button: AlertButton, index: number) => {
      // Capture generation BEFORE calling onPress — if onPress synchronously
      // calls showAlert() (e.g. "本局复盘" -> "自己查看" -> showConfirmAlert),
      // generation will have incremented and we must NOT close the new alert.
      const gen = getAlertGeneration();
      const result = button.onPress?.(input ? inputValue : undefined);

      // Sync callback (or no callback): close only if no new alert was shown
      if (!result || typeof result.then !== 'function') {
        if (getAlertGeneration() === gen) {
          onClose();
        }
        return;
      }

      // Async callback: keep modal open, show loading on pressed button.
      setLoadingIndex(index);
      result.then(
        () => {
          if (getAlertGeneration() !== gen) return;
          setLoadingIndex(null);
          onClose();
        },
        () => {
          // On rejection: reset button so user can retry
          if (getAlertGeneration() !== gen) return;
          setLoadingIndex(null);
        },
      );
    },
    [onClose, input, inputValue],
  );

  return (
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
          {orderedButtons.map((button, index) => {
            const isLoading = button.loading || loadingIndex === index;
            const isDisabled = isLoading || button.disabled || loadingIndex !== null;
            return (
              <TouchableOpacity
                key={`alert-btn-${button.text}-${index}`}
                testID={TESTIDS.alertButton(index)}
                style={[
                  styles.button,
                  button.style === 'cancel' && styles.cancelButton,
                  button.style === 'destructive' && styles.destructiveButton,
                  isDisabled && styles.disabledButton,
                ]}
                onPress={() => handleButtonPress(button, index)}
                disabled={isDisabled}
              >
                <View style={styles.buttonContent}>
                  {isLoading ? (
                    <ActivityIndicator
                      size="small"
                      color={button.style === 'cancel' ? colors.textSecondary : colors.textInverse}
                    />
                  ) : null}
                  <Text
                    style={[
                      styles.buttonText,
                      button.style === 'cancel' && styles.cancelButtonText,
                      button.style === 'destructive' && styles.destructiveButtonText,
                    ]}
                  >
                    {button.text}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
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
    buttonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.small,
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
