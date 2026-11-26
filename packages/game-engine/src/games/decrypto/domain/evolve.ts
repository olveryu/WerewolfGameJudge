/** Applies committed Decrypto events; room reset preserves seats and settings. */

import { applyRosterChanges } from '../../../platform/room/seating';
import type { DecryptoState } from '../state/types';
import type { DecryptoEvent } from './decision';

function resetDecryptoGame(state: DecryptoState): DecryptoState {
  return {
    ...state,
    phase: { kind: 'lobby' },
    phaseRevision: state.phaseRevision + 1,
    xpSettled: false,
  };
}

/** Evolves one committed domain event without persistence or broadcasts. */
export function evolveDecryptoState(state: DecryptoState, event: DecryptoEvent): DecryptoState {
  const bumped = { ...state, phaseRevision: state.phaseRevision + 1 };
  switch (event.type) {
    case 'decrypto.seats.changed':
      return { ...bumped, roster: applyRosterChanges(state.roster, event.changes) };
    case 'decrypto.config.updated':
      return { ...bumped, config: event.config };
    case 'decrypto.teams.started':
      return {
        ...bumped,
        phase: { kind: 'teams', assignments: event.assignments, encryptors: event.encryptors },
        gameSequence: event.gameSequence,
        xpSettled: false,
      };
    case 'decrypto.teams.updated':
      if (state.phase.kind !== 'teams') throw new Error('Cannot update teams outside team setup');
      return {
        ...bumped,
        phase: { kind: 'teams', assignments: event.assignments, encryptors: event.encryptors },
      };
    case 'decrypto.preparation.started':
      return {
        ...bumped,
        phase: {
          kind: 'preparing',
          assignments: event.assignments,
          encryptors: event.encryptors,
          requestId: event.requestId,
        },
      };
    case 'decrypto.play.started':
    case 'decrypto.game.updated':
      return { ...bumped, phase: { kind: 'playing', game: event.game } };
    case 'decrypto.game.ended':
      return { ...bumped, phase: { kind: 'ended', game: event.game }, xpSettled: true };
    case 'decrypto.game.returnedToLobby':
      return resetDecryptoGame(state);
  }
}
