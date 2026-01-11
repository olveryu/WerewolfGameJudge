/**
 * useRoomNightDialogs - Hook for night phase dialog callbacks in RoomScreen
 * 
 * Centralizes action dialogs for witch, hunter, dark wolf king, and generic roles.
 * RoomScreen only needs to call these returned functions.
 */
import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import { showAlert } from '../../utils/alert';
import { 
  getKilledIndex,
  getHunterStatus,
  getDarkWolfKingStatus,
  GameRoomLike,
} from '../../models/Room';
import { 
  witchRole, 
  hunterRole, 
  darkWolfKingRole,
  getRoleModel,
  RoleName,
} from '../../models/roles';
import type { LocalGameState } from '../../services/GameStateService';

export interface UseRoomNightDialogsParams {
  gameState: LocalGameState | null;
  mySeatNumber: number | null;
  proceedWithActionRef: MutableRefObject<((targetIndex: number | null, extra?: any) => Promise<void>) | null>;
  toGameRoomLike: (gameState: LocalGameState) => GameRoomLike;
}

export interface UseRoomNightDialogsResult {
  showActionDialog: (role: RoleName) => void;
  showWitchDialog: () => void;
  showWitchPoisonDialog: () => void;
  showHunterStatusDialog: () => void;
  showDarkWolfKingStatusDialog: () => void;
}

export const useRoomNightDialogs = ({
  gameState,
  mySeatNumber,
  proceedWithActionRef,
  toGameRoomLike,
}: UseRoomNightDialogsParams): UseRoomNightDialogsResult => {

  const showWitchPoisonDialog = useCallback(() => {
    const dialogConfig = witchRole.getPoisonDialogConfig();
    showAlert(dialogConfig.title, dialogConfig.message ?? '', dialogConfig.buttons);
  }, []);

  const showHunterStatusDialog = useCallback(() => {
    if (!gameState) return;
    const canUseSkill = getHunterStatus(toGameRoomLike(gameState));
    
    const dialogConfig = hunterRole.getStatusDialogConfig(canUseSkill);
    showAlert(dialogConfig.title, dialogConfig.message ?? '', [
      { text: dialogConfig.buttons[0].text, onPress: () => { void proceedWithActionRef.current?.(null); } }
    ]);
  }, [gameState]);

  const showDarkWolfKingStatusDialog = useCallback(() => {
    if (!gameState) return;
    const canUseSkill = getDarkWolfKingStatus(toGameRoomLike(gameState));
    
    const dialogConfig = darkWolfKingRole.getStatusDialogConfig(canUseSkill);
    showAlert(dialogConfig.title, dialogConfig.message ?? '', [
      { text: dialogConfig.buttons[0].text, onPress: () => { void proceedWithActionRef.current?.(null); } }
    ]);
  }, [gameState]);

  const showWitchDialog = useCallback(() => {
    if (!gameState || mySeatNumber === null) return;
    const killedIndex = getKilledIndex(toGameRoomLike(gameState));
    
    const dialogConfig = witchRole.getActionDialogConfig({
      mySeatNumber,
      killedIndex,
      playerCount: gameState.players.size,
      alivePlayers: [],
      currentActions: {},
      proceedWithAction: (target, isPoison) => { void proceedWithActionRef.current?.(target, isPoison ?? false); },
      showNextDialog: showWitchPoisonDialog,
    });
    
    if (dialogConfig) {
      showAlert(dialogConfig.title, dialogConfig.message ?? '', dialogConfig.buttons);
    }
  }, [gameState, mySeatNumber]);

  const showActionDialog = useCallback((role: RoleName) => {
    const roleModel = getRoleModel(role);
    if (!roleModel) return;
    
    const actionMessage = roleModel.actionMessage || `请${roleModel.displayName}行动`;
    
    if (role === 'witch') {
      showWitchDialog();
    } else if (role === 'hunter') {
      showHunterStatusDialog();
    } else if (role === 'darkWolfKing') {
      showDarkWolfKingStatusDialog();
    } else if (role === 'wolf') {
      showAlert('狼人请睁眼', actionMessage, [{ text: '好', style: 'default' }]);
    } else {
      showAlert(`${roleModel.displayName}请睁眼`, actionMessage, [{ text: '好', style: 'default' }]);
    }
  }, [showWitchDialog, showHunterStatusDialog, showDarkWolfKingStatusDialog]);

  return {
    showActionDialog,
    showWitchDialog,
    showWitchPoisonDialog,
    showHunterStatusDialog,
    showDarkWolfKingStatusDialog,
  };
};

export default useRoomNightDialogs;
