/** Current persisted state version for the Werewolf engine. */

/**
 * v6 splits the player record: seat occupancy moves to the unified
 * roster (humans carry userId, bots are explicit bot occupants), the
 * players record keeps only per-seat game data (role / hasViewedRole),
 * and the by-user display map is renamed roster -> playerProfiles.
 * v5 payloads migrate through migratePersistedWerewolfState.
 */

import { WEREWOLF_GAME_TYPE } from '../../../platform/protocol/gameTypes';

export const WEREWOLF_STATE_VERSION = 6;

export const WEREWOLF_STATE_IDENTITY = {
  gameType: WEREWOLF_GAME_TYPE,
  stateVersion: WEREWOLF_STATE_VERSION,
} as const;
