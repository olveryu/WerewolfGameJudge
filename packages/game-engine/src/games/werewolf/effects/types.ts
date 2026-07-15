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

export type WerewolfEffect = WerewolfGameEndedEffect;
