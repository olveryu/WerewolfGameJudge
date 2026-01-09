/**
 * useRoomHostDialogs - Hook for Host dialog callbacks in RoomScreen
 * 
 * Centralizes all Host-related dialog logic and alert text.
 * RoomScreen only needs to call these returned functions.
 */
import { useCallback } from 'react';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { showAlert } from '../../utils/alert';
import { GameStateService } from '../../services/GameStateService';
import type { LocalGameState } from '../../services/GameStateService';

export interface UseRoomHostDialogsParams {
  gameState: LocalGameState | null;
  assignRoles: () => Promise<void>;
  startGame: () => Promise<void>;
  restartGame: () => Promise<void>;
  getLastNightInfo: () => string;

  setIsStartingGame: React.Dispatch<React.SetStateAction<boolean>>;

  navigation: NativeStackNavigationProp<RootStackParamList, 'Room'>;
  roomNumber: string;
}

export interface UseRoomHostDialogsResult {
  showPrepareToFlipDialog: () => void;
  showStartGameDialog: () => void;
  showLastNightInfoDialog: () => void;
  showRestartDialog: () => void;
  showEmergencyRestartDialog: () => void;
  handleSettingsPress: () => void;
}

export const useRoomHostDialogs = ({
  gameState,
  assignRoles,
  startGame,
  restartGame,
  getLastNightInfo,
  setIsStartingGame,
  navigation,
  roomNumber,
}: UseRoomHostDialogsParams): UseRoomHostDialogsResult => {
  
  const showPrepareToFlipDialog = useCallback(() => {
    if (!gameState) return;
    
    let seatedCount = 0;
    gameState.players.forEach((player) => {
      if (player !== null) seatedCount++;
    });
    const totalSeats = gameState.template.roles.length;
    
    if (seatedCount !== totalSeats) {
      showAlert('无法开始游戏', '有座位尚未被占用。');
      return;
    }
    
    showAlert(
      '允许看牌？',
      '所有座位已被占用。将洗牌并分配角色。',
      [
        { 
          text: '确定', 
          onPress: () => { void assignRoles(); }
        }
      ]
    );
  }, [gameState, assignRoles]);
  
  const handleStartGame = useCallback(async () => {
    setIsStartingGame(true);
    await startGame();
  }, [setIsStartingGame, startGame]);

  const showStartGameDialog = useCallback(() => {
    showAlert(
      '开始游戏？',
      '请将您的手机音量调整到最大。',
      [
        { 
          text: '确定', 
          onPress: () => { void handleStartGame(); }
        }
      ]
    );
  }, [handleStartGame]);
  
  const showLastNightInfoDialog = useCallback(() => {
    showAlert(
      '确定查看昨夜信息？',
      '',
      [
        { 
          text: '确定', 
          onPress: () => {
            const info = getLastNightInfo();
            showAlert('昨夜信息', info);
          }
        },
        { text: '取消', style: 'cancel' },
      ]
    );
  }, [getLastNightInfo]);
  
  const showRestartDialog = useCallback(() => {
    showAlert(
      '重新开始游戏？',
      '使用相同板子开始新一局游戏。',
      [
        { 
          text: '确定', 
          onPress: () => { void restartGame(); }
        },
        { text: '取消', style: 'cancel' },
      ]
    );
  }, [restartGame]);
  
  const showEmergencyRestartDialog = useCallback(() => {
    showAlert(
      '救火重开',
      '将作废当前局并重新发身份。所有人需要重新查看身份后再开始。是否继续？',
      [
        {
          text: '继续重开',
          onPress: () => {
            const success = GameStateService.getInstance().emergencyRestartAndReshuffleRoles();
            if (success) {
              showAlert('已重开', '请所有人重新查看身份。');
            } else {
              showAlert('无法重开', '当前状态不允许重开（未就绪/模板缺失/人数不匹配/非房主）。');
            }
          },
        },
        { text: '取消', style: 'cancel' },
      ]
    );
  }, []);
  
  const handleSettingsPress = useCallback(() => {
    navigation.navigate('Config', { existingRoomNumber: roomNumber });
  }, [navigation, roomNumber]);

  return {
    showPrepareToFlipDialog,
    showStartGameDialog,
    showLastNightInfoDialog,
    showRestartDialog,
    showEmergencyRestartDialog,
    handleSettingsPress,
  };
};

export default useRoomHostDialogs;
