/** Current persisted state identity for secrethitler. v1: elections, policies and presidential powers. */

import { SECRETHITLER_GAME_TYPE } from './types';

export const SECRETHITLER_STATE_VERSION = 1;

export const SECRETHITLER_STATE_IDENTITY = {
  gameType: SECRETHITLER_GAME_TYPE,
  stateVersion: SECRETHITLER_STATE_VERSION,
} as const;
