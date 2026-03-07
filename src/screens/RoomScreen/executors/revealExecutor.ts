/**
 * revealExecutor — Handles 'reveal' ActionIntent
 *
 * Submits via confirmThenAct, polls gameStateRef for reveal data,
 * shows reveal dialog, then sends reveal ACK. Manages pendingRevealDialog state.
 */

import { getRoleDisplayName } from '@werewolf/game-engine/models/roles';

import { roomScreenLog } from '@/utils/logger';

import { getRevealDataFromState } from '../hooks/actionIntentHelpers';
import type { IntentExecutor } from './types';

export const revealExecutor: IntentExecutor = async (intent, ctx) => {
  const { gameState, gameStateRef, currentSchema, confirmThenAct } = ctx;
  const { submitRevealAckSafe, setPendingRevealDialog, actionDialogs } = ctx;

  if (!gameState) return;
  if (!intent.revealKind) {
    roomScreenLog.warn(' reveal intent missing revealKind');
    return;
  }

  const revealKind = intent.revealKind;

  confirmThenAct(intent.targetSeat, async () => {
    setPendingRevealDialog(true);

    const maxRetries = 20;
    const retryInterval = 50;
    let reveal: { targetSeat: number; result: string } | undefined;

    for (let i = 0; i < maxRetries; i++) {
      await new Promise((resolve) => setTimeout(resolve, retryInterval));
      const state = gameStateRef.current;
      if (state) reveal = getRevealDataFromState(state, revealKind);
      if (reveal) break;
    }

    if (reveal) {
      const ui = currentSchema?.kind !== 'compound' ? currentSchema?.ui : undefined;
      const displayResult =
        ui?.revealResultFormat === 'factionCheck'
          ? reveal.result
          : getRoleDisplayName(reveal.result);
      const titlePrefix = ui?.revealTitlePrefix ?? revealKind;
      actionDialogs.showRevealDialog(
        `${titlePrefix}：${reveal.targetSeat + 1}号是${displayResult}`,
        '',
        () => {
          submitRevealAckSafe(revealKind);
          setPendingRevealDialog(false);
        },
      );
    } else {
      roomScreenLog.warn(
        `${revealKind}Reveal timeout - no reveal received after ${maxRetries * retryInterval}ms`,
      );
      setPendingRevealDialog(false);
    }
  });
};
