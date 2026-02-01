/**
 * SeatConfirmModal.tsx - Modal for confirming seat enter/leave actions
 */
import React, { useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useColors, spacing, typography, borderRadius, type ThemeColors } from '../../../theme';
import { TESTIDS } from '../../../testids';

export type SeatModalType = 'enter' | 'leave';

export interface SeatConfirmModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Type of action - entering or leaving seat */
  modalType: SeatModalType;
  /** The seat number (1-indexed for display) */
  seatNumber: number;
  /** Called when user confirms the action */
  onConfirm: () => void;
  /** Called when user cancels or dismisses the modal */
  onCancel: () => void;
}

export const SeatConfirmModal: React.FC<SeatConfirmModalProps> = ({
  visible,
  modalType,
  seatNumber,
  onConfirm,
  onCancel,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const title = modalType === 'enter' ? '入座' : '站起';
  const message =
    modalType === 'enter' ? `确定在${seatNumber}号位入座?` : `确定从${seatNumber}号位站起?`;

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent} testID={TESTIDS.seatConfirmModal}>
          <Text style={styles.modalTitle} testID={TESTIDS.seatConfirmTitle}>
            {title}
          </Text>
          <Text style={styles.modalMessage} testID={TESTIDS.seatConfirmMessage}>
            {message}
          </Text>
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalCancelButton]}
              onPress={onCancel}
              testID={TESTIDS.seatConfirmCancel}
            >
              <Text style={styles.modalCancelText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalConfirmButton]}
              onPress={onConfirm}
              testID={TESTIDS.seatConfirmOk}
            >
              <Text style={styles.modalConfirmText}>确定</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xlarge,
      padding: spacing.xlarge,
      minWidth: spacing.xxlarge * 6 + spacing.large, // ~280
      alignItems: 'center',
    },
    modalTitle: {
      fontSize: typography.title,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.small,
    },
    modalMessage: {
      fontSize: typography.body,
      color: colors.textSecondary,
      marginBottom: spacing.large,
      textAlign: 'center',
    },
    modalButtons: {
      flexDirection: 'row',
      gap: spacing.medium,
    },
    modalButton: {
      paddingHorizontal: spacing.large,
      paddingVertical: spacing.medium,
      borderRadius: borderRadius.medium,
      minWidth: spacing.xxlarge * 2 + spacing.medium, // ~100
      alignItems: 'center',
    },
    modalCancelButton: {
      backgroundColor: colors.surfaceHover,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalConfirmButton: {
      backgroundColor: colors.primary,
    },
    modalCancelText: {
      color: colors.textSecondary,
      fontSize: typography.body,
      fontWeight: '600',
    },
    modalConfirmText: {
      color: colors.textInverse,
      fontSize: typography.body,
      fontWeight: '600',
    },
  });
}

export default SeatConfirmModal;
