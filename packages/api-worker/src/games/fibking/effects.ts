/** Worker-side validation and execution for Fibking selection and usage effects. */

import {
  buildPreparationFailureCommand,
  FIB_PREPARATION_STAGES,
  FIB_USED_WORD_LIMIT,
  FIB_WORD_SOURCES,
  type FibEffect,
  type FibInternalCommand,
  type FibRecordWordUsageEffect,
  type FibSelectWordEffect,
  type FibState,
  REASON_FIB_ROUND_MISMATCH,
  REASON_FIB_ROUND_NOT_PREPARING,
} from '@game-judge/game-engine/games/fibking/public';
import { z } from 'zod';

import {
  gameCompletionPayloadSchema,
  publishGameRewards,
} from '../../features/account/settleGameRewards';
import { dispatchPreparationCommand } from '../../platform/gameModules/preparationDispatch';
import type { WorkerEffectContext } from '../../platform/gameModules/workerModule';
import { FibWordInventoryExhaustedError, getOrCreateFibWordSelection } from './wordSelection';
import { recordFibWordUsage } from './wordUsage';

const selectWordEffectSchema = z.strictObject({
  type: z.literal('fibking.word.select'),
  payload: z.strictObject({
    roundId: z.string().min(1),
    avoidWords: z.array(z.string().min(1)).max(FIB_USED_WORD_LIMIT).readonly(),
    participantUserIds: z.array(z.string().min(1)).min(1).readonly(),
  }),
}) satisfies z.ZodType<FibSelectWordEffect>;

const recordWordUsageEffectSchema = z.strictObject({
  type: z.literal('fibking.word.recordUsage'),
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
  z.strictObject({
    type: z.literal('fibking.game.completed'),
    payload: gameCompletionPayloadSchema,
  }),
]);

/** Rejections that mean the round moved on while the selection was in flight. */
const SUPERSEDED_ROUND_REASONS: readonly string[] = [
  REASON_FIB_ROUND_NOT_PREPARING,
  REASON_FIB_ROUND_MISMATCH,
];

async function dispatchPreparationStage(
  context: WorkerEffectContext<FibState, FibInternalCommand>,
  roundId: string,
  stage: (typeof FIB_PREPARATION_STAGES)['selecting' | 'finalizing'],
): Promise<boolean> {
  return dispatchPreparationCommand(
    context,
    { type: 'fibking.round.updatePreparationStage', roundId, stage },
    {
      namespace: `fib:preparation-stage-${stage}`,
      supersededReasons: SUPERSEDED_ROUND_REASONS,
      label: 'Fib preparation-stage',
    },
  );
}

/** Decide the domain terminal transition without I/O; the runtime commits it with the outbox. */
export function getFibEffectFailureCommand(
  effect: FibEffect,
  state: FibState,
): FibInternalCommand | null {
  return buildPreparationFailureCommand({
    isSelectionEffect: effect.type === 'fibking.word.select',
    effectRoundId: effect.payload.roundId,
    state: {
      phase: state.phase,
      pendingRound: state.phase === 'preparing' ? state.pendingRound : null,
    },
    buildFailCommand: (roundId, failureCode): FibInternalCommand => ({
      type: 'fibking.round.failPreparation',
      roundId,
      failureCode,
    }),
  });
}

async function dispatchRoundCompletion(
  context: WorkerEffectContext<FibState, FibInternalCommand>,
  effect: FibSelectWordEffect,
  selected: Awaited<ReturnType<typeof getOrCreateFibWordSelection>>,
): Promise<void> {
  await dispatchPreparationCommand(
    context,
    {
      type: 'fibking.round.complete',
      roundId: effect.payload.roundId,
      word: selected.word,
      definition: selected.definition,
      source: selected.source,
    },
    {
      namespace: 'fib:round-complete',
      supersededReasons: SUPERSEDED_ROUND_REASONS,
      label: 'Fib round-complete',
    },
  );
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

  let selected: Awaited<ReturnType<typeof getOrCreateFibWordSelection>>;
  try {
    selected = await getOrCreateFibWordSelection({
      db: context.bindings.DB,
      roomIdentity: context.roomIdentity,
      effectId: context.effectId,
      effect,
    });
  } catch (error) {
    if (!(error instanceof FibWordInventoryExhaustedError)) throw error;
    await dispatchPreparationCommand(
      context,
      {
        type: 'fibking.round.failPreparation',
        roundId: effect.payload.roundId,
        failureCode: 'inventoryExhausted',
      },
      {
        namespace: 'fib:inventory-exhausted',
        supersededReasons: SUPERSEDED_ROUND_REASONS,
        label: 'Fib exhaustion',
      },
    );
    return;
  }
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
    case 'fibking.word.select':
      await handleFibSelectWordEffect(effect, context);
      return;
    case 'fibking.word.recordUsage':
      await handleFibRecordWordUsageEffect(effect, context);
      return;
    case 'fibking.game.completed':
      await publishGameRewards(
        { ...effect.payload, kind: 'completion', gameType: 'fibking' },
        context,
      );
      return;
  }
}
