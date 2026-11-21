/** FibKing runtime state codec shared by persistence and network boundaries. */

import type { GameStateCodec } from '../../../platform/protocol/roomSnapshot';
import { parseFibState } from './parseState';
import type { FibState } from './types';
import { FIB_STATE_IDENTITY } from './version';

export const FIB_STATE_CODEC = {
  ...FIB_STATE_IDENTITY,
  parse: parseFibState,
} satisfies GameStateCodec<FibState>;
