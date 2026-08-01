/** Shared confirmation modal for taking or moving to a room seat. */

import type React from 'react';
import { memo } from 'react';
import { Text, View } from 'react-native';

import { Modal } from '@/components/AppModal';
import { Button } from '@/components/Button';
import type { RoomSeatConfirmationModel } from '@/features/room/model/RoomSeatConfirmation';
import { TESTIDS } from '@/testids';

import type { SeatConfirmModalStyles } from './styles';

interface RoomSeatConfirmModalProps {
  readonly model: RoomSeatConfirmationModel;
  readonly styles: SeatConfirmModalStyles;
}

function getCopy(model: RoomSeatConfirmationModel): {
  readonly title: string;
  readonly message: string;
  readonly confirmText: string;
  readonly submittingText: string;
} {
  switch (model.action.kind) {
    case 'take':
      return {
        title: '入座',
        message: `确定在${model.action.toSeat + 1}号位入座？`,
        confirmText: '入座',
        submittingText: '入座中',
      };
    case 'move':
      return {
        title: '换座',
        message: `确定从${model.action.fromSeat + 1}号位换到${model.action.toSeat + 1}号位？`,
        confirmText: '换座',
        submittingText: '换座中',
      };
  }
}

const RoomSeatConfirmModalComponent: React.FC<RoomSeatConfirmModalProps> = ({ model, styles }) => {
  const copy = getCopy(model);

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={model.isSubmitting ? undefined : model.onCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent} testID={TESTIDS.seatConfirmModal}>
          <Text style={styles.modalTitle} testID={TESTIDS.seatConfirmTitle}>
            {copy.title}
          </Text>
          <Text style={styles.modalMessage} testID={TESTIDS.seatConfirmMessage}>
            {copy.message}
          </Text>
          <View style={styles.modalButtons}>
            <Button
              variant="secondary"
              onPress={model.onCancel}
              disabled={model.isSubmitting}
              testID={TESTIDS.seatConfirmCancel}
              style={styles.modalButton}
            >
              取消
            </Button>
            <Button
              variant="primary"
              onPress={() => {
                void model.onConfirm();
              }}
              loading={model.isSubmitting}
              testID={TESTIDS.seatConfirmOk}
              style={styles.modalButton}
            >
              {model.isSubmitting ? copy.submittingText : copy.confirmText}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export const RoomSeatConfirmModal = memo(RoomSeatConfirmModalComponent);

RoomSeatConfirmModal.displayName = 'RoomSeatConfirmModal';
