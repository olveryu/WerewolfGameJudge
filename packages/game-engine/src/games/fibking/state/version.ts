/** Current persisted state identity for FibKing. */

import { FIBKING_GAME_TYPE } from '../../../platform/protocol/gameTypes';

export const FIB_STATE_VERSION = 4;

export const FIB_STATE_IDENTITY = {
  gameType: FIBKING_GAME_TYPE,
  stateVersion: FIB_STATE_VERSION,
} as const;
