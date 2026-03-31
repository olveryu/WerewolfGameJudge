/**
 * useRoomSeatDialogs - Pure UI dialog layer for seat management
 *
 * Only responsible for seat enter/leave dialogs and leave room.
 * Does NOT contain action-related logic. Manages seat modal state and calls
 * showAlert. Does not import services or contain business rules.
 */

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import { useCallback, useRef, useState } from 'react';

import type { RootStackParamList } from '@/navigation/types';
import { showConfirmAlert, showErrorAlert } from '@/utils/alertPresets';
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
  /** True while a seat enter/leave API call is in-flight (drives modal spinner) */
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
  const submittingRef = useRef(false);
  const [isSeatSubmitting, setIsSeatSubmitting] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Enter seat dialog
  // ─────────────────────────────────────────────────────────────────────────

  const showEnterSeatDialog = useCallback(
    (seat: number) => {
      submittingRef.current = false; // 新对话框 → 解除旧异步锁
      setIsSeatSubmitting(false);
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
      setIsSeatSubmitting(false);
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
    setIsSeatSubmitting(true);
    const seat = pendingSeat;
    roomScreenLog.debug('[SeatDialogs] Taking seat', { seat });

    void takeSeat(seat)
      .then((success) => {
        if (success) {
          // 成功 → 关弹窗
          setSeatModalVisible(false);
          setPendingSeat(null);
        } else {
          roomScreenLog.warn('[SeatDialogs] takeSeat failed (occupied)', { seat });
          setSeatModalVisible(false);
          setPendingSeat(null);
          showErrorAlert('入座失败', `${seat + 1}号座位已被占用，请选择其他位置。`);
        }
      })
      .finally(() => {
        submittingRef.current = false;
        setIsSeatSubmitting(false);
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
    setIsSeatSubmitting(true);
    roomScreenLog.debug('[SeatDialogs] Leaving seat', { seat: pendingSeat });

    void leaveSeat()
      .then(() => {
        // 成功 → 关弹窗
        setSeatModalVisible(false);
        setPendingSeat(null);
      })
      .finally(() => {
        submittingRef.current = false;
        setIsSeatSubmitting(false);
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
    showConfirmAlert('离开房间？', '', doLeaveRoom);
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
