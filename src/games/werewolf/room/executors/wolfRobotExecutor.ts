/**
 * wolfRobotExecutor — Handles 'wolfRobotViewHunterStatus' ActionIntent
 *
 * Shows hunter shoot-status dialog for wolfRobot disguise phase, then
 * triggers hunterStatusAckMutation after the user dismisses. Bot authority is
 * carried separately as controlledSeat by the client action hook.
 *
 * Re-entry across the in-flight HTTP window is guarded upstream:
 * - Auto-trigger path: lastAutoIntentKeyRef in useActionOrchestrator dedupes
 *   while currentStepIndex hasn't advanced.
 * - User click path: RoomInteractionPolicy's hasPendingAck gate blocks new
 *   events while the mutation is pending.
 */

import {
  getRoomCommandFailureReason,
  isSuccessfulRoomCommand,
} from '@/features/room/session/roomCommandResult';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

import type { IntentExecutor } from './types';

/** Wolf robot executor for viewing hunter status. */
export const wolfRobotViewHunterStatusExecutor: IntentExecutor = (_intent, ctx) => {
  const { gameState, currentSchema, hunterStatusAckMutation, actionDialogs } = ctx;

  if (!gameState?.wolfRobotReveal) return;

  if (currentSchema?.id !== 'wolfRobotLearn') {
    throw new Error(
      `[WerewolfRoomScreen] wolfRobotViewHunterStatus intent received but currentSchema is ${currentSchema?.id}, expected wolfRobotLearn`,
    );
  }

  const dialogTitle = currentSchema.ui?.hunterGateDialogTitle;
  const canShootText = currentSchema.ui?.hunterGateCanShootText;
  const cannotShootText = currentSchema.ui?.hunterGateCannotShootText;

  if (!dialogTitle || !canShootText || !cannotShootText) {
    throw new Error(
      '[WerewolfRoomScreen] wolfRobotLearn schema missing hunterGate UI fields - schema-driven UI requires these',
    );
  }

  const canShoot = gameState.wolfRobotReveal.canShootAsHunter === true;
  const statusMessage = canShoot ? canShootText : cannotShootText;

  actionDialogs.showRoleActionPrompt(dialogTitle, statusMessage, () => {
    return new Promise<void>((resolve, reject) => {
      hunterStatusAckMutation.mutate(undefined, {
        onSuccess: (result) => {
          if (isSuccessfulRoomCommand(result)) {
            resolve();
            return;
          }
          const reason = getRoomCommandFailureReason(result);
          reject(new Error(reason));
        },
        onError: (error) => {
          handleError(error, {
            label: '机械狼确认猎人状态',
            logger: roomScreenLog,
            feedback: 'toast',
            alertMessage: '确认失败，请稍后重试',
          });
          reject(error);
        },
      });
    });
  });
};
