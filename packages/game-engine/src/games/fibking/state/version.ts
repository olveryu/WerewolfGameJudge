/** Current persisted state identity for FibKing. */

/**
 * v6 adds the per-round role viewing record (Identity Viewing Protocol):
 * rounds gain viewedSeats and a 'viewing' phase gates each round start.
 * v5 payloads migrate through migratePersistedFibState.
 */

import { FIBKING_GAME_TYPE } from '../../../platform/protocol/gameTypes';

export const FIB_STATE_VERSION = 6;

export const FIB_STATE_IDENTITY = {
  gameType: FIBKING_GAME_TYPE,
  stateVersion: FIB_STATE_VERSION,
} as const;
