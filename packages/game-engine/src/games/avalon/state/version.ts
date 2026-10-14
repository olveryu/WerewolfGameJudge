/** Current persisted state identity for avalon.
 * v3: unified roster. v4: per-phase settle deadline (deadlineAt).
 * v5: independent viewing stage. v6: roundHistory per-round record. */

import { AVALON_GAME_TYPE } from './types';

export const AVALON_STATE_VERSION = 6;

export const AVALON_STATE_IDENTITY = {
  gameType: AVALON_GAME_TYPE,
  stateVersion: AVALON_STATE_VERSION,
} as const;
