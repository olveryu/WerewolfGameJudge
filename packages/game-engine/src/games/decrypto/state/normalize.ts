/** Decrypto semantic invariants; invalid persisted or evolved states fail explicitly. */

import {
  assertStateIdentity,
  createStateInvariant,
  type StateInvariant,
} from '../../../platform/protocol/stateInvariant';
import { isBotOccupant } from '../../../platform/room/seating';
import {
  DECRYPTO_MAX_ROUNDS,
  DECRYPTO_TEAMS,
  type DecryptoAssignments,
  type DecryptoEncryptors,
  type DecryptoGame,
  type DecryptoHumanSeat,
  type DecryptoState,
  type DecryptoTeam,
  isValidDecryptoConfig,
} from './types';

const invariant: StateInvariant = createStateInvariant('Decrypto');

function validateTeams(
  assignments: DecryptoAssignments,
  encryptors: DecryptoEncryptors | Readonly<Record<DecryptoTeam, number | null>>,
  state: DecryptoState,
): void {
  const seats = Object.keys(assignments).map(Number);
  invariant(
    seats.length === state.config.numberOfPlayers &&
      seats.every(
        (seat) => Number.isSafeInteger(seat) && seat >= 0 && seat < state.config.numberOfPlayers,
      ),
    'team assignments cover configured seats',
  );
  for (const team of DECRYPTO_TEAMS) {
    const members = seats.filter((seat) => assignments[seat] === team);
    invariant(members.length >= 2, `${team} team has enough members`);
    const encryptor = encryptors[team];
    invariant(
      encryptor === null || (encryptor !== undefined && assignments[encryptor] === team),
      `${team} encryptor belongs to team`,
    );
  }
}

function validateGame(game: DecryptoGame, state: DecryptoState): void {
  validateTeams(game.assignments, game.encryptors ?? { blue: null, purple: null }, state);
  invariant(
    Number.isSafeInteger(game.round) && game.round >= 1 && game.round <= DECRYPTO_MAX_ROUNDS,
    'round',
  );
  invariant(game.interceptions.blue >= 0 && game.interceptions.purple >= 0, 'interception marks');
  invariant(
    game.miscommunications.blue >= 0 && game.miscommunications.purple >= 0,
    'miscommunication marks',
  );
  invariant(
    game.revealIndex >= 0 && game.revealIndex <= game.revealSequence.length,
    'reveal index',
  );
  invariant(game.revealAt === null || game.revealAt >= 0, 'reveal deadline');
  if (game.keywords !== null) {
    const words = [...game.keywords.blue, ...game.keywords.purple];
    invariant(
      words.every((word) => word.trim().length > 0),
      'non-empty keywords',
    );
    invariant(new Set(words).size === words.length, 'unique keywords');
  }
  for (const team of DECRYPTO_TEAMS) {
    const code = game.codes[team];
    invariant(code.length === 3 && code.every((value) => value >= 1 && value <= 4), `${team} code`);
    const clues = game.clues[team];
    invariant(
      clues === null || (clues.length === 3 && clues.every((clue) => clue.trim().length > 0)),
      `${team} clues`,
    );
  }
}

/** Validates authoritative state without repairing or dropping submitted content. */
export function normalizeDecryptoState(state: DecryptoState): DecryptoState {
  assertStateIdentity(state, 'decrypto', 'Decrypto');
  invariant(isValidDecryptoConfig(state.config), 'configuration');
  const count = state.config.numberOfPlayers;
  const isSeat = (seat: number) => Number.isSafeInteger(seat) && seat >= 0 && seat < count;
  invariant(
    Number.isSafeInteger(state.phaseRevision) && state.phaseRevision >= 0,
    'phase revision',
  );
  invariant(Number.isSafeInteger(state.gameSequence) && state.gameSequence >= 0, 'game sequence');
  invariant(typeof state.xpSettled === 'boolean', 'xp settled flag');
  const entries = Object.entries(state.roster);
  invariant(
    entries.every(
      ([seat, occupant]) =>
        occupant != null &&
        isSeat(Number(seat)) &&
        occupant.seat === Number(seat) &&
        (isBotOccupant(occupant) || occupant.profile.displayName.trim().length > 0),
    ),
    'roster seats',
  );
  const users = entries.filter(
    (entry): entry is [string, DecryptoHumanSeat] => entry[1] != null && !isBotOccupant(entry[1]),
  );
  invariant(
    new Set(users.map(([, occupant]) => occupant.userId)).size === users.length,
    'duplicate user',
  );
  if (state.phase.kind === 'teams')
    validateTeams(state.phase.assignments, state.phase.encryptors, state);
  if (state.phase.kind === 'preparing')
    validateTeams(state.phase.assignments, state.phase.encryptors, state);
  if (state.phase.kind === 'playing' || state.phase.kind === 'ended')
    validateGame(state.phase.game, state);
  if (state.phase.kind === 'ended') {
    invariant(state.xpSettled, 'ended settles exactly once');
    invariant(state.phase.game.outcome !== null, 'ended outcome');
  }
  return state;
}
