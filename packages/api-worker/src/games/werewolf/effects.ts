/**
 * Worker-side validation and execution for Werewolf domain effects:
 * game-ended growth settlement, MVP reward, and the scheduled deadline
 * settlement (`werewolf.settle.due`).
 */

import type {
  WerewolfDeadlinePhase,
  WerewolfEffect,
  WerewolfGameEndedEffect,
  WerewolfInternalCommand,
  WerewolfSettleDueEffect,
} from '@game-judge/game-engine/games/werewolf/public';
import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import {
  isValidRoleId,
  isValidSchemaId,
  readArmedDeadline,
  REASON_DEADLINE_NOT_REACHED,
  REASON_PHASE_NOT_EXPIRABLE,
  type RoleId,
} from '@game-judge/game-engine/games/werewolf/public';
import { z } from 'zod';

import {
  gameCompletionPayloadSchema,
  publishGameRewards,
} from '../../features/account/settleGameRewards';
import { dispatchEffectCommand } from '../../platform/gameModules/effectDispatch';
import { createSettleDueHandler } from '../../platform/gameModules/settleDue';
import type { WorkerEffectContext } from '../../platform/gameModules/workerModule';
import { settleGameResults } from './settlement/settleGameResults';

const roleIdSchema = z.custom<RoleId>(
  (value): value is RoleId => typeof value === 'string' && isValidRoleId(value),
);

const deadlinePhaseSchema = z.custom<WerewolfDeadlinePhase>(
  (value): value is WerewolfDeadlinePhase =>
    typeof value === 'string' &&
    (value === 'firstVote' || value === 'runoffVote' || isValidSchemaId(value)),
);

export const werewolfEffectSchema: z.ZodType<WerewolfEffect> = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('werewolf.game.ended'),
    payload: z.strictObject({
      roomCode: z.string().min(1),
      participants: z.array(z.strictObject({ userId: z.string().min(1), role: roleIdSchema })),
    }),
  }),
  z.strictObject({
    type: z.literal('werewolf.mvp.awarded'),
    payload: gameCompletionPayloadSchema.extend({ humanPlayerCount: z.number().int().min(6) }),
  }),
  z.strictObject({
    type: z.literal('werewolf.settle.due'),
    payload: z.strictObject({
      gameSequence: z.int().nonnegative(),
      phase: deadlinePhaseSchema,
      deadlineAt: z.int().nonnegative(),
    }),
  }),
]);

/**
 * A settle command rejected on the phase or deadline guard means the
 * arming it targeted is already gone (a client expire or an audio-ack
 * progression settled first, or the phase moved on): the delivery is
 * done, not failed.
 */
const SUPERSEDED_SETTLE_REASONS: readonly string[] = [
  REASON_PHASE_NOT_EXPIRABLE,
  REASON_DEADLINE_NOT_REACHED,
];

/**
 * Scheduled deadline settlement through the shared settle.due handler.
 * The staleness gate compares the pinned arming field by field (game
 * sequence, phase, deadline) against the deadline the state currently
 * carries: if the room has moved on (step advanced, round closed, vote
 * refreshed, new game), the delivery is a no-op.
 */
const handleWerewolfSettleDueEffect = createSettleDueHandler<
  GameState,
  WerewolfSettleDueEffect['payload'],
  WerewolfInternalCommand
>({
  namespace: 'werewolf:settle',
  label: 'Werewolf settle',
  command: { type: 'werewolf.phase.settleExpired' },
  supersededReasons: SUPERSEDED_SETTLE_REASONS,
  isCurrent: (state, payload) => {
    const armed = readArmedDeadline(state);
    return (
      armed !== null &&
      state.gameSequence === payload.gameSequence &&
      armed.phase === payload.phase &&
      armed.deadlineAt === payload.deadlineAt
    );
  },
});

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
  switch (effect.type) {
    case 'werewolf.mvp.awarded':
      await publishGameRewards({ ...effect.payload, kind: 'mvp', gameType: 'werewolf' }, context);
      return;
    case 'werewolf.settle.due':
      await handleWerewolfSettleDueEffect(effect, context);
      return;
    case 'werewolf.game.ended':
      await handleGameEnded(effect, context);
      return;
  }
}
