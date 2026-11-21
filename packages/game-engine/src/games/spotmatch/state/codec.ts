/** Spotmatch runtime state codec shared by persistence and network boundaries. */

import type { GameStateCodec } from '../../../platform/protocol/roomSnapshot';
import { parseSpotmatchState } from './parseState';
import type { SpotmatchState } from './types';

export const SPOTMATCH_STATE_CODEC = {
  gameType: 'spotmatch',
  parse: parseSpotmatchState,
} satisfies GameStateCodec<SpotmatchState>;
