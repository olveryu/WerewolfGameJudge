/** Worker-side validation and execution for Fibking selection and usage effects. */

import {
  FIB_PREPARATION_STAGES,
  FIB_USED_WORD_LIMIT,
  FIB_WORD_SOURCES,
  type FibEffect,
  type FibInternalCommand,
  type FibPreparationFailureCode,
  type FibRecordWordUsageEffect,
  type FibSelectWordEffect,
  type FibState,
  REASON_FIB_ROUND_MISMATCH,
  REASON_FIB_ROUND_NOT_PREPARING,
} from '@game-judge/game-engine/games/fibking/public';
import { z } from 'zod';

import { createEffectCommandId } from '../../platform/gameModules/effectCommandId';
import type { WorkerEffectContext } from '../../platform/gameModules/workerModule';
import { createLogger } from '../../platform/observability/logger';
import { OUTBOX_MAX_ATTEMPTS } from '../../platform/room/effectOutbox';
import { getFibWordHistoryUserIds } from './wordHistory';
import { getOrCreateFibWordSelection } from './wordSelection';
import { recordFibWordUsage } from './wordUsage';

const log = createLogger('fib-word-selection');

const selectWordEffectSchema = z.strictObject({
  type: z.literal('fib.word.select'),
  payload: z.strictObject({
    roundId: z.string().min(1),
    avoidWords: z.array(z.string().min(1)).max(FIB_USED_WORD_LIMIT).readonly(),
  }),
}) satisfies z.ZodType<FibSelectWordEffect>;

const recordWordUsageEffectSchema = z.strictObject({
  type: z.literal('fib.word.recordUsage'),
  payload: z.strictObject({
    roundId: z.string().min(1),
    word: z.string().min(1),
    source: z.enum(FIB_WORD_SOURCES),
    usedAt: z.number().int().nonnegative(),
    participantUserIds: z.array(z.string().min(1)).min(1).readonly(),
  }),
}) satisfies z.ZodType<FibRecordWordUsageEffect>;

export const fibEffectSchema: z.ZodType<FibEffect> = z.discriminatedUnion('type', [
  selectWordEffectSchema,
  recordWordUsageEffectSchema,
]);

function isSupersededRoundRejection(reason: string): boolean {
  return reason === REASON_FIB_ROUND_NOT_PREPARING || reason === REASON_FIB_ROUND_MISMATCH;
}

async function dispatchPreparationStage(
  context: WorkerEffectContext<FibState, FibInternalCommand>,
  roundId: string,
  stage: (typeof FIB_PREPARATION_STAGES)['selecting' | 'finalizing'],
): Promise<boolean> {
  const commandId = await createEffectCommandId(`fib:preparation-stage-${stage}`, context.effectId);
  const result = await context.dispatchInternal(commandId, {
    type: 'fib.round.updatePreparationStage',
    roundId,
    stage,
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

async function dispatchPreparationFailure(
  context: WorkerEffectContext<FibState, FibInternalCommand>,
  roundId: string,
  failureCode: FibPreparationFailureCode,
): Promise<void> {
  const commandId = await createEffectCommandId(
    `fib:preparation-failed-${failureCode}`,
    context.effectId,
  );
  const result = await context.dispatchInternal(commandId, {
    type: 'fib.round.failPreparation',
    roundId,
    failureCode,
  });
  if (result.commandId !== commandId) {
    throw new Error(
      `[FAIL-FAST] Fib preparation-failure receipt ${result.commandId} does not match ${commandId}`,
    );
  }
  if (result.kind === 'rejected') {
    if (isSupersededRoundRejection(result.reason)) return;
    throw new Error(`Fib preparation-failure command ${commandId} was rejected: ${result.reason}`);
  }
  if (result.outcome.kind !== 'success') {
    throw new Error(
      `Fib preparation-failure command ${commandId} failed: ${result.outcome.reason}`,
    );
  }
}

async function dispatchRoundCompletion(
  context: WorkerEffectContext<FibState, FibInternalCommand>,
  effect: FibSelectWordEffect,
  selected: Awaited<ReturnType<typeof getOrCreateFibWordSelection>>,
): Promise<void> {
  const commandId = await createEffectCommandId('fib:round-complete', context.effectId);
  const result = await context.dispatchInternal(commandId, {
    type: 'fib.round.complete',
    roundId: effect.payload.roundId,
    word: selected.word,
    definition: selected.definition,
    source: selected.source,
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

async function handleFibSelectWordEffect(
  effect: FibSelectWordEffect,
  context: WorkerEffectContext<FibState, FibInternalCommand>,
): Promise<void> {
  if (
    context.state.phase !== 'preparing' ||
    context.state.pendingRound.roundId !== effect.payload.roundId
  ) {
    return;
  }
  if (
    !(await dispatchPreparationStage(
      context,
      effect.payload.roundId,
      FIB_PREPARATION_STAGES.selecting,
    ))
  ) {
    return;
  }

  try {
    const selected = await getOrCreateFibWordSelection({
      db: context.bindings.DB,
      roomIdentity: context.roomIdentity,
      effectId: context.effectId,
      effect,
      participantUserIds: getFibWordHistoryUserIds(context.state),
    });
    if (
      !(await dispatchPreparationStage(
        context,
        effect.payload.roundId,
        FIB_PREPARATION_STAGES.finalizing,
      ))
    ) {
      return;
    }
    await dispatchRoundCompletion(context, effect, selected);
  } catch (error) {
    if (context.deliveryAttemptCount < OUTBOX_MAX_ATTEMPTS) throw error;
    log.error('Fib word selection failed', {
      error,
      roomId: context.roomIdentity.roomId,
      effectId: context.effectId,
      roundId: effect.payload.roundId,
    });
    await dispatchPreparationFailure(context, effect.payload.roundId, 'selectionFailed');
  }
}

async function handleFibRecordWordUsageEffect(
  effect: FibRecordWordUsageEffect,
  context: WorkerEffectContext<FibState, FibInternalCommand>,
): Promise<void> {
  await recordFibWordUsage({
    db: context.bindings.DB,
    roomIdentity: context.roomIdentity,
    effect,
  });
}

/** Deliver one validated Fibking effect through the Worker runtime. */
export async function handleFibEffect(
  effect: FibEffect,
  context: WorkerEffectContext<FibState, FibInternalCommand>,
): Promise<void> {
  switch (effect.type) {
    case 'fib.word.select':
      await handleFibSelectWordEffect(effect, context);
      return;
    case 'fib.word.recordUsage':
      await handleFibRecordWordUsageEffect(effect, context);
      return;
  }
}
