/** Current persisted state identity for avalon. */

import { AVALON_GAME_TYPE } from './types';

export const AVALON_STATE_VERSION = 5;

export const AVALON_STATE_IDENTITY = {
  gameType: AVALON_GAME_TYPE,
  stateVersion: AVALON_STATE_VERSION,
} as const;
