/** Avalon runtime state codec shared by persistence and network boundaries. */

import type { GameStateCodec } from '../../../platform/protocol/roomSnapshot';
import { parseAvalonState } from './parseState';
import type { AvalonState } from './types';

export const AVALON_STATE_CODEC = {
  gameType: 'avalon',
  parse: parseAvalonState,
} satisfies GameStateCodec<AvalonState>;
