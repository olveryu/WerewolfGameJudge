/** Secrethitler runtime state codec shared by persistence and network boundaries. */

import type { GameStateCodec } from '../../../platform/protocol/roomSnapshot';
import { parseSecrethitlerState } from './parseState';
import type { SecrethitlerState } from './types';
import { SECRETHITLER_STATE_IDENTITY } from './version';

export const SECRETHITLER_STATE_CODEC = {
  ...SECRETHITLER_STATE_IDENTITY,
  parse: parseSecrethitlerState,
} satisfies GameStateCodec<SecrethitlerState>;
