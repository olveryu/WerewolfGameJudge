/**
 * useRoomHostDialogs - Hook for Host dialog callbacks in RoomScreen
 *
 * Centralizes all Host-related dialog logic and alert text.
 * RoomScreen only needs to call these returned functions.
 */
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { randomBool, randomIntInclusive, type Rng } from '@werewolf/game-engine/utils/random';
import { useCallback, useRef, useState } from 'react';

import type { RootStackParamList } from '@/navigation/types';
import type { LocalGameState } from '@/types/GameStateTypes';
import { CANCEL_BUTTON, confirmButton, DISMISS_BUTTON, showAlert } from '@/utils/alert';
import { roomScreenLog } from '@/utils/logger';

/**
 * Generate random speaking order for the start of day phase.
 * @param playerCount - Total number of players
 * @param rng - Optional random number generator for testing
 * @returns Object with starting seat number (1-indexed) and direction
 */
export function generateSpeakOrder(
  playerCount: number,
  rng?: Rng,
): {
  startSeat: number;
  direction: '顺时针' | '逆时针';
} {
  const startSeat = randomIntInclusive(1, playerCount, rng);
  const direction = randomBool(rng) ? '顺时针' : '逆时针';
  return { startSeat, direction };
}

interface UseRoomHostDialogsParams {
  gameState: LocalGameState | null;
  assignRoles: () => Promise<void>;
  startGame: () => Promise<void>;
  restartGame: () => Promise<void>;

  setIsStartingGame: React.Dispatch<React.SetStateAction<boolean>>;

  navigation: NativeStackNavigationProp<RootStackParamList, 'Room'>;
  roomNumber: string;
}

interface UseRoomHostDialogsResult {
  showPrepareToFlipDialog: () => void;
  showStartGameDialog: () => void;
  showRestartDialog: () => void;
  handleSettingsPress: () => void;
  /** True while any host action (assign/start/restart) is in-flight. */
  isHostActionSubmitting: boolean;
}

export const useRoomHostDialogs = ({
  gameState,
  assignRoles,
  startGame,
  restartGame,
  setIsStartingGame,
  navigation,
  roomNumber,
}: UseRoomHostDialogsParams): UseRoomHostDialogsResult => {
  const submittingRef = useRef(false);
  const [isHostActionSubmitting, setIsHostActionSubmitting] = useState(false);

  /** Mark submission start (ref + state). */
  const markSubmitting = useCallback((v: boolean) => {
    submittingRef.current = v;
    setIsHostActionSubmitting(v);
  }, []);

  const showPrepareToFlipDialog = useCallback(() => {
    if (!gameState) return;

    let seatedCount = 0;
    gameState.players.forEach((player) => {
      if (player !== null) seatedCount++;
    });
    const totalSeats = gameState.template.numberOfPlayers;

    if (seatedCount !== totalSeats) {
      roomScreenLog.warn('[HostDialogs] Cannot prepare to flip — seats not full', {
        seatedCount,
        totalSeats,
      });
      showAlert('无法开始游戏', '还有空位未入座', [DISMISS_BUTTON]);
      return;
    }

    showAlert('分配角色？', '所有座位已满，将洗牌并分配角色', [
      CANCEL_BUTTON,
      confirmButton(() => {
        if (submittingRef.current) return;
        markSubmitting(true);
        roomScreenLog.debug('[HostDialogs] Assigning roles');
        void assignRoles().finally(() => {
          markSubmitting(false);
        });
      }),
    ]);
  }, [gameState, assignRoles, markSubmitting]);

  const handleStartGame = useCallback(async () => {
    if (submittingRef.current) return;
    markSubmitting(true);
    roomScreenLog.debug('[HostDialogs] Starting game');
    try {
      setIsStartingGame(true);
      await startGame();
    } finally {
      markSubmitting(false);
      setIsStartingGame(false);
    }
  }, [markSubmitting, setIsStartingGame, startGame]);

  const showStartGameDialog = useCallback(() => {
    showAlert('开始游戏？', '请将手机音量调到最大', [
      CANCEL_BUTTON,
      confirmButton(() => {
        void handleStartGame();
      }),
    ]);
  }, [handleStartGame]);

  const showRestartDialog = useCallback(() => {
    showAlert('重新开始游戏？', '使用相同配置开始新一局', [
      CANCEL_BUTTON,
      confirmButton(() => {
        if (submittingRef.current) return;
        markSubmitting(true);
        roomScreenLog.debug('[HostDialogs] Restarting game');
        void restartGame().finally(() => {
          markSubmitting(false);
        });
      }),
    ]);
  }, [restartGame, markSubmitting]);

  const handleSettingsPress = useCallback(() => {
    navigation.navigate('Config', { existingRoomNumber: roomNumber });
  }, [navigation, roomNumber]);

  return {
    showPrepareToFlipDialog,
    showStartGameDialog,
    showRestartDialog,
    handleSettingsPress,
    isHostActionSubmitting,
  };
};
