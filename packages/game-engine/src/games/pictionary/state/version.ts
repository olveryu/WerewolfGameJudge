/** Current persisted state identity for Pictionary. */

import { PICTIONARY_GAME_TYPE } from '../../../platform/protocol/gameTypes';

export const PICTIONARY_STATE_VERSION = 5;

export const PICTIONARY_STATE_IDENTITY = {
  gameType: PICTIONARY_GAME_TYPE,
  stateVersion: PICTIONARY_STATE_VERSION,
} as const;
