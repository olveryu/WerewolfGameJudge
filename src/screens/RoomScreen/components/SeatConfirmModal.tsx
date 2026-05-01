/**
 * SeatConfirmModal.tsx - Modal for confirming seat enter/leave actions
 *
 * Performance: Memoized with default shallow compare, receives pre-created styles from parent.
 * Only imports types, styles, and UI components. Does not import Service singletons or showAlert.
 */
import { formatSeat } from '@werewolf/game-engine/utils/formatSeat';
import type React from 'react';
import { memo } from 'react';
import { Modal, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { TESTIDS } from '@/testids';

import { type SeatConfirmModalStyles } from './styles';

type SeatModalType = 'enter' | 'leave';

interface SeatConfirmModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Type of action - entering or leaving seat */
  modalType: SeatModalType;
  /** The seat index (0-based, formatted internally for display) */
  seat: number;
  /** Whether a seat API call is in-flight */
  isSubmitting: boolean;
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
  seat,
  isSubmitting,
  onConfirm,
  onCancel,
  styles,
}) => {
  const title = modalType === 'enter' ? '入座' : '离座';
  const seatLabel = formatSeat(seat);
  const message =
    modalType === 'enter' ? `确定在${seatLabel}位入座？` : `确定从${seatLabel}位离座？`;
  const confirmText = isSubmitting
    ? modalType === 'enter'
      ? '入座中'
      : '离座中'
    : modalType === 'enter'
      ? '入座'
      : '离座';

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
            <Button
              variant="secondary"
              onPress={onCancel}
              disabled={isSubmitting}
              testID={TESTIDS.seatConfirmCancel}
              style={styles.modalButton}
            >
              取消
            </Button>
            <Button
              variant="primary"
              onPress={onConfirm}
              loading={isSubmitting}
              testID={TESTIDS.seatConfirmOk}
              style={styles.modalButton}
            >
              {confirmText}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export const SeatConfirmModal = memo(SeatConfirmModalComponent);

SeatConfirmModal.displayName = 'SeatConfirmModal';
