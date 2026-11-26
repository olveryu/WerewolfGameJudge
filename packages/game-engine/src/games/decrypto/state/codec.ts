/** Decrypto runtime state codec shared by persistence and network boundaries. */

import type { GameStateCodec } from '../../../platform/protocol/roomSnapshot';
import { parseDecryptoState } from './parseState';
import type { DecryptoState } from './types';

export const DECRYPTO_STATE_CODEC = {
  gameType: 'decrypto',
  parse: parseDecryptoState,
} satisfies GameStateCodec<DecryptoState>;
