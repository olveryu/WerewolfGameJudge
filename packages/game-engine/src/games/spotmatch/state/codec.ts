/** Spotmatch runtime state codec shared by persistence and network boundaries. */

import type { GameStateCodec } from '../../../platform/protocol/roomSnapshot';
import { parseSpotmatchState } from './parseState';
import type { SpotmatchState } from './types';
import { SPOTMATCH_STATE_IDENTITY } from './version';

export const SPOTMATCH_STATE_CODEC = {
  ...SPOTMATCH_STATE_IDENTITY,
  parse: parseSpotmatchState,
} satisfies GameStateCodec<SpotmatchState>;
