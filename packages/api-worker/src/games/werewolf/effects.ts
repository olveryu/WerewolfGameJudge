/** Worker-side validation and execution for Werewolf domain effects. */

import type {
  WerewolfEffect,
  WerewolfGameEndedEffect,
  WerewolfInternalCommand,
} from '@werewolf/game-engine/games/werewolf/public';
import { isValidRoleId, type RoleId } from '@werewolf/game-engine/models/roles';
import { z } from 'zod';

import { settleGameResults } from '../../growth/settleGameResults';
import type { WorkerEffectContext } from '../workerModule';

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

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function createApplyRosterCommandId(effectId: string): Promise<string> {
  return `werewolf:growth:${await sha256Hex(effectId)}`;
}

async function handleGameEnded(
  effect: WerewolfGameEndedEffect,
  context: WorkerEffectContext<WerewolfInternalCommand>,
): Promise<void> {
  if (effect.payload.roomCode !== context.roomCode) {
    throw new Error(
      `[FAIL-FAST] Werewolf game-ended effect room ${effect.payload.roomCode} does not match ${context.roomCode}`,
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
    context.sendToUser(result.userId, {
      type: 'SETTLE_RESULT',
      gameType: 'werewolf',
      settlementId: context.effectId,
      endedRevision: context.revision,
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
  context: WorkerEffectContext<WerewolfInternalCommand>,
): Promise<void> {
  await handleGameEnded(effect, context);
}
