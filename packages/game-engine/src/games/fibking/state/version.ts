/** Current persisted state identity for FibKing. */

/**
 * v8 splits the viewing checkpoint from play: rounds gain the host's
 * guess record (guesses) and play opens only on fibking.round.begin.
 * v7 replaces realSeats plus the implicit-bot derivation inputs with the
 * unified roster (bot seats become explicit occupants).
 * v6 added the per-round role viewing record (Identity Viewing Protocol):
 * rounds gain viewedSeats and a 'viewing' phase gates each round start.
 * v5/v6/v7 payloads migrate through migratePersistedFibState.
 */

import { FIBKING_GAME_TYPE } from '../../../platform/protocol/gameTypes';

export const FIB_STATE_VERSION = 8;

export const FIB_STATE_IDENTITY = {
  gameType: FIBKING_GAME_TYPE,
  stateVersion: FIB_STATE_VERSION,
} as const;
