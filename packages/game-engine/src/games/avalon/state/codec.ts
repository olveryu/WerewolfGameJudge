/** Avalon runtime state codec shared by persistence and network boundaries. */

import type { GameStateCodec } from '../../../platform/protocol/roomSnapshot';
import { parseAvalonState } from './parseState';
import type { AvalonState } from './types';
import { AVALON_STATE_IDENTITY } from './version';

export const AVALON_STATE_CODEC = {
  ...AVALON_STATE_IDENTITY,
  parse: parseAvalonState,
} satisfies GameStateCodec<AvalonState>;
