/**
 * useWerewolfHostControl - Host flow commands (assign / start / abort /
 * redeal / return-to-lobby) for WerewolfRoomScreen, on the shared room
 * command pipeline.
 *
 * Availability lives on the host-management descriptors
 * (createWerewolfHostManagement); this hook owns the confirm dialogs —
 * copy and branching unchanged from the former dialog pipeline — and
 * submission through useRoomCommandSubmission, which provides the
 * single-flight lock and the shared failure alert. MVP selection and
 * settings navigation are not panel commands and stay in
 * useRoomHostDialogs.
 *
 * The two terminal flows (redeal / return-to-lobby) both pass the
 * share-report ritual first: once either is submitted the finished
 * game's review is gone, so the host is offered the report before the
 * flow is chosen — the ritual is shared, the submitted command is not.
 */
import { useCallback, useState } from 'react';

import { useRoomCommandSubmission } from '@/features/room/controllers/useRoomCommandSubmission';
import { HOST_FLOW_CONFIRM } from '@/features/room/model/hostManagementActions';
import type { WerewolfCommandDispatchOutcome } from '@/games/werewolf/runtime/WerewolfGameClient';
import { getWerewolfRoomCommandFailureMessage } from '@/games/werewolf/werewolfRoomCommandFailureMessage';
import { CANCEL_BUTTON, showAlert } from '@/utils/alert';
import { showConfirmAlert } from '@/utils/alertPresets';
import { roomScreenLog } from '@/utils/logger';

interface UseWerewolfHostControlParams {
  assignRoles: () => Promise<WerewolfCommandDispatchOutcome>;
  startGame: () => Promise<WerewolfCommandDispatchOutcome>;
  abortGame: () => Promise<WerewolfCommandDispatchOutcome>;
  returnToLobby: () => Promise<WerewolfCommandDispatchOutcome>;
  redealGame: () => Promise<WerewolfCommandDispatchOutcome>;
  /** Share night review report. Returns true on success, false on failure. */
  shareNightReviewReport: () => Promise<boolean>;
}

interface UseWerewolfHostControlResult {
  showPrepareToFlipDialog: () => void;
  showStartGameDialog: () => void;
  showAbortDialog: () => void;
  showRedealDialog: () => void;
  showReturnToLobbyDialog: () => void;
  /** True while a host flow command is in flight. */
  isSubmitting: boolean;
  /** True while the start-game command is in flight. */
  isStartingGame: boolean;
}

/** Host flow command hook (assign / start / abort / redeal / return-to-lobby). */
export const useWerewolfHostControl = ({
  assignRoles,
  startGame,
  abortGame,
  returnToLobby,
  redealGame,
  shareNightReviewReport,
}: UseWerewolfHostControlParams): UseWerewolfHostControlResult => {
  const { isSubmitting, submit } = useRoomCommandSubmission(getWerewolfRoomCommandFailureMessage);
  const [isStartingGame, setIsStartingGame] = useState(false);

  const showPrepareToFlipDialog = useCallback(() => {
    // The full-room gate lives on the descriptor: this dialog only opens
    // once every seat is taken.
    showConfirmAlert(HOST_FLOW_CONFIRM.assignTitle, '所有座位已满，将洗牌并分配角色', async () => {
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

  const handleAbort = useCallback(async () => {
    roomScreenLog.debug('Aborting game');
    await submit('中止本局', abortGame);
  }, [abortGame, submit]);

  const showAbortDialog = useCallback(() => {
    // The danger action aborts the current game back to the seated
    // state; there is no report to share yet.
    showConfirmAlert(
      HOST_FLOW_CONFIRM.abortTitle,
      '本局不计胜负，保留座位和板子，清除已分配的角色。',
      handleAbort,
    );
  }, [handleAbort]);

  const handleRedeal = useCallback(async () => {
    roomScreenLog.debug('Redealing game');
    await submit('再来一局', redealGame);
  }, [redealGame, submit]);

  const handleReturnToLobby = useCallback(async () => {
    roomScreenLog.debug('Returning to lobby');
    await submit('返回大厅', returnToLobby);
  }, [returnToLobby, submit]);

  const showEndedFlowDialog = useCallback(
    (flow: 'redeal' | 'returnToLobby') => {
      // Share-report ritual: whichever terminal flow the host picked,
      // submitting it closes the finished game's review, so the report
      // is offered first; the confirm button then runs that flow only.
      const isRedeal = flow === 'redeal';
      showAlert(
        isRedeal ? HOST_FLOW_CONFIRM.nextRoundTitle : HOST_FLOW_CONFIRM.returnLobbyTitle,
        '本局复盘将无法查看，是否先分享战报？',
        [
          CANCEL_BUTTON,
          {
            text: '分享战报',
            onPress: () => {
              void shareNightReviewReport();
            },
          },
          {
            text: isRedeal ? '再来一局' : '返回大厅',
            onPress: () => (isRedeal ? handleRedeal() : handleReturnToLobby()),
          },
        ],
      );
    },
    [shareNightReviewReport, handleRedeal, handleReturnToLobby],
  );

  const showRedealDialog = useCallback(() => {
    showEndedFlowDialog('redeal');
  }, [showEndedFlowDialog]);

  const showReturnToLobbyDialog = useCallback(() => {
    showEndedFlowDialog('returnToLobby');
  }, [showEndedFlowDialog]);

  return {
    showPrepareToFlipDialog,
    showStartGameDialog,
    showAbortDialog,
    showRedealDialog,
    showReturnToLobbyDialog,
    isSubmitting,
    isStartingGame,
  };
};
