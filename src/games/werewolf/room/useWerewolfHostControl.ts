/**
 * useWerewolfHostControl - Host flow commands (assign / start / restart)
 * for WerewolfRoomScreen, on the shared room command pipeline.
 *
 * Availability lives on the host-management descriptors
 * (createWerewolfHostManagement); this hook owns the confirm dialogs —
 * copy and branching unchanged from the former dialog pipeline — and
 * submission through useRoomCommandSubmission, which provides the
 * single-flight lock and the shared failure alert. MVP selection and
 * settings navigation are not panel commands and stay in
 * useRoomHostDialogs.
 */
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { useCallback, useState } from 'react';

import { useRoomCommandSubmission } from '@/features/room/controllers/useRoomCommandSubmission';
import type { WerewolfCommandDispatchOutcome } from '@/games/werewolf/runtime/WerewolfGameClient';
import { getWerewolfRoomCommandFailureMessage } from '@/games/werewolf/werewolfRoomCommandFailureMessage';
import { CANCEL_BUTTON, showAlert } from '@/utils/alert';
import { showConfirmAlert } from '@/utils/alertPresets';
import { roomScreenLog } from '@/utils/logger';

interface UseWerewolfHostControlParams {
  roomStatus: GameStatus;
  assignRoles: () => Promise<WerewolfCommandDispatchOutcome>;
  startGame: () => Promise<WerewolfCommandDispatchOutcome>;
  restartGame: () => Promise<WerewolfCommandDispatchOutcome>;
  /** Share night review report. Returns true on success, false on failure. */
  shareNightReviewReport: () => Promise<boolean>;
}

interface UseWerewolfHostControlResult {
  showPrepareToFlipDialog: () => void;
  showStartGameDialog: () => void;
  showRestartDialog: () => void;
  /** True while an assign / start / restart command is in flight. */
  isSubmitting: boolean;
  /** True while the start-game command is in flight. */
  isStartingGame: boolean;
}

/** Host flow command hook (assign / start / restart). */
export const useWerewolfHostControl = ({
  roomStatus,
  assignRoles,
  startGame,
  restartGame,
  shareNightReviewReport,
}: UseWerewolfHostControlParams): UseWerewolfHostControlResult => {
  const { isSubmitting, submit } = useRoomCommandSubmission(getWerewolfRoomCommandFailureMessage);
  const [isStartingGame, setIsStartingGame] = useState(false);

  const showPrepareToFlipDialog = useCallback(() => {
    // The full-room gate lives on the descriptor: this dialog only opens
    // once every seat is taken.
    showConfirmAlert('分配角色？', '所有座位已满，将洗牌并分配角色', async () => {
      roomScreenLog.debug('Assigning roles');
      await submit('分配角色', assignRoles);
    });
  }, [assignRoles, submit]);

  const showStartGameDialog = useCallback(() => {
    showConfirmAlert('开始游戏？', '请将手机音量调到最大', async () => {
      roomScreenLog.debug('Starting game');
      setIsStartingGame(true);
      try {
        await submit('开始游戏', startGame);
      } finally {
        setIsStartingGame(false);
      }
    });
  }, [startGame, submit]);

  const handleRestart = useCallback(async () => {
    roomScreenLog.debug('Restarting game');
    await submit('重新开始', restartGame);
  }, [restartGame, submit]);

  const showRestartDialog = useCallback(() => {
    if (roomStatus !== GameStatus.Ended) {
      // Game not ended — no complete report to share, plain restart
      showConfirmAlert('重新开始游戏？', '使用相同配置开始新一局', handleRestart);
      return;
    }

    showAlert('重新开始游戏？', '重新开始后本局复盘将无法查看，是否先分享战报？', [
      CANCEL_BUTTON,
      {
        text: '分享战报',
        onPress: () => {
          void shareNightReviewReport();
        },
      },
      {
        text: '重新开始',
        onPress: () => handleRestart(),
      },
    ]);
  }, [roomStatus, shareNightReviewReport, handleRestart]);

  return {
    showPrepareToFlipDialog,
    showStartGameDialog,
    showRestartDialog,
    isSubmitting,
    isStartingGame,
  };
};
