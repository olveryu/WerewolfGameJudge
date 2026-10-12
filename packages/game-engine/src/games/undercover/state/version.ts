/** Current persisted state identity for undercover. */

import { UNDERCOVER_GAME_TYPE } from '../../../platform/protocol/gameTypes';

export const UNDERCOVER_STATE_VERSION = 4;

export const UNDERCOVER_STATE_IDENTITY = {
  gameType: UNDERCOVER_GAME_TYPE,
  stateVersion: UNDERCOVER_STATE_VERSION,
} as const;
