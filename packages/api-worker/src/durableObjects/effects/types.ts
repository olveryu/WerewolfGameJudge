/**
 * Engine effect contract — runtime side effects keyed by gameType after state commit.
 */

import type { GameAction } from '@werewolf/game-engine/engine/registry/types';

import type { Env } from '../../env';
import type { DispatchResult } from '../processEngineAction';

export interface EngineEffectContext {
  readonly storage: DurableObjectState['storage'];
  readonly env: Env;
  readonly getWebSockets: () => WebSocket[];
  readonly broadcast: (state: unknown, revision: number, lastAction?: string) => void;
}

export interface EnginePostCommitContext extends EngineEffectContext {
  readonly trigger: GameAction;
}

export interface EngineEffectRunner {
  readonly afterCommit?: (
    result: DispatchResult,
    context: EnginePostCommitContext,
  ) => Promise<void>;
  readonly alarm?: (context: EngineEffectContext) => Promise<void>;
}
