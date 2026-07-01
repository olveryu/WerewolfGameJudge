/**
 * SeatConfirmModal.tsx - Modal for confirming seat enter/leave actions
 *
 * Performance: Memoized with default shallow compare, receives pre-created styles from parent.
 * Only imports types, styles, and UI components. Does not import Service singletons or showAlert.
 */
import type React from 'react';
import { memo } from 'react';

import { RoomSeatConfirmModal } from '@/components/room/RoomSeatConfirmModal';

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
  return (
    <RoomSeatConfirmModal
      visible={visible}
      kind={modalType}
      seat={seat}
      isSubmitting={isSubmitting}
      onConfirm={onConfirm}
      onCancel={onCancel}
      styles={styles}
    />
  );
};

export const SeatConfirmModal = memo(SeatConfirmModalComponent);

SeatConfirmModal.displayName = 'SeatConfirmModal';
