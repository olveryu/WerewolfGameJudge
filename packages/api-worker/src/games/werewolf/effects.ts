/** Worker-side validation and execution for Werewolf domain effects. */

import type {
  WerewolfEffect,
  WerewolfGameEndedEffect,
  WerewolfInternalCommand,
} from '@game-judge/game-engine/games/werewolf/public';
import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { isValidRoleId, type RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { z } from 'zod';

import { createEffectCommandId } from '../../platform/gameModules/effectCommandId';
import type { EffectExecutionResult } from '../../platform/gameModules/runtimeGameModule';
import type { WorkerEffectContext } from '../../platform/gameModules/workerModule';
import { settleGameResults } from './settlement/settleGameResults';

const roleIdSchema = z.custom<RoleId>(
  (value): value is RoleId => typeof value === 'string' && isValidRoleId(value),
);

export const werewolfEffectSchema: z.ZodType<WerewolfEffect> = z.strictObject({
  type: z.literal('werewolf.game.ended'),
  payload: z.strictObject({
    roomCode: z.string().min(1),
    participants: z
      .array(
        z.strictObject({
          userId: z.string().min(1),
          role: roleIdSchema,
          isBot: z.boolean(),
        }),
      )
      .min(1),
  }),
});

async function createApplyRosterCommandId(effectId: string): Promise<string> {
  return createEffectCommandId('werewolf:growth', effectId);
}

async function handleGameEnded(
  effect: WerewolfGameEndedEffect,
  context: WorkerEffectContext<GameState, WerewolfInternalCommand>,
): Promise<void> {
  if (effect.payload.roomCode !== context.roomIdentity.roomCode) {
    throw new Error(
      `[FAIL-FAST] Werewolf game-ended effect room ${effect.payload.roomCode} does not match ${context.roomIdentity.roomCode}`,
    );
  }

  const results = await settleGameResults(context.effectId, effect, context.bindings);
  if (results.length === 0) return;

  const levels = Object.fromEntries(results.map((result) => [result.userId, result.newLevel]));
  const commandId = await createApplyRosterCommandId(context.effectId);
  const dispatchResult = await context.dispatchInternal(commandId, {
    type: 'werewolf.growth.applyRosterLevels',
    levels,
  });
  if (dispatchResult.commandId !== commandId) {
    throw new Error(
      `[FAIL-FAST] Roster-level command receipt ${dispatchResult.commandId} does not match ${commandId}`,
    );
  }
  if (dispatchResult.kind !== 'committed') {
    throw new Error(`Roster-level command ${commandId} was rejected: ${dispatchResult.reason}`);
  }
  if (dispatchResult.outcome.kind !== 'success') {
    throw new Error(`Roster-level command ${commandId} failed: ${dispatchResult.outcome.reason}`);
  }

  for (const result of results) {
    const eventId = `${context.effectId}:${result.userId}`;
    await context.publishUserEvent(result.userId, eventId, {
      type: 'SETTLE_RESULT',
      eventId,
      gameType: 'werewolf',
      settlementId: context.effectId,
      endedRevision: context.createdRevision,
      xpEarned: result.xpEarned,
      newXp: result.newXp,
      newLevel: result.newLevel,
      previousLevel: result.previousLevel,
      normalDrawsEarned: result.normalDrawsEarned,
      goldenDrawsEarned: result.goldenDrawsEarned,
    });
  }
}

export async function handleWerewolfEffect(
  effect: WerewolfEffect,
  context: WorkerEffectContext<GameState, WerewolfInternalCommand>,
): Promise<EffectExecutionResult> {
  try {
    await handleGameEnded(effect, context);
    return { kind: 'success' };
  } catch (error) {
    return {
      kind: 'terminal',
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
