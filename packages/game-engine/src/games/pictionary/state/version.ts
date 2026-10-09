/** Current persisted state identity for Pictionary. */

/**
 * v9 replaces realSeats plus the implicit-bot derivation inputs with the
 * unified roster (bot seats become explicit occupants). v8 payloads
 * migrate through migratePersistedPictionaryState.
 */

import { PICTIONARY_GAME_TYPE } from '../../../platform/protocol/gameTypes';

export const PICTIONARY_STATE_VERSION = 9;

export const PICTIONARY_STATE_IDENTITY = {
  gameType: PICTIONARY_GAME_TYPE,
  stateVersion: PICTIONARY_STATE_VERSION,
} as const;
