/**
 * RoomSeatConfirmModal — shared confirmation modal for room seat operations.
 */
import { formatSeat } from '@werewolf/game-engine/utils/formatSeat';
import type React from 'react';
import { memo } from 'react';
import { type StyleProp, Text, type TextStyle, View, type ViewStyle } from 'react-native';

import { Modal } from '@/components/AppModal';
import { Button } from '@/components/Button';
import { TESTIDS } from '@/testids';

export interface RoomSeatConfirmModalStyles {
  modalOverlay: StyleProp<ViewStyle>;
  modalContent: StyleProp<ViewStyle>;
  modalTitle: StyleProp<TextStyle>;
  modalMessage: StyleProp<TextStyle>;
  modalButtons: StyleProp<ViewStyle>;
  modalButton: StyleProp<ViewStyle>;
}

type RoomSeatConfirmKind = 'enter' | 'move' | 'leave' | 'kick';

interface RoomSeatConfirmModalProps {
  visible: boolean;
  kind: RoomSeatConfirmKind;
  seat: number;
  isSubmitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  styles: RoomSeatConfirmModalStyles;
}

const COPY: Record<RoomSeatConfirmKind, { title: string; confirm: string; danger?: boolean }> = {
  enter: { title: '入座', confirm: '入座' },
  move: { title: '换座', confirm: '换座' },
  leave: { title: '离座', confirm: '离座', danger: true },
  kick: { title: '移出座位', confirm: '移出', danger: true },
};

function messageFor(kind: RoomSeatConfirmKind, seat: number): string {
  const seatLabel = formatSeat(seat);
  if (kind === 'enter') return `确定在${seatLabel}位入座？`;
  if (kind === 'move') return `确定换到${seatLabel}位？`;
  if (kind === 'leave') return `确定从${seatLabel}位离座？`;
  return `确定将该玩家移出${seatLabel}位？`;
}

const RoomSeatConfirmModalComponent: React.FC<RoomSeatConfirmModalProps> = ({
  visible,
  kind,
  seat,
  isSubmitting,
  onConfirm,
  onCancel,
  styles,
}) => {
  const copy = COPY[kind];
  const confirmText = isSubmitting ? `${copy.confirm}中` : copy.confirm;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent} testID={TESTIDS.seatConfirmModal}>
          <Text style={styles.modalTitle} testID={TESTIDS.seatConfirmTitle}>
            {copy.title}
          </Text>
          <Text style={styles.modalMessage} testID={TESTIDS.seatConfirmMessage}>
            {messageFor(kind, seat)}
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
              variant={copy.danger ? 'danger' : 'primary'}
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

export const RoomSeatConfirmModal = memo(RoomSeatConfirmModalComponent);

RoomSeatConfirmModal.displayName = 'RoomSeatConfirmModal';
