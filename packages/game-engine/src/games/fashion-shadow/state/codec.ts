// Authoritative Fashion Shadow state codec.

import type { GameStateCodec } from '../../../platform/protocol/roomSnapshot';
import { parseFashionState } from './parseState';
import type { FashionState } from './types';
import { FASHION_STATE_IDENTITY } from './version';

export const FASHION_STATE_CODEC = {
  ...FASHION_STATE_IDENTITY,
  parse: parseFashionState,
} satisfies GameStateCodec<FashionState>;
