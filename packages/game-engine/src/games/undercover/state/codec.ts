/** Undercover runtime state codec shared by persistence and network boundaries. */

import type { GameStateCodec } from '../../../platform/protocol/roomSnapshot';
import { parseUndercoverState } from './parseState';
import type { UndercoverState } from './types';

export const UNDERCOVER_STATE_CODEC = {
  gameType: 'undercover',
  parse: parseUndercoverState,
} satisfies GameStateCodec<UndercoverState>;
