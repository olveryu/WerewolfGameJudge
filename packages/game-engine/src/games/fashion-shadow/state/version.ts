// Current persisted state identity for Fashion Shadow.

import { FASHION_SHADOW_GAME_TYPE } from '../../../platform/protocol/gameTypes';

export const FASHION_STATE_VERSION = 1;
export const FASHION_STATE_IDENTITY = {
  gameType: FASHION_SHADOW_GAME_TYPE,
  stateVersion: FASHION_STATE_VERSION,
} as const;
