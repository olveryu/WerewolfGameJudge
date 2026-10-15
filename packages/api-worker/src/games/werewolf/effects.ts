/** Worker-side validation and execution for Werewolf domain effects. */

import type {
  WerewolfEffect,
  WerewolfGameEndedEffect,
  WerewolfInternalCommand,
} from '@game-judge/game-engine/games/werewolf/public';
import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { isValidRoleId, type RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { z } from 'zod';

import {
  gameCompletionPayloadSchema,
  publishGameRewards,
} from '../../features/account/settleGameRewards';
import { dispatchEffectCommand } from '../../platform/gameModules/effectDispatch';
import type { WorkerEffectContext } from '../../platform/gameModules/workerModule';
import { settleGameResults } from './settlement/settleGameResults';

const roleIdSchema = z.custom<RoleId>(
  (value): value is RoleId => typeof value === 'string' && isValidRoleId(value),
);

export const werewolfEffectSchema: z.ZodType<WerewolfEffect> = z.discriminatedUnion('type', [
  z.strictObject({
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
  }),
  z.strictObject({
    type: z.literal('werewolf.mvp.awarded'),
    payload: gameCompletionPayloadSchema.extend({ humanPlayerCount: z.number().int().min(6) }),
  }),
]);

/**
 * Applying roster levels is never superseded: the roster state it
 * targets cannot move on underneath the delivery, so every rejection
 * is a real failure.
 */
const SUPERSEDED_ROSTER_REASONS: readonly string[] = [];

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
  await dispatchEffectCommand(
    context,
    {
      type: 'werewolf.growth.applyRosterLevels',
      levels,
    },
    {
      namespace: 'werewolf:growth',
      supersededReasons: SUPERSEDED_ROSTER_REASONS,
      label: 'Roster-level',
    },
  );

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
): Promise<void> {
  if (effect.type === 'werewolf.mvp.awarded') {
    await publishGameRewards({ ...effect.payload, kind: 'mvp', gameType: 'werewolf' }, context);
  } else {
    await handleGameEnded(effect, context);
  }
}
