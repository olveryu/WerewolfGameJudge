/**
 * Lifecycle command vocabulary contract: games use the unified suffixes.
 * Migrated games expose game.restart for the atomic reset
 * to preparation; other games still reject that legacy suffix until migrated.
 * Gameplay commands (round.* mechanics, phase.*, gallery.*, …) are each
 * game's own vocabulary and out of scope.
 *
 * The scan reads each game's commands/types.ts source: the unions are
 * types, not runtime values, and some members are declared inline
 * (e.g. storyrelay nests game.abort inside a revision-command type),
 * so a literal scan of the declaration file is the complete surface.
 */

import fs from 'node:fs';
import path from 'node:path';

const gamesDirectory = path.resolve(__dirname, '..', '..', 'games');

const GAME_IDS = [
  'werewolf',
  'avalon',
  'fibking',
  'undercover',
  'pictionary',
  'storyrelay',
  'drawguess',
  'spotmatch',
] as const;

type GameId = (typeof GAME_IDS)[number];

const FORBIDDEN_SUFFIXES = [
  '.game.start',
  '.game.restart',
  '.night.start',
  '.round.start',
  '.round.begin',
  '.round.restart',
  '.round.next',
  '.round.abort',
  '.round.confirm',
  '.round.confirmRoleView',
  '.role.view',
] as const;

/**
 * The lifecycle literals each game must expose. A game lists only
 * the flows it actually has, e.g. drawguess has no identity viewing.
 */
const EXPECTED_LIFECYCLE: Record<GameId, readonly string[]> = {
  werewolf: [
    'werewolf.roles.assign',
    'werewolf.game.begin',
    'werewolf.game.restart',
    'werewolf.role.viewed',
  ],
  avalon: ['avalon.roles.assign', 'avalon.game.begin', 'avalon.game.restart', 'avalon.role.viewed'],
  fibking: [
    'fibking.roles.assign',
    'fibking.game.begin',
    'fibking.game.restart',
    'fibking.game.returnToLobby',
    'fibking.role.viewed',
  ],
  undercover: [
    'undercover.roles.assign',
    'undercover.game.begin',
    'undercover.game.redeal',
    'undercover.game.restart',
    'undercover.game.returnToLobby',
    'undercover.game.abort',
    'undercover.role.viewed',
  ],
  pictionary: [
    'pictionary.game.begin',
    'pictionary.game.next',
    'pictionary.game.restart',
    'pictionary.game.returnToLobby',
    'pictionary.game.abort',
  ],
  storyrelay: [
    'storyrelay.game.begin',
    'storyrelay.game.next',
    'storyrelay.game.restart',
    'storyrelay.game.returnToLobby',
    'storyrelay.game.abort',
  ],
  drawguess: [
    'drawguess.game.begin',
    'drawguess.game.abort',
    'drawguess.game.restart',
    'drawguess.game.returnToLobby',
  ],
  spotmatch: [
    'spotmatch.game.begin',
    'spotmatch.game.abort',
    'spotmatch.game.restart',
    'spotmatch.game.returnToLobby',
  ],
};

function commandLiterals(game: GameId): string[] {
  const source = fs.readFileSync(path.join(gamesDirectory, game, 'commands', 'types.ts'), 'utf8');
  const literals = new Set<string>();
  for (const match of source.matchAll(/'([a-z]+\.[a-zA-Z.]+)'/g)) {
    const literal = match[1];
    if (literal !== undefined && literal.startsWith(`${game}.`)) literals.add(literal);
  }
  return [...literals].sort();
}

describe('lifecycle command vocabulary', () => {
  it.each(GAME_IDS)('%s declares no banned lifecycle suffix', (game) => {
    const offenders = commandLiterals(game).filter(
      (literal) =>
        FORBIDDEN_SUFFIXES.some((suffix) => literal.endsWith(suffix)) &&
        !(literal.endsWith('.game.restart') && EXPECTED_LIFECYCLE[game].includes(literal)),
    );
    expect(offenders).toEqual([]);
  });

  it.each(GAME_IDS)('%s exposes its unified lifecycle commands', (game) => {
    const literals = commandLiterals(game);
    for (const expected of EXPECTED_LIFECYCLE[game]) {
      expect(literals).toContain(expected);
    }
  });
});
