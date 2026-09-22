/** Deliver Undercover word snapshots; the shared outbox owns retries and terminal persistence. */

import {
  UNDERCOVER_REASONS,
  type UndercoverEffect,
  type UndercoverInternalCommand,
  type UndercoverState,
} from '@game-judge/game-engine/games/undercover/public';

import { createEffectCommandId } from '../../platform/gameModules/effectCommandId';
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
  if (state.phase !== 'preparing' || state.pendingRound.roundId !== effect.payload.roundId)
    return null;
  return {
    type: 'undercover.round.failPreparation',
    roundId: effect.payload.roundId,
    failureCode: 'selectionFailed',
  };
}

/** Persist the selected pair before dispatching an idempotent internal completion. */
export async function handleUndercoverEffect(
  effect: UndercoverEffect,
  context: WorkerEffectContext<UndercoverState, UndercoverInternalCommand>,
): Promise<void> {
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
  const commandId = await createEffectCommandId(command.type, context.effectId);
  const result = await context.dispatchInternal(commandId, command);
  if (result.commandId !== commandId)
    throw new Error('[FAIL-FAST] Undercover effect receipt identity mismatch');
  if (result.kind === 'rejected') {
    if (result.reason === UNDERCOVER_REASONS.phase || result.reason === UNDERCOVER_REASONS.round)
      return;
    throw new Error(`Undercover preparation command rejected: ${result.reason}`);
  }
  if (result.outcome.kind !== 'success')
    throw new Error(`Undercover preparation command failed: ${result.outcome.reason}`);
}
