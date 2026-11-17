/** v2 adds authoritative shared success pauses and per-seat mistake feedback. */

import { SPOTMATCH_GAME_TYPE } from './types';

export const SPOTMATCH_STATE_VERSION = 2;

export const SPOTMATCH_STATE_IDENTITY = {
  gameType: SPOTMATCH_GAME_TYPE,
  stateVersion: SPOTMATCH_STATE_VERSION,
} as const;
