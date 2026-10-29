/** Schema-independent domain effects emitted by the Werewolf engine. */

import type { RoleId } from '../domain/models';
import type { SchemaId } from '../domain/models/roles/spec/schemas';

/**
 * The phase an armed deadline belongs to: a night step id while the
 * night step's `stepDeadline` is armed, or a sheriff voting round
 * while the election's settle `deadline` is armed.
 */
export type WerewolfDeadlinePhase = SchemaId | 'firstVote' | 'runoffVote';

/**
 * Scheduled settlement of one armed deadline. The payload pins the
 * exact arming (game, phase, deadline); the Worker parks the effect
 * until `deadlineAt` and dispatches `werewolf.phase.settleExpired`
 * only if the pinned arming is still the room's current one.
 */
export interface WerewolfSettleDueEffect {
  readonly type: 'werewolf.settle.due';
  readonly payload: {
    readonly gameSequence: number;
    readonly phase: WerewolfDeadlinePhase;
    readonly deadlineAt: number;
  };
}

/** A human player in the ended game. Bots have no user id and nothing to settle, so they are not participants. */
export interface WerewolfGameEndedParticipant {
  readonly userId: string;
  readonly role: RoleId;
}

export interface WerewolfGameEndedEffect {
  readonly type: 'werewolf.game.ended';
  readonly payload: {
    readonly roomCode: string;
    /** Human participants only; may be empty for an all-bot room. */
    readonly participants: readonly WerewolfGameEndedParticipant[];
  };
}

export interface WerewolfMvpEffect {
  readonly type: 'werewolf.mvp.awarded';
  readonly payload: {
    readonly roundId: string;
    readonly completedAt: number;
    readonly participantUserIds: readonly string[];
    readonly humanPlayerCount: number;
  };
}

export type WerewolfEffect = WerewolfGameEndedEffect | WerewolfMvpEffect | WerewolfSettleDueEffect;
