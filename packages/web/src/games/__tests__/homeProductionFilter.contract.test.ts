/**
 * Production filter contract (ruling D8): a game can be fully registered yet
 * marked not-in-production in the registry; the Home mode options must then
 * list exactly the production games. The hardcoded list is a deliberate
 * tripwire: changing the production set is always an explicit edit here.
 */
import { GAME_REGISTRY } from '@game-judge/game-engine/games/registry';
import { GAME_TYPES } from '@game-judge/game-engine/platform/protocol/gameTypes';

import { GAME_MODE_OPTIONS } from '@/games/catalog';

const PRODUCTION_GAME_TYPES = [
  'werewolf',
  'fibking',
  'pictionary',
  'undercover',
  'storyrelay',
  'drawguess',
  'avalon',
] as const;

describe('client game home production filter', () => {
  it('registers exactly the listed games as production, demo excluded', () => {
    expect(GAME_TYPES.filter((gameType) => GAME_REGISTRY[gameType].isProduction)).toEqual([
      ...PRODUCTION_GAME_TYPES,
    ]);
    expect(GAME_REGISTRY.demo.isProduction).toBe(false);
  });

  it('offers exactly the production games as Home mode options', () => {
    expect(GAME_MODE_OPTIONS.map((option) => option.gameType)).toEqual([...PRODUCTION_GAME_TYPES]);
  });
});
