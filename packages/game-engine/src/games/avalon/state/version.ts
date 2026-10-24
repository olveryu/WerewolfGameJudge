/** Current persisted state identity for avalon.
 * v3: unified roster. v4: per-phase settle deadline (deadlineAt).
 * v5: independent viewing stage. v6: roundHistory per-round record.
 * v7: ladyHistory per completed lady check (public holder/target only). */

import { AVALON_GAME_TYPE } from './types';

export const AVALON_STATE_VERSION = 7;

export const AVALON_STATE_IDENTITY = {
  gameType: AVALON_GAME_TYPE,
  stateVersion: AVALON_STATE_VERSION,
} as const;
