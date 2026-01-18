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
import type { LocalGameState } from '../../services/GameStateService';

/**
 * Generate random speaking order for the start of day phase.
 * @param playerCount - Total number of players
 * @returns Object with starting seat number (1-indexed) and direction
 */
function generateSpeakOrder(playerCount: number): {
  startSeat: number;
  direction: '顺时针' | '逆时针';
} {
  const startSeat = Math.floor(Math.random() * playerCount) + 1;
  const direction = Math.random() < 0.5 ? '顺时针' : '逆时针';
  return { startSeat, direction };
}

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
  showSpeakOrderDialog: () => void;
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
      showAlert('无法开始游戏', '有座位尚未被占用。', [{ text: '知道了', style: 'default' }]);
      return;
    }

    showAlert('允许看牌？', '所有座位已被占用。将洗牌并分配角色。', [
      {
        text: '确定',
        onPress: () => {
          void assignRoles();
        },
      },
      { text: '取消', style: 'cancel' },
    ]);
  }, [gameState, assignRoles]);

  const handleStartGame = useCallback(async () => {
    setIsStartingGame(true);
    await startGame();
  }, [setIsStartingGame, startGame]);

  const showStartGameDialog = useCallback(() => {
    showAlert('开始游戏？', '请将您的手机音量调整到最大。', [
      {
        text: '确定',
        onPress: () => {
          void handleStartGame();
        },
      },
      { text: '取消', style: 'cancel' },
    ]);
  }, [handleStartGame]);

  const showLastNightInfoDialog = useCallback(() => {
    showAlert('确定查看昨夜信息？', '', [
      {
        text: '确定',
        onPress: () => {
          const info = getLastNightInfo();
          showAlert('昨夜信息', info, [{ text: '知道了', style: 'default' }]);
        },
      },
      { text: '取消', style: 'cancel' },
    ]);
  }, [getLastNightInfo]);

  const showRestartDialog = useCallback(() => {
    showAlert('重新开始游戏？', '使用相同板子开始新一局游戏。', [
      {
        text: '确定',
        onPress: () => {
          void restartGame();
        },
      },
      { text: '取消', style: 'cancel' },
    ]);
  }, [restartGame]);

  const showSpeakOrderDialog = useCallback(() => {
    if (!gameState) return;

    const playerCount = gameState.template.roles.length;
    const { startSeat, direction } = generateSpeakOrder(playerCount);

    showAlert('发言顺序', `从 ${startSeat} 号玩家开始，${direction} 发言。`, [
      { text: '知道了', style: 'default' },
    ]);
  }, [gameState]);

  const handleSettingsPress = useCallback(() => {
    navigation.navigate('Config', { existingRoomNumber: roomNumber });
  }, [navigation, roomNumber]);

  return {
    showPrepareToFlipDialog,
    showStartGameDialog,
    showLastNightInfoDialog,
    showRestartDialog,
    showSpeakOrderDialog,
    handleSettingsPress,
  };
};

export default useRoomHostDialogs;
