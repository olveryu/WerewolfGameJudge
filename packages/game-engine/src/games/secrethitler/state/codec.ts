/** Secrethitler runtime state codec shared by persistence and network boundaries. */

import type { GameStateCodec } from '../../../platform/protocol/roomSnapshot';
import { parseSecrethitlerState } from './parseState';
import type { SecrethitlerState } from './types';

export const SECRETHITLER_STATE_CODEC = {
  gameType: 'secrethitler',
  parse: parseSecrethitlerState,
} satisfies GameStateCodec<SecrethitlerState>;
