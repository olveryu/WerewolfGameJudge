/** Current persisted state identity for demo. v1: initial skeleton state. */

import { DEMO_GAME_TYPE } from './types';

export const DEMO_STATE_VERSION = 1;

export const DEMO_STATE_IDENTITY = {
  gameType: DEMO_GAME_TYPE,
  stateVersion: DEMO_STATE_VERSION,
} as const;
