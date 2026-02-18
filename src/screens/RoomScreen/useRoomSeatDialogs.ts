/**
 * useRoomSeatDialogs - Pure UI dialog layer for seat management
 *
 * Only responsible for seat enter/leave dialogs and leave room.
 * Does NOT contain action-related logic. Manages seat modal state and calls
 * showAlert. Does not import services or contain business rules.
 */

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import { useCallback, useRef } from 'react';

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
  handleConfirmSeat: () => void;
  handleCancelSeat: () => void;
  handleConfirmLeave: () => void;
  handleLeaveRoom: () => void;
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
  const submittingRef = useRef(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Enter seat dialog
  // ─────────────────────────────────────────────────────────────────────────

  const showEnterSeatDialog = useCallback(
    (seat: number) => {
      submittingRef.current = false; // 新对话框 → 解除旧异步锁
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
      submittingRef.current = false; // 新对话框 → 解除旧异步锁
      setPendingSeat(seat);
      setModalType('leave');
      setSeatModalVisible(true);
    },
    [setPendingSeat, setModalType, setSeatModalVisible],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Confirm seat (enter)
  // ─────────────────────────────────────────────────────────────────────────

  const handleConfirmSeat = useCallback(() => {
    if (pendingSeat === null || submittingRef.current) return;

    submittingRef.current = true;
    const seat = pendingSeat;
    roomScreenLog.debug('[SeatDialogs] Taking seat', { seat });

    // Close modal immediately — optimistic update already applied by takeSeat
    setSeatModalVisible(false);
    setPendingSeat(null);

    void takeSeat(seat)
      .then((success) => {
        if (!success) {
          roomScreenLog.warn('[SeatDialogs] takeSeat failed (occupied)', { seat });
          showAlert('入座失败', `${seat + 1}号座位已被占用，请选择其他位置。`);
        }
      })
      .finally(() => {
        submittingRef.current = false;
      });
  }, [pendingSeat, takeSeat, setSeatModalVisible, setPendingSeat]);

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

  const handleConfirmLeave = useCallback(() => {
    if (pendingSeat === null || submittingRef.current) return;

    submittingRef.current = true;
    roomScreenLog.debug('[SeatDialogs] Leaving seat', { seat: pendingSeat });

    // Close modal immediately — optimistic update already applied by leaveSeat
    setSeatModalVisible(false);
    setPendingSeat(null);

    void leaveSeat().finally(() => {
      submittingRef.current = false;
    });
  }, [pendingSeat, leaveSeat, setSeatModalVisible, setPendingSeat]);

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
  };
}
