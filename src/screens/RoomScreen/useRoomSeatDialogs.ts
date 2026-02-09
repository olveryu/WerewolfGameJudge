/**
 * useRoomSeatDialogs - Pure UI dialog layer for seat management
 *
 * Only responsible for seat enter/leave dialogs and leave room.
 * Does NOT contain action-related logic.
 *
 * ❌ Do NOT: import services, contain business rules
 * ✅ Allowed: manage seat modal state, call showAlert
 */

import { useCallback } from 'react';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { showAlert } from '@/utils/alert';
import { GameStatus } from '@/models/GameStatus';

interface UseRoomSeatDialogsParams {
  // Seat modal state
  pendingSeatIndex: number | null;
  setPendingSeatIndex: React.Dispatch<React.SetStateAction<number | null>>;
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
  showEnterSeatDialog: (index: number) => void;
  showLeaveSeatDialog: (index: number) => void;
  handleConfirmSeat: () => Promise<void>;
  handleCancelSeat: () => void;
  handleConfirmLeave: () => Promise<void>;
  handleLeaveRoom: () => void;
}

export function useRoomSeatDialogs({
  pendingSeatIndex,
  setPendingSeatIndex,
  setSeatModalVisible,
  setModalType,
  takeSeat,
  leaveSeat,
  roomStatus: _roomStatus,
  navigation,
  onLeaveRoom,
}: UseRoomSeatDialogsParams): UseRoomSeatDialogsResult {
  // ─────────────────────────────────────────────────────────────────────────
  // Enter seat dialog
  // ─────────────────────────────────────────────────────────────────────────

  const showEnterSeatDialog = useCallback(
    (index: number) => {
      setPendingSeatIndex(index);
      setModalType('enter');
      setSeatModalVisible(true);
    },
    [setPendingSeatIndex, setModalType, setSeatModalVisible],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Leave seat dialog
  // ─────────────────────────────────────────────────────────────────────────

  const showLeaveSeatDialog = useCallback(
    (index: number) => {
      setPendingSeatIndex(index);
      setModalType('leave');
      setSeatModalVisible(true);
    },
    [setPendingSeatIndex, setModalType, setSeatModalVisible],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Confirm seat (enter)
  // ─────────────────────────────────────────────────────────────────────────

  const handleConfirmSeat = useCallback(async () => {
    if (pendingSeatIndex === null) return;

    const success = await takeSeat(pendingSeatIndex);
    setSeatModalVisible(false);

    if (!success) {
      showAlert('入座失败', `${pendingSeatIndex + 1}号座位已被占用，请选择其他位置。`);
    }
    setPendingSeatIndex(null);
  }, [pendingSeatIndex, takeSeat, setSeatModalVisible, setPendingSeatIndex]);

  // ─────────────────────────────────────────────────────────────────────────
  // Cancel seat
  // ─────────────────────────────────────────────────────────────────────────

  const handleCancelSeat = useCallback(() => {
    setSeatModalVisible(false);
    setPendingSeatIndex(null);
  }, [setSeatModalVisible, setPendingSeatIndex]);

  // ─────────────────────────────────────────────────────────────────────────
  // Confirm leave (seat)
  // ─────────────────────────────────────────────────────────────────────────

  const handleConfirmLeave = useCallback(async () => {
    if (pendingSeatIndex === null) return;

    await leaveSeat();
    setSeatModalVisible(false);
    setPendingSeatIndex(null);
  }, [pendingSeatIndex, leaveSeat, setSeatModalVisible, setPendingSeatIndex]);

  // ─────────────────────────────────────────────────────────────────────────
  // Leave room
  // ─────────────────────────────────────────────────────────────────────────

  const doLeaveRoom = useCallback(() => {
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
