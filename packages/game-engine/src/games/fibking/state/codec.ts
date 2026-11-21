/** FibKing runtime state codec shared by persistence and network boundaries. */

import type { GameStateCodec } from '../../../platform/protocol/roomSnapshot';
import { parseFibState } from './parseState';
import type { FibState } from './types';

export const FIB_STATE_CODEC = {
  gameType: 'fibking',
  parse: parseFibState,
} satisfies GameStateCodec<FibState>;
