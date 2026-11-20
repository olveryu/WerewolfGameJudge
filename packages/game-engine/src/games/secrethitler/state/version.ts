/** v3 adds public/secret election visibility; v4 records terminal review completion. */

import { SECRETHITLER_GAME_TYPE } from './types';

export const SECRETHITLER_STATE_VERSION = 4;

export const SECRETHITLER_STATE_IDENTITY = {
  gameType: SECRETHITLER_GAME_TYPE,
  stateVersion: SECRETHITLER_STATE_VERSION,
} as const;
