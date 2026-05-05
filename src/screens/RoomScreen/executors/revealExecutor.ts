/**
 * revealExecutor — Handles 'reveal' ActionIntent
 *
 * Submits via confirmThenAct, polls gameStateRef for reveal data, shows the
 * reveal dialog, and triggers revealAckMutation.mutate when the user
 * dismisses. The mutation's isPending covers the dialog-closed-but-ack-pending
 * window the previous pendingRevealDialog flag protected (gate logic in
 * RoomInteractionPolicy via usePendingAcks).
 *
 * Soft failure (server returns success: false) re-shows the dialog with the
 * same attemptAck closure for retry.
 */

import { getRoleDisplayName } from '@werewolf/game-engine/models/roles';
import { formatSeat } from '@werewolf/game-engine/utils/formatSeat';

import { showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

import { getRevealDataFromState } from '../hooks/actionIntentHelpers';
import type { IntentExecutor } from './types';

export const revealExecutor: IntentExecutor = (intent, ctx) => {
  const { gameState, gameStateRef, currentSchema, confirmThenAct, mountedRef } = ctx;
  const { revealAckMutation, actionDialogs } = ctx;

  if (!gameState) return;
  if (!intent.revealKind) {
    roomScreenLog.warn(' reveal intent missing revealKind');
    return;
  }

  const revealKind = intent.revealKind;

  confirmThenAct(intent.targetSeat, async () => {
    const maxRetries = 30;
    const retryInterval = 100;
    let reveal: { targetSeat: number; result: string } | undefined;

    for (let i = 0; i < maxRetries; i++) {
      await new Promise((resolve) => setTimeout(resolve, retryInterval));
      if (!mountedRef.current) return;
      const state = gameStateRef.current;
      if (state) reveal = getRevealDataFromState(state, revealKind);
      if (reveal) break;
    }

    if (!mountedRef.current) return;

    if (!reveal) {
      roomScreenLog.warn(
        `${revealKind}Reveal timeout - no reveal received after ${maxRetries * retryInterval}ms`,
      );
      showErrorAlert('查看结果超时', '未收到服务端返回，请稍后重试');
      return;
    }

    const ui = currentSchema?.kind !== 'compound' ? currentSchema?.ui : undefined;
    const displayResult =
      ui?.revealResultFormat === 'factionCheck' ? reveal.result : getRoleDisplayName(reveal.result);
    const titlePrefix = ui?.revealTitlePrefix ?? revealKind;
    const revealTitle = `${titlePrefix}：${formatSeat(reveal.targetSeat)}是${displayResult}`;

    const attemptAck = (): Promise<void> =>
      new Promise<void>((resolve, reject) => {
        revealAckMutation.mutate(undefined, {
          onSuccess: (result) => {
            if (!mountedRef.current) return;
            if (!result.success) {
              roomScreenLog.warn('revealAck failed', { reason: result.reason });
              reject(new Error(result.reason ?? 'revealAck failed'));
            } else {
              resolve();
            }
          },
          onError: (error) => {
            handleError(error, {
              label: '确认查验结果',
              logger: roomScreenLog,
              feedback: 'toast',
              alertMessage: '请稍后重试',
            });
            reject(error);
          },
        });
      });

    actionDialogs.showRevealDialog(revealTitle, '', attemptAck);
  });
};
