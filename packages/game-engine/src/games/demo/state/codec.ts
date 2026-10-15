/** Demo runtime state codec shared by persistence and network boundaries. */

import type { GameStateCodec } from '../../../platform/protocol/roomSnapshot';
import { parseDemoState } from './parseState';
import type { DemoState } from './types';
import { DEMO_STATE_IDENTITY } from './version';

export const DEMO_STATE_CODEC = {
  ...DEMO_STATE_IDENTITY,
  parse: parseDemoState,
} satisfies GameStateCodec<DemoState>;
