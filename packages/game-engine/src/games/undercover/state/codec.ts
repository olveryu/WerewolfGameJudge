/** Undercover runtime state codec shared by persistence and network boundaries. */

import type { GameStateCodec } from '../../../platform/protocol/roomSnapshot';
import { parseUndercoverState } from './parseState';
import type { UndercoverState } from './types';
import { UNDERCOVER_STATE_IDENTITY } from './version';

export const UNDERCOVER_STATE_CODEC = {
  ...UNDERCOVER_STATE_IDENTITY,
  parse: parseUndercoverState,
} satisfies GameStateCodec<UndercoverState>;
