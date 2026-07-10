/** Werewolf runtime state codec shared by persistence and network boundaries. */

import type { GameStateCodec } from '../../../platform/protocol/roomSnapshot';
import type { GameState } from '../../../protocol/types';
import { parseWerewolfState } from './parseState';
import { WEREWOLF_STATE_IDENTITY } from './version';

export const WEREWOLF_STATE_CODEC = {
  ...WEREWOLF_STATE_IDENTITY,
  parse: parseWerewolfState,
} satisfies GameStateCodec<GameState>;
