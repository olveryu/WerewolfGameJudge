/**
 * Production filter contract (template plan §7.1, ruling D8): a game
 * can be fully registered yet marked not-in-production in the
 * registry; the player-facing Home aggregation — the lobby list and
 * the create-room / guide picker fed by it — must then contain
 * exactly the production games. `demo` is the pinned case: registered
 * through the real path, present in the catalog, never on a player
 * surface.
 */

import { GAME_REGISTRY } from '@game-judge/game-engine/games/registry';
import { GAME_TYPES } from '@game-judge/game-engine/platform/protocol/gameTypes';

import { createClientGameHome } from '@/games/home';
import { getClientGameModules } from '@/games/model/ClientGameCatalog';
import { createTestClientGameCatalog } from '@/test-utils/clientGameCatalog';

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
  const modules = getClientGameModules(createTestClientGameCatalog());
  const home = createClientGameHome(modules);

  it('feeds the aggregation every registered game, demo included', () => {
    expect(modules.map((module) => module.gameType)).toEqual([...GAME_TYPES]);
    expect(GAME_TYPES).toContain('demo');
    expect(GAME_REGISTRY.demo.isProduction).toBe(false);
    for (const gameType of PRODUCTION_GAME_TYPES) {
      expect(GAME_REGISTRY[gameType].isProduction).toBe(true);
    }
  });

  it('lists exactly the production games as mode options (lobby / create-room picker)', () => {
    const expected = GAME_TYPES.filter((gameType) => GAME_REGISTRY[gameType].isProduction);
    expect(expected).toEqual([...PRODUCTION_GAME_TYPES]);
    expect(home.modeOptions.map((option) => option.gameType)).toEqual(expected);
    expect(home.modeOptions.map((option) => option.gameType)).not.toContain('demo');
  });

  it('keeps non-production games out of guide options, spotlights and announcement tabs', () => {
    expect(home.guideOptions.map((option) => option.gameType)).not.toContain('demo');
    expect(home.guideOptions.map((option) => option.gameType)).toEqual(
      home.modeOptions.map((option) => option.gameType),
    );
    expect(home.spotlights.map((spotlight) => spotlight.gameType)).not.toContain('demo');
    expect(home.announcementTabs.map((tab) => tab.key)).not.toContain(
      expect.stringContaining('demo:'),
    );
  });
});
