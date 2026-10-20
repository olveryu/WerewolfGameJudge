/** Current persisted state version for the Werewolf engine. */

/**
 * v6 splits the player record: seat occupancy moves to the unified
 * roster (humans carry userId, bots are explicit bot occupants), the
 * players record keeps only per-seat game data (role / hasViewedRole),
 * and the by-user display map is renamed roster -> playerProfiles.
 * v7 drops the debugMode record (the flag is deleted; bot gates key
 * off roster bot seats). v6 payloads migrate by dropping the field.
 * v5 payloads migrated through migratePersistedWerewolfState.
 * v8 kept the v7 shape and canonicalized the night-step window values
 * (currentStepIndex / currentStepId / stepDeadline) on load.
 * v9 collapses the step window into the `nightStep` discriminated union
 * (inStep {stepId, stepDeadline?} | exhausted | null); the step index is
 * derived from the plan, never stored. v8 payloads migrated into it
 * through the upgrade chain v10 deleted.
 * v10 embeds the display profile in the roster human occupant
 * (profile: RoomSeatProfile) and deletes the by-user playerProfiles
 * map. Hard cut: v9-and-older payloads are rejected, not migrated —
 * the v5-v9 upgrade chain is deleted with this version.
 */

import { WEREWOLF_GAME_TYPE } from '../../../platform/protocol/gameTypes';

export const WEREWOLF_STATE_VERSION = 10;

export const WEREWOLF_STATE_IDENTITY = {
  gameType: WEREWOLF_GAME_TYPE,
  stateVersion: WEREWOLF_STATE_VERSION,
} as const;
