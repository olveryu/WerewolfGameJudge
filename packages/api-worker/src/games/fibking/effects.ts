/** Worker-side validation and execution for FibKing word-generation effects. */

import {
  FIB_PREPARATION_STAGES,
  FIB_USED_WORD_LIMIT,
  type FibEffect,
  type FibGenerateWordEffect,
  type FibInternalCommand,
  type FibPreparationFailureCode,
  type FibState,
  REASON_FIB_ROUND_MISMATCH,
  REASON_FIB_ROUND_NOT_PREPARING,
} from '@game-judge/game-engine/games/fibking/public';
import { z } from 'zod';

import { createEffectCommandId } from '../../platform/gameModules/effectCommandId';
import type {
  EffectExecutionResult,
  EffectTerminalReason,
} from '../../platform/gameModules/runtimeGameModule';
import type { WorkerEffectContext } from '../../platform/gameModules/workerModule';
import { FibWordCatalogExhaustedError } from './wordCatalog';
import { getOrCreateFibWordGenerationResult } from './wordGenerationResults';
import { getFibWordHistoryUserIds, recordFibWordExposure } from './wordHistory';

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

async function dispatchPreparationStage(
  context: WorkerEffectContext<FibState, FibInternalCommand>,
  roundId: string,
): Promise<boolean> {
  const commandId = await createEffectCommandId(
    'fib:preparation-stage-selecting-word',
    context.effectId,
  );
  const result = await context.dispatchInternal(commandId, {
    type: 'fib.round.updatePreparationStage',
    roundId,
    stage: FIB_PREPARATION_STAGES.selectingWord,
  });
  if (result.commandId !== commandId) {
    throw new Error(
      `[FAIL-FAST] Fib preparation-stage receipt ${result.commandId} does not match ${commandId}`,
    );
  }
  if (result.kind === 'rejected') {
    if (isSupersededRoundRejection(result.reason)) return false;
    throw new Error(`Fib preparation-stage command ${commandId} was rejected: ${result.reason}`);
  }
  if (result.outcome.kind !== 'success') {
    throw new Error(`Fib preparation-stage command ${commandId} failed: ${result.outcome.reason}`);
  }
  return true;
}

export async function ensureFibSelectingWordStage(
  effect: FibGenerateWordEffect,
  context: WorkerEffectContext<FibState, FibInternalCommand>,
): Promise<boolean> {
  if (
    context.state.phase !== 'preparing' ||
    context.state.pendingRound.roundId !== effect.payload.roundId
  ) {
    return false;
  }
  if (context.state.pendingRound.stage === FIB_PREPARATION_STAGES.selectingWord) return true;
  return dispatchPreparationStage(context, effect.payload.roundId);
}

export async function handleFibGenerateWordEffect(
  effect: FibGenerateWordEffect,
  context: WorkerEffectContext<FibState, FibInternalCommand>,
): Promise<EffectExecutionResult> {
  try {
    if (!(await ensureFibSelectingWordStage(effect, context))) return { kind: 'success' };

    const historyUserIds = getFibWordHistoryUserIds(context.state);
    const candidate = await getOrCreateFibWordGenerationResult({
      db: context.bindings.DB,
      roomIdentity: context.roomIdentity,
      effectId: context.effectId,
      effect,
      historyUserIds,
    });
    const commandId = await createEffectCommandId('fib:round-complete', context.effectId);
    const result = await context.dispatchInternal(commandId, {
      type: 'fib.round.complete',
      roundId: effect.payload.roundId,
      catalogEntryId: candidate.catalogEntryId,
      catalogVersion: candidate.catalogVersion,
      word: candidate.word,
      definition: candidate.definition,
    });
    if (result.commandId !== commandId) {
      throw new Error(
        `[FAIL-FAST] Fib round-complete receipt ${result.commandId} does not match ${commandId}`,
      );
    }
    if (result.kind === 'rejected') {
      if (isSupersededRoundRejection(result.reason)) return { kind: 'success' };
      throw new Error(`Fib round-complete command ${commandId} was rejected: ${result.reason}`);
    }
    if (result.outcome.kind !== 'success') {
      throw new Error(`Fib round-complete command ${commandId} failed: ${result.outcome.reason}`);
    }
    await recordFibWordExposure(
      context.bindings.DB,
      historyUserIds,
      candidate.word,
      new Date().toISOString(),
    );
    return { kind: 'success' };
  } catch (error) {
    return {
      kind: 'terminal',
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

export async function handleFibEffect(
  effect: FibEffect,
  context: WorkerEffectContext<FibState, FibInternalCommand>,
): Promise<EffectExecutionResult> {
  return handleFibGenerateWordEffect(effect, context);
}

function resolvePreparationFailureCode(reason: EffectTerminalReason): FibPreparationFailureCode {
  if (reason.kind === 'attemptsExhausted') return 'service-unavailable';
  if (reason.error instanceof FibWordCatalogExhaustedError) return reason.error.failureCode;
  if (reason.error instanceof z.ZodError) return 'catalog-invalid';
  return 'unexpected-error';
}

export async function handleFibTerminalEffect(
  effect: FibEffect,
  context: WorkerEffectContext<FibState, FibInternalCommand>,
  reason: EffectTerminalReason,
): Promise<void> {
  const commandId = await createEffectCommandId('fib:preparation-failed', context.effectId);
  const result = await context.dispatchInternal(commandId, {
    type: 'fib.round.failPreparation',
    roundId: effect.payload.roundId,
    failureCode: resolvePreparationFailureCode(reason),
  });
  if (result.commandId !== commandId) {
    throw new Error(
      `[FAIL-FAST] Fib preparation-failed receipt ${result.commandId} does not match ${commandId}`,
    );
  }
  if (result.kind === 'rejected') {
    if (isSupersededRoundRejection(result.reason)) return;
    throw new Error(`Fib preparation-failed command ${commandId} was rejected: ${result.reason}`);
  }
  if (result.outcome.kind !== 'success') {
    throw new Error(`Fib preparation-failed command ${commandId} failed: ${result.outcome.reason}`);
  }
}
