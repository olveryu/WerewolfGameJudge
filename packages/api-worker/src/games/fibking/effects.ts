/** Worker-side validation and execution for FibKing word-generation effects. */

import {
  FIB_USED_WORD_LIMIT,
  type FibEffect,
  type FibGenerateWordEffect,
  type FibInternalCommand,
  type FibState,
  REASON_FIB_ROUND_MISMATCH,
  REASON_FIB_ROUND_NOT_PREPARING,
} from '@game-judge/game-engine/games/fibking/public';
import { z } from 'zod';

import { createEffectCommandId } from '../../platform/gameModules/effectCommandId';
import type { WorkerEffectContext } from '../../platform/gameModules/workerModule';
import { getOrCreateFibWordGenerationResult } from './wordGenerationResults';
import { createConfiguredFibWordProvider, type FibWordProvider } from './wordProviders';

export const fibEffectSchema: z.ZodType<FibEffect> = z.strictObject({
  type: z.literal('fib.word.generate'),
  payload: z.strictObject({
    roundId: z.string().min(1),
    avoidWords: z.array(z.string().min(1)).max(FIB_USED_WORD_LIMIT).readonly(),
  }),
});

function isSupersededRoundRejection(reason: string): boolean {
  return reason === REASON_FIB_ROUND_NOT_PREPARING || reason === REASON_FIB_ROUND_MISMATCH;
}

export async function handleFibGenerateWordEffect(
  effect: FibGenerateWordEffect,
  context: WorkerEffectContext<FibState, FibInternalCommand>,
  provider: FibWordProvider,
): Promise<void> {
  if (
    context.state.phase !== 'preparing' ||
    context.state.pendingRound.roundId !== effect.payload.roundId
  ) {
    return;
  }
  const candidate = await getOrCreateFibWordGenerationResult({
    db: context.bindings.DB,
    roomIdentity: context.roomIdentity,
    effectId: context.effectId,
    effect,
    provider,
  });
  const commandId = await createEffectCommandId('fib:round-complete', context.effectId);
  const result = await context.dispatchInternal(commandId, {
    type: 'fib.round.complete',
    roundId: effect.payload.roundId,
    word: candidate.word,
    definition: candidate.definition,
    source: candidate.source,
  });
  if (result.commandId !== commandId) {
    throw new Error(
      `[FAIL-FAST] Fib round-complete receipt ${result.commandId} does not match ${commandId}`,
    );
  }
  if (result.kind === 'rejected') {
    if (isSupersededRoundRejection(result.reason)) return;
    throw new Error(`Fib round-complete command ${commandId} was rejected: ${result.reason}`);
  }
  if (result.outcome.kind !== 'success') {
    throw new Error(`Fib round-complete command ${commandId} failed: ${result.outcome.reason}`);
  }
}

export async function handleFibEffect(
  effect: FibEffect,
  context: WorkerEffectContext<FibState, FibInternalCommand>,
): Promise<void> {
  await handleFibGenerateWordEffect(
    effect,
    context,
    createConfiguredFibWordProvider(context.bindings),
  );
}
