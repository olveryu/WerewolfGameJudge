import type { GameWordGame } from '@game-judge/game-engine/product/wordSupply';

import type { Env } from '../../env';

const SUPPLY_FLAGS = {
  fibking: 'FIB_WORD_SUPPLY_ENABLED',
  undercover: 'UNDERCOVER_WORD_SUPPLY_ENABLED',
  drawguess: 'DRAWGUESS_WORD_SUPPLY_ENABLED',
} as const satisfies Record<GameWordGame, keyof Env>;

/** Deployment availability does not depend on inventory or budget queries. */
export function isWordSupplyAvailable(env: Env, game: GameWordGame): boolean {
  return env[SUPPLY_FLAGS[game]] === 'true';
}
