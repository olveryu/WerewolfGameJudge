/**
 * useRoomSeatDialogs - Pure UI dialog layer for seat management
 *
 * Only responsible for seat enter/leave dialogs and leave room.
 * Does NOT contain action-related logic. Manages seat modal state and calls
 * showAlert. Does not import services or contain business rules.
 */

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { type GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { ActionResult } from '@werewolf/game-engine/protocol/ActionResult';
import { formatSeat } from '@werewolf/game-engine/utils/formatSeat';
import { useCallback, useRef, useState } from 'react';

import type { RootStackParamList } from '@/navigation/types';
import { showConfirmAlert, showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { getUserFacingMessage } from '@/utils/errorUtils';
import { roomScreenLog } from '@/utils/logger';

interface UseRoomSeatDialogsParams {
  // Seat modal state
  pendingSeat: number | null;
  setPendingSeat: React.Dispatch<React.SetStateAction<number | null>>;
  setSeatModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setModalType: React.Dispatch<React.SetStateAction<'enter' | 'leave'>>;

  // Seat operations (execution layer)
  takeSeat: (seat: number) => Promise<ActionResult>;
  leaveSeat: () => Promise<ActionResult>;

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
      submittingRef.current = false; // New dialog -> release old async lock
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
      submittingRef.current = false; // New dialog -> release old async lock
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
    roomScreenLog.debug('Taking seat', { seat });

    void (async () => {
      try {
        const result = await takeSeat(seat);
        setSeatModalVisible(false);
        setPendingSeat(null);

        if (!result.success) {
          roomScreenLog.warn('takeSeat rejected', { seat, reason: result.reason });
          const message =
            result.reason === 'seat_taken'
              ? `${formatSeat(seat)}座位已被占用，请选择其他位置。`
              : getUserFacingMessage(result);
          showErrorAlert('入座失败', message);
        }
      } catch (error) {
        setSeatModalVisible(false);
        setPendingSeat(null);
        handleError(error, {
          label: '入座',
          logger: roomScreenLog,
          alertMessage: '房间响应异常，请重新进入房间后重试。',
        });
      } finally {
        submittingRef.current = false;
        setIsSeatSubmitting(false);
      }
    })();
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
    roomScreenLog.debug('Leaving seat', { seat: pendingSeat });

    void (async () => {
      try {
        const result = await leaveSeat();
        setSeatModalVisible(false);
        setPendingSeat(null);

        if (!result.success) {
          roomScreenLog.warn('leaveSeat rejected', { reason: result.reason });
          showErrorAlert('离座失败', getUserFacingMessage(result));
        }
      } catch (error) {
        setSeatModalVisible(false);
        setPendingSeat(null);
        handleError(error, {
          label: '离座',
          logger: roomScreenLog,
          alertMessage: '房间响应异常，请重新进入房间后重试。',
        });
      } finally {
        submittingRef.current = false;
        setIsSeatSubmitting(false);
      }
    })();
  }, [pendingSeat, leaveSeat, setSeatModalVisible, setPendingSeat]);

  // ─────────────────────────────────────────────────────────────────────────
  // Leave room
  // ─────────────────────────────────────────────────────────────────────────

  const doLeaveRoom = useCallback(() => {
    roomScreenLog.debug('Leaving room');
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
