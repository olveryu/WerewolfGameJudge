/** DrawGuess runtime state codec shared by persistence and network boundaries. */

import type { GameStateCodec } from '../../../platform/protocol/roomSnapshot';
import { parseDrawGuessState } from './parseState';
import type { DrawGuessState } from './types';

export const DRAWGUESS_STATE_CODEC = {
  gameType: 'drawguess',
  parse: parseDrawGuessState,
} satisfies GameStateCodec<DrawGuessState>;
