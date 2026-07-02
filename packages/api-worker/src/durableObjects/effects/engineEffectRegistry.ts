/**
 * ENGINE_EFFECT_REGISTRY — maps each gameType to its runtime effect policy.
 */

import {
  FIB_GAME_TYPE,
  type GameType,
  isGameType,
  WEREWOLF_GAME_TYPE,
} from '@werewolf/game-engine/protocol/gameTypes';

import type { DispatchResult } from '../processEngineAction';
import type { EngineEffectContext, EngineEffectRunner, EnginePostCommitContext } from './types';
import { runWerewolfAlarm, runWerewolfPostCommitEffects } from './werewolfSettlementEffects';

const ENGINE_EFFECT_REGISTRY: Record<GameType, EngineEffectRunner> = {
  [WEREWOLF_GAME_TYPE]: {
    afterCommit: runWerewolfPostCommitEffects,
    alarm: runWerewolfAlarm,
  },
  [FIB_GAME_TYPE]: {},
};

export async function runEnginePostCommitEffects(
  gameType: string,
  result: DispatchResult,
  context: EnginePostCommitContext,
): Promise<void> {
  const runner = getEngineEffectRunner(gameType);
  if (runner.afterCommit) {
    await runner.afterCommit(result, context);
  }
}

export async function runEngineAlarm(
  gameType: string,
  context: EngineEffectContext,
): Promise<void> {
  const runner = getEngineEffectRunner(gameType);
  if (runner.alarm) {
    await runner.alarm(context);
  }
}

function getEngineEffectRunner(gameType: string): EngineEffectRunner {
  if (!isGameType(gameType)) {
    throw new Error(`[FAIL-FAST] No engine effect policy registered for gameType: ${gameType}`);
  }
  return ENGINE_EFFECT_REGISTRY[gameType];
}
