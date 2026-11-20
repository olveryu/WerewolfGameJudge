/** v7 persists the public chancellor preselection. */

import { SECRETHITLER_GAME_TYPE } from './types';

export const SECRETHITLER_STATE_VERSION = 7;

export const SECRETHITLER_STATE_IDENTITY = {
  gameType: SECRETHITLER_GAME_TYPE,
  stateVersion: SECRETHITLER_STATE_VERSION,
} as const;
