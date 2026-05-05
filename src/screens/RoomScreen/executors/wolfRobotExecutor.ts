/**
 * wolfRobotExecutor — Handles 'wolfRobotViewHunterStatus' ActionIntent
 *
 * Shows hunter shoot-status dialog for wolfRobot disguise phase, then
 * triggers hunterStatusAckMutation.mutate(seat) after the user dismisses.
 *
 * Re-entry across the in-flight HTTP window is guarded upstream:
 * - Auto-trigger path: lastAutoIntentKeyRef in useActionOrchestrator dedupes
 *   while currentStepIndex hasn't advanced.
 * - User click path: RoomInteractionPolicy's hasPendingAck gate blocks new
 *   events while the mutation is pending.
 */

import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

import type { IntentExecutor } from './types';

export const wolfRobotViewHunterStatusExecutor: IntentExecutor = (_intent, ctx) => {
  const { gameState, effectiveSeat, currentSchema, hunterStatusAckMutation, actionDialogs } = ctx;

  if (!gameState?.wolfRobotReveal) return;

  if (currentSchema?.id !== 'wolfRobotLearn') {
    throw new Error(
      `[RoomScreen] wolfRobotViewHunterStatus intent received but currentSchema is ${currentSchema?.id}, expected wolfRobotLearn`,
    );
  }

  const dialogTitle = currentSchema.ui?.hunterGateDialogTitle;
  const canShootText = currentSchema.ui?.hunterGateCanShootText;
  const cannotShootText = currentSchema.ui?.hunterGateCannotShootText;

  if (!dialogTitle || !canShootText || !cannotShootText) {
    throw new Error(
      '[RoomScreen] wolfRobotLearn schema missing hunterGate UI fields - schema-driven UI requires these',
    );
  }

  const canShoot = gameState.wolfRobotReveal.canShootAsHunter === true;
  const statusMessage = canShoot ? canShootText : cannotShootText;

  actionDialogs.showRoleActionPrompt(dialogTitle, statusMessage, () => {
    if (effectiveSeat === null) {
      roomScreenLog.warn(
        '[wolfRobotViewHunterStatus] Cannot submit without seat (effectiveSeat is null)',
      );
      return;
    }
    hunterStatusAckMutation.mutate(effectiveSeat, {
      onError: (error) => {
        handleError(error, {
          label: '机械狼确认猎人状态',
          logger: roomScreenLog,
          alertTitle: '确认失败',
          alertMessage: '确认失败，请稍后重试',
        });
      },
    });
  });
};
