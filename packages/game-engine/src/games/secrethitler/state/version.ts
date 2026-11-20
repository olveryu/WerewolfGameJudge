/** v6 persists the voting countdown. */

import { SECRETHITLER_GAME_TYPE } from './types';

export const SECRETHITLER_STATE_VERSION = 6;

export const SECRETHITLER_STATE_IDENTITY = {
  gameType: SECRETHITLER_GAME_TYPE,
  stateVersion: SECRETHITLER_STATE_VERSION,
} as const;
