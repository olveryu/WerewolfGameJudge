/** v8 persists the latest public result in chronological order. */

import { SECRETHITLER_GAME_TYPE } from './types';

export const SECRETHITLER_STATE_VERSION = 8;

export const SECRETHITLER_STATE_IDENTITY = {
  gameType: SECRETHITLER_GAME_TYPE,
  stateVersion: SECRETHITLER_STATE_VERSION,
} as const;
