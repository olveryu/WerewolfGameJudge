/**
 * SeatConfirmModal.tsx - Modal for confirming seat enter/leave actions
 *
 * Performance: Memoized with arePropsEqual, receives pre-created styles from parent.
 *
 * ❌ Do NOT import: any Service singletons, showAlert
 * ✅ Allowed: types, styles, UI components
 */
import React, { memo } from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { type SeatConfirmModalStyles } from './styles';
import { TESTIDS } from '@/testids';

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
  /** Pre-created styles from parent */
  styles: SeatConfirmModalStyles;
}

const SeatConfirmModalComponent: React.FC<SeatConfirmModalProps> = ({
  visible,
  modalType,
  seatNumber,
  onConfirm,
  onCancel,
  styles,
}) => {
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

export const SeatConfirmModal = memo(SeatConfirmModalComponent);

SeatConfirmModal.displayName = 'SeatConfirmModal';
