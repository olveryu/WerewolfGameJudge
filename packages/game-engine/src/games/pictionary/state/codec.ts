/** Pictionary runtime state codec shared by persistence and network boundaries. */

import type { GameStateCodec } from '../../../platform/protocol/roomSnapshot';
import { parsePictionaryState } from './parseState';
import type { PictionaryState } from './types';
import { PICTIONARY_STATE_IDENTITY } from './version';

export const PICTIONARY_STATE_CODEC = {
  ...PICTIONARY_STATE_IDENTITY,
  parse: parsePictionaryState,
} satisfies GameStateCodec<PictionaryState>;
