/** Werewolf runtime state codec shared by persistence and network boundaries. */

import type { GameStateCodec } from '../../../platform/protocol/roomSnapshot';
import type { GameState } from '../domain/protocol/types';
import { parseWerewolfState } from './parseState';

export const WEREWOLF_STATE_CODEC = {
  gameType: 'werewolf',
  parse: parseWerewolfState,
} satisfies GameStateCodec<GameState>;
