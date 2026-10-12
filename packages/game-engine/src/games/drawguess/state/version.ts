/** Current persisted state identity for drawguess. */

import { DRAWGUESS_GAME_TYPE } from './types';

export const DRAWGUESS_STATE_VERSION = 2;

export const DRAWGUESS_STATE_IDENTITY = {
  gameType: DRAWGUESS_GAME_TYPE,
  stateVersion: DRAWGUESS_STATE_VERSION,
} as const;
