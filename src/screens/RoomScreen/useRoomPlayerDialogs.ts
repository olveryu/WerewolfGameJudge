/**
 * useRoomPlayerDialogs - Hook for Player dialog callbacks in RoomScreen
 * 
 * Centralizes seat selection, action confirmation, and leave room dialogs.
 * RoomScreen only needs to call these returned functions.
 */
import { useCallback } from 'react';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { showAlert } from '../../utils/alert';
import { RoomStatus } from '../../models/Room';
import type { RoleName } from '../../models/roles';
import type { LocalGameState } from '../../services/GameStateService';

export interface UseRoomPlayerDialogsParams {
  // State setters for seat modal
  setPendingSeatIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setModalType: React.Dispatch<React.SetStateAction<'enter' | 'leave'>>;
  setSeatModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  pendingSeatIndex: number | null;
  
  // Seat actions
  takeSeat: (seatNumber: number) => Promise<boolean>;
  leaveSeat: () => Promise<void>;
  
  // Action confirm dependencies
  myRole: RoleName | null;
  gameState: LocalGameState | null;
  findVotingWolfSeat: () => number | null;
  buildActionMessage: (index: number, actingRole: RoleName) => string;
  proceedWithAction: (targetIndex: number | null, extra?: any) => Promise<void>;
  performAction: (targetIndex: number) => void;
  setAnotherIndex: React.Dispatch<React.SetStateAction<number | null>>;
  submitWolfVote: (target: number) => Promise<void>;
  
  // Leave room
  roomStatus: RoomStatus;
  navigation: NativeStackNavigationProp<RootStackParamList, 'Room'>;
}

export interface UseRoomPlayerDialogsResult {
  showEnterSeatDialog: (index: number) => void;
  handleConfirmSeat: () => Promise<void>;
  handleCancelSeat: () => void;
  showLeaveSeatDialog: (index: number) => void;
  handleConfirmLeave: () => Promise<void>;
  showActionConfirmDialog: (index: number) => void;
  showWolfVoteConfirmDialog: (targetIndex: number, wolfSeat: number) => void;
  handleSkipAction: () => void;
  handleLeaveRoom: () => void;
}

export const useRoomPlayerDialogs = ({
  setPendingSeatIndex,
  setModalType,
  setSeatModalVisible,
  pendingSeatIndex,
  takeSeat,
  leaveSeat,
  myRole,
  gameState,
  findVotingWolfSeat,
  buildActionMessage,
  proceedWithAction,
  performAction,
  setAnotherIndex,
  submitWolfVote,
  roomStatus,
  navigation,
}: UseRoomPlayerDialogsParams): UseRoomPlayerDialogsResult => {

  const showEnterSeatDialog = useCallback((index: number) => {
    setPendingSeatIndex(index);
    setModalType('enter');
    setSeatModalVisible(true);
  }, []);

  const handleConfirmSeat = useCallback(async () => {
    if (pendingSeatIndex === null) return;
    
    const success = await takeSeat(pendingSeatIndex);
    setSeatModalVisible(false);
    
    if (!success) {
      showAlert(`${pendingSeatIndex + 1}号座已被占用`, '请选择其他位置。');
    }
    setPendingSeatIndex(null);
  }, [pendingSeatIndex, takeSeat]);

  const handleCancelSeat = useCallback(() => {
    setSeatModalVisible(false);
    setPendingSeatIndex(null);
  }, []);

  const showLeaveSeatDialog = useCallback((index: number) => {
    setPendingSeatIndex(index);
    setModalType('leave');
    setSeatModalVisible(true);
  }, []);

  const handleConfirmLeave = useCallback(async () => {
    if (pendingSeatIndex === null) return;
    
    await leaveSeat();
    setSeatModalVisible(false);
    setPendingSeatIndex(null);
  }, [pendingSeatIndex, leaveSeat]);

  const showWolfVoteConfirmDialog = useCallback((targetIndex: number, wolfSeat: number) => {
    if (!gameState) return;
    
    const player = gameState.players.get(wolfSeat);
    const wolfName = player?.displayName || `${wolfSeat + 1}号狼人`;
    
    const msg = targetIndex === -1 
      ? `${wolfName} 确定投票空刀吗？` 
      : `${wolfName} 确定要猎杀${targetIndex + 1}号玩家吗？`;
    
    showAlert(
      '狼人投票',
      msg,
      [
        { 
          text: '确定', 
          onPress: () => { void submitWolfVote(targetIndex); }
        },
        { text: '取消', style: 'cancel' },
      ]
    );
  }, [gameState, submitWolfVote]);

  const showActionConfirmDialog = useCallback((index: number) => {
    if (!myRole) return;
    
    if (myRole === 'wolf') {
      const votingWolfSeat = findVotingWolfSeat();
      if (votingWolfSeat !== null) {
        showWolfVoteConfirmDialog(index, votingWolfSeat);
        return;
      }
    }
    
    const msg = buildActionMessage(index, myRole);
    
    showAlert(
      index === -1 ? '不发动技能' : '使用技能',
      msg,
      [
        { 
          text: '确定', 
          onPress: () => {
            if (index === -1) {
              proceedWithAction(null);
            } else {
              performAction(index);
            }
          }
        },
        { 
          text: '取消', 
          style: 'cancel',
          onPress: () => setAnotherIndex(null)
        },
      ]
    );
  }, [myRole, findVotingWolfSeat, buildActionMessage]);

  const handleSkipAction = useCallback(() => {
    showActionConfirmDialog(-1);
  }, [showActionConfirmDialog]);

  const handleLeaveRoom = useCallback(() => {
    if (roomStatus === RoomStatus.ongoing) {
      navigation.navigate('Home');
      return;
    }
    
    showAlert(
      '离开房间？',
      '',
      [
        { text: '确定', onPress: () => navigation.navigate('Home') },
        { text: '取消', style: 'cancel' },
      ]
    );
  }, [roomStatus, navigation]);

  return {
    showEnterSeatDialog,
    handleConfirmSeat,
    handleCancelSeat,
    showLeaveSeatDialog,
    handleConfirmLeave,
    showActionConfirmDialog,
    showWolfVoteConfirmDialog,
    handleSkipAction,
    handleLeaveRoom,
  };
};

export default useRoomPlayerDialogs;
