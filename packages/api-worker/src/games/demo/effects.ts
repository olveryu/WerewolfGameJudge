/** Worker-side execution for Demo effects: game-completed growth settlement and scheduled stage-deadline settlement. */

import {
  DEMO_REASONS,
  type DemoEffect,
  type DemoInternalCommand,
  type DemoState,
} from '@game-judge/game-engine/games/demo/public';
import { z } from 'zod';

import {
  gameCompletionPayloadSchema,
  publishGameRewards,
} from '../../features/account/settleGameRewards';
import { createEffectCommandId } from '../../platform/gameModules/effectCommandId';
import type { WorkerEffectContext } from '../../platform/gameModules/workerModule';

const gameCompletedEffectSchema = z.strictObject({
  type: z.literal('demo.game.completed'),
  payload: gameCompletionPayloadSchema,
});

const settleDueEffectSchema = z.strictObject({
  type: z.literal('demo.settle.due'),
  payload: z.strictObject({
    gameSequence: z.int().nonnegative(),
    deadlineAt: z.int().nonnegative(),
  }),
});

export const demoEffectSchema: z.ZodType<DemoEffect> = z.union([
  gameCompletedEffectSchema,
  settleDueEffectSchema,
]);

type DemoSettleDueEffect = Extract<DemoEffect, { type: 'demo.settle.due' }>;

/**
 * A settle command rejected on the phase or deadline guard means the
 * arming it targeted is already gone (the phase moved on): the
 * delivery is done, not failed.
 */
function isSupersededSettleRejection(reason: string): boolean {
  return reason === DEMO_REASONS.phase || reason === DEMO_REASONS.deadline;
}

async function handleDemoSettleDueEffect(
  effect: DemoSettleDueEffect,
  context: WorkerEffectContext<DemoState, DemoInternalCommand>,
): Promise<void> {
  const state = context.state;
  const phase = state.phase;
  // Staleness gate: the payload pins one exact arming. If the room has
  // moved on (already settled, new game), this delivery is a no-op —
  // never settle whatever stage happens to be current.
  if (
    state.gameSequence !== effect.payload.gameSequence ||
    phase.kind !== 'playing' ||
    phase.deadlineAt !== effect.payload.deadlineAt
  ) {
    return;
  }
  const commandId = await createEffectCommandId('demo:settle', context.effectId);
  const result = await context.dispatchInternal(commandId, {
    type: 'demo.phase.settleExpired',
  });
  if (result.commandId !== commandId) {
    throw new Error(
      `[FAIL-FAST] Demo settle receipt ${result.commandId} does not match ${commandId}`,
    );
  }
  if (result.kind === 'rejected') {
    if (isSupersededSettleRejection(result.reason)) return;
    throw new Error(`Demo settle command ${commandId} was rejected: ${result.reason}`);
  }
  if (result.outcome.kind !== 'success') {
    throw new Error(`Demo settle command ${commandId} failed: ${result.outcome.reason}`);
  }
}

/**
 * Deliver one validated Demo effect. Exactly-once for the
 * completion effect is enforced in three layers: the engine emits it
 * at most once per game (xpSettled), the effect outbox dedupes on the
 * business key, and settleGameRewards is idempotent on the settlement
 * id. The settle effect is exactly-once by construction: the engine
 * arms it once per game, the outbox dedupes on the arming identity,
 * and delivery no-ops unless the pinned arming is still current.
 */
export async function handleDemoEffect(
  effect: DemoEffect,
  context: WorkerEffectContext<DemoState, DemoInternalCommand>,
): Promise<void> {
  switch (effect.type) {
    case 'demo.game.completed':
      await publishGameRewards(
        { ...effect.payload, kind: 'completion', gameType: 'demo' },
        context,
      );
      return;
    case 'demo.settle.due':
      await handleDemoSettleDueEffect(effect, context);
      return;
  }
}
