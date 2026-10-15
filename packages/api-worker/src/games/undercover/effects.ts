/** Deliver Undercover word snapshots and rewards; the shared outbox owns retries and persistence. */

import {
  buildPreparationFailureCommand,
  UNDERCOVER_REASONS,
  type UndercoverEffect,
  type UndercoverInternalCommand,
  type UndercoverState,
} from '@game-judge/game-engine/games/undercover/public';

import { publishGameRewards } from '../../features/account/settleGameRewards';
import { dispatchEffectCommand } from '../../platform/gameModules/effectDispatch';
import type { WorkerEffectContext } from '../../platform/gameModules/workerModule';
import {
  getOrCreateUndercoverWordSelection,
  UndercoverWordInventoryExhaustedError,
} from './wordSelection';

/** Correlate exhausted delivery attempts with the currently preparing round. */
export function getUndercoverEffectFailureCommand(
  effect: UndercoverEffect,
  state: UndercoverState,
): UndercoverInternalCommand | null {
  return buildPreparationFailureCommand({
    isSelectionEffect: effect.type === 'undercover.word.select',
    effectRoundId: effect.payload.roundId,
    state: {
      phase: state.phase,
      pendingRound:
        state.phase === 'preparing' || state.phase === 'preparationFailed'
          ? state.pendingRound
          : null,
    },
    buildFailCommand: (roundId, failureCode): UndercoverInternalCommand => ({
      type: 'undercover.round.failPreparation',
      roundId,
      failureCode,
    }),
  });
}

/** Persist selected pairs before dispatch; settle rewards from the immutable completion payload. */
export async function handleUndercoverEffect(
  effect: UndercoverEffect,
  context: WorkerEffectContext<UndercoverState, UndercoverInternalCommand>,
): Promise<void> {
  if (effect.type === 'undercover.game.completed') {
    await publishGameRewards(
      { ...effect.payload, kind: 'completion', gameType: 'undercover' },
      context,
    );
    return;
  }
  if (
    context.state.phase !== 'preparing' ||
    context.state.pendingRound.roundId !== effect.payload.roundId
  )
    return;
  let command: UndercoverInternalCommand;
  try {
    const wordPair = await getOrCreateUndercoverWordSelection({
      db: context.bindings.DB,
      roomIdentity: context.roomIdentity,
      effect,
    });
    command = { type: 'undercover.round.complete', roundId: effect.payload.roundId, wordPair };
  } catch (error) {
    if (!(error instanceof UndercoverWordInventoryExhaustedError)) throw error;
    command = {
      type: 'undercover.round.failPreparation',
      roundId: effect.payload.roundId,
      failureCode: error.failureCode,
    };
  }
  await dispatchEffectCommand(context, command, {
    namespace: command.type,
    supersededReasons: [UNDERCOVER_REASONS.phase, UNDERCOVER_REASONS.round],
    label: 'Undercover preparation',
  });
}
