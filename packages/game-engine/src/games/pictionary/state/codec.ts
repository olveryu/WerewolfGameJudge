/** Pictionary runtime state codec shared by persistence and network boundaries. */

import type { GameStateCodec } from '../../../platform/protocol/roomSnapshot';
import { parsePictionaryState } from './parseState';
import type { PictionaryState } from './types';

export const PICTIONARY_STATE_CODEC = {
  gameType: 'pictionary',
  parse: parsePictionaryState,
} satisfies GameStateCodec<PictionaryState>;
