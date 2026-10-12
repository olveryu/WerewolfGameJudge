/** DrawGuess runtime state codec shared by persistence and network boundaries. */

import type { GameStateCodec } from '../../../platform/protocol/roomSnapshot';
import { parseDrawGuessState } from './parseState';
import type { DrawGuessState } from './types';
import { DRAWGUESS_STATE_IDENTITY } from './version';

export const DRAWGUESS_STATE_CODEC = {
  ...DRAWGUESS_STATE_IDENTITY,
  parse: parseDrawGuessState,
} satisfies GameStateCodec<DrawGuessState>;
