/** Build the settlement trigger from an authoritative ended Werewolf state. */

import { isBotOccupant } from '../../../platform/room/seating';
import type { GameState } from '../domain/protocol/types';
import type { WerewolfGameEndedEffect, WerewolfGameEndedParticipant } from './types';

export function createWerewolfGameEndedEffect(state: GameState): WerewolfGameEndedEffect {
  const participants: WerewolfGameEndedParticipant[] = [];

  for (const player of Object.values(state.players)) {
    if (player === null) continue;
    if (player.role === undefined || player.role === null) {
      throw new Error(
        `[FAIL-FAST] Ended Werewolf game has no assigned role for occupied seat ${player.seat}`,
      );
    }
    const occupant = state.roster[player.seat];
    if (occupant == null) {
      throw new Error(
        `[FAIL-FAST] Ended Werewolf game has no roster occupant for seat ${player.seat}`,
      );
    }
    participants.push({
      userId: isBotOccupant(occupant) ? `bot-${player.seat}` : occupant.userId,
      role: player.role,
      isBot: isBotOccupant(occupant),
    });
  }

  return {
    type: 'werewolf.game.ended',
    payload: { roomCode: state.roomCode, participants },
  };
}
