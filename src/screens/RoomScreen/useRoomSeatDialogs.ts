/**
 * useRoomSeatDialogs - Pure UI dialog layer for seat management
 *
 * Only responsible for seat enter/leave dialogs and leave room.
 * Does NOT contain action-related logic.
 *
 * ❌ Do NOT: import services, contain business rules
 * ✅ Allowed: manage seat modal state, call showAlert
 */

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';

import { GameStatus } from '@/models/GameStatus';
import type { RootStackParamList } from '@/navigation/types';
import { showAlert } from '@/utils/alert';
import { roomScreenLog } from '@/utils/logger';

interface UseRoomSeatDialogsParams {
  // Seat modal state
  pendingSeat: number | null;
  setPendingSeat: React.Dispatch<React.SetStateAction<number | null>>;
  setSeatModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setModalType: React.Dispatch<React.SetStateAction<'enter' | 'leave'>>;

  // Seat operations (execution layer)
  takeSeat: (seatNumber: number) => Promise<boolean>;
  leaveSeat: () => Promise<void>;

  // Leave room
  roomStatus: GameStatus;
  navigation: NativeStackNavigationProp<RootStackParamList, 'Room'>;

  // Cleanup callback (e.g., stop audio)
  onLeaveRoom?: () => void;
}

interface UseRoomSeatDialogsResult {
  showEnterSeatDialog: (seat: number) => void;
  showLeaveSeatDialog: (seat: number) => void;
  handleConfirmSeat: () => Promise<void>;
  handleCancelSeat: () => void;
  handleConfirmLeave: () => Promise<void>;
  handleLeaveRoom: () => void;
  /** True while takeSeat or leaveSeat is in-flight. */
  isSeatSubmitting: boolean;
}

export function useRoomSeatDialogs({
  pendingSeat,
  setPendingSeat,
  setSeatModalVisible,
  setModalType,
  takeSeat,
  leaveSeat,
  roomStatus: _roomStatus,
  navigation,
  onLeaveRoom,
}: UseRoomSeatDialogsParams): UseRoomSeatDialogsResult {
  const [isSeatSubmitting, setIsSeatSubmitting] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Enter seat dialog
  // ─────────────────────────────────────────────────────────────────────────

  const showEnterSeatDialog = useCallback(
    (seat: number) => {
      setPendingSeat(seat);
      setModalType('enter');
      setSeatModalVisible(true);
    },
    [setPendingSeat, setModalType, setSeatModalVisible],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Leave seat dialog
  // ─────────────────────────────────────────────────────────────────────────

  const showLeaveSeatDialog = useCallback(
    (seat: number) => {
      setPendingSeat(seat);
      setModalType('leave');
      setSeatModalVisible(true);
    },
    [setPendingSeat, setModalType, setSeatModalVisible],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Confirm seat (enter)
  // ─────────────────────────────────────────────────────────────────────────

  const handleConfirmSeat = useCallback(async () => {
    if (pendingSeat === null || isSeatSubmitting) return;

    setIsSeatSubmitting(true);
    roomScreenLog.debug('[SeatDialogs] Taking seat', { seat: pendingSeat });
    try {
      const success = await takeSeat(pendingSeat);
      setSeatModalVisible(false);

      if (!success) {
        roomScreenLog.warn('[SeatDialogs] takeSeat failed (occupied)', {
          seat: pendingSeat,
        });
        showAlert('入座失败', `${pendingSeat + 1}号座位已被占用，请选择其他位置。`);
      }
      setPendingSeat(null);
    } finally {
      setIsSeatSubmitting(false);
    }
  }, [pendingSeat, isSeatSubmitting, takeSeat, setSeatModalVisible, setPendingSeat]);

  // ─────────────────────────────────────────────────────────────────────────
  // Cancel seat
  // ─────────────────────────────────────────────────────────────────────────

  const handleCancelSeat = useCallback(() => {
    setSeatModalVisible(false);
    setPendingSeat(null);
  }, [setSeatModalVisible, setPendingSeat]);

  // ─────────────────────────────────────────────────────────────────────────
  // Confirm leave (seat)
  // ─────────────────────────────────────────────────────────────────────────

  const handleConfirmLeave = useCallback(async () => {
    if (pendingSeat === null || isSeatSubmitting) return;

    setIsSeatSubmitting(true);
    roomScreenLog.debug('[SeatDialogs] Leaving seat', { seat: pendingSeat });
    try {
      await leaveSeat();
      setSeatModalVisible(false);
      setPendingSeat(null);
    } finally {
      setIsSeatSubmitting(false);
    }
  }, [pendingSeat, isSeatSubmitting, leaveSeat, setSeatModalVisible, setPendingSeat]);

  // ─────────────────────────────────────────────────────────────────────────
  // Leave room
  // ─────────────────────────────────────────────────────────────────────────

  const doLeaveRoom = useCallback(() => {
    roomScreenLog.debug('[SeatDialogs] Leaving room');
    onLeaveRoom?.(); // Stop audio, cleanup
    navigation.navigate('Home');
  }, [navigation, onLeaveRoom]);

  const handleLeaveRoom = useCallback(() => {
    // Always show confirmation dialog regardless of room status
    showAlert('离开房间？', '', [
      { text: '取消', style: 'cancel' },
      { text: '确定', onPress: doLeaveRoom },
    ]);
  }, [doLeaveRoom]);

  return {
    showEnterSeatDialog,
    showLeaveSeatDialog,
    handleConfirmSeat,
    handleCancelSeat,
    handleConfirmLeave,
    handleLeaveRoom,
    isSeatSubmitting,
  };
}
