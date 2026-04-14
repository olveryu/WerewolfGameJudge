/**
 * wolfRobotExecutor — Handles 'wolfRobotViewHunterStatus' ActionIntent
 *
 * Shows hunter shoot-status dialog for wolfRobot disguise phase,
 * then sends status-viewed acknowledgment via sendWolfRobotHunterStatusViewed.
 */

import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

import type { IntentExecutor } from './types';

export const wolfRobotViewHunterStatusExecutor: IntentExecutor = (_intent, ctx) => {
  const {
    gameState,
    effectiveSeat,
    currentSchema,
    pendingHunterStatusViewed,
    setPendingHunterStatusViewed,
    sendWolfRobotHunterStatusViewed,
    actionDialogs,
  } = ctx;

  if (!gameState?.wolfRobotReveal) return;

  if (pendingHunterStatusViewed) {
    roomScreenLog.debug('wolfRobotViewHunterStatus Skipping - pending submission');
    return;
  }

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

  actionDialogs.showRoleActionPrompt(dialogTitle, statusMessage, async () => {
    if (effectiveSeat === null) {
      roomScreenLog.warn(
        '[wolfRobotViewHunterStatus] Cannot submit without seat (effectiveSeat is null)',
      );
      return;
    }
    setPendingHunterStatusViewed(true);
    try {
      await sendWolfRobotHunterStatusViewed(effectiveSeat);
    } catch (error) {
      handleError(error, {
        label: '机械狼确认猎人状态',
        logger: roomScreenLog,
        alertTitle: '确认失败',
        alertMessage: '确认失败，请稍后重试',
      });
    } finally {
      setPendingHunterStatusViewed(false);
    }
  });
};
