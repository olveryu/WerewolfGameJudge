/**
 * Shared dispatch for word-preparation internal commands (E2).
 *
 * The worker side of the preparation protocol is one chain, written
 * once here for the games that run it (FibKing, Undercover): derive
 * the effect-scoped command id, dispatch the internal command, verify
 * the receipt carries that same id, treat a rejection with one of the
 * game's superseded-round reasons as a quiet no-op (the round moved
 * on while the selection was in flight), and fail fast on every
 * other rejection or non-success outcome. Game modules inject only
 * their command-id namespace, their superseded reasons, and a label
 * for error messages.
 */

import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import { createEffectCommandId } from './effectCommandId';
import type { WorkerEffectContext } from './workerModule';

export interface PreparationDispatchOptions {
  /** Command-id namespace segment, unique per dispatch site (e.g. 'fib:round-complete'). */
  readonly namespace: string;
  /** Rejection reasons that mean the round was superseded; those resolve as `false`. */
  readonly supersededReasons: readonly string[];
  /** Error-message label (e.g. 'Fib round-complete'). */
  readonly label: string;
}

/**
 * Dispatch one preparation internal command and validate its receipt.
 * Returns false only for a superseded-round rejection; every other
 * failure throws.
 */
export async function dispatchPreparationCommand<
  TState extends BaseGameState<string>,
  TInternalCommand,
>(
  context: WorkerEffectContext<TState, TInternalCommand>,
  command: TInternalCommand,
  options: PreparationDispatchOptions,
): Promise<boolean> {
  const commandId = await createEffectCommandId(options.namespace, context.effectId);
  const result = await context.dispatchInternal(commandId, command);
  if (result.commandId !== commandId) {
    throw new Error(
      `[FAIL-FAST] ${options.label} receipt ${result.commandId} does not match ${commandId}`,
    );
  }
  if (result.kind === 'rejected') {
    if (options.supersededReasons.some((reason) => reason === result.reason)) return false;
    throw new Error(`${options.label} command ${commandId} was rejected: ${result.reason}`);
  }
  if (result.outcome.kind !== 'success') {
    throw new Error(`${options.label} command ${commandId} failed: ${result.outcome.reason}`);
  }
  return true;
}
