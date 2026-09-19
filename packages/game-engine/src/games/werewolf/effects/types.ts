/** Schema-independent domain effects emitted by the Werewolf engine. */

import type { RoleId } from '../domain/models';

export interface WerewolfGameEndedParticipant {
  readonly userId: string;
  readonly role: RoleId;
  readonly isBot: boolean;
}

export interface WerewolfGameEndedEffect {
  readonly type: 'werewolf.game.ended';
  readonly payload: {
    readonly roomCode: string;
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
