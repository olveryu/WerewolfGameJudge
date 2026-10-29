/** Schema-independent domain effects emitted by the Werewolf engine. */

import type { RoleId } from '../domain/models';

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

export type WerewolfEffect = WerewolfGameEndedEffect | WerewolfMvpEffect;
