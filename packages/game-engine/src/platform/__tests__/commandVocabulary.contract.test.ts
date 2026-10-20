/**
 * Lifecycle command vocabulary contract (D-3 stage 2): one suffix, one
 * landing point, platform-wide. Every game's command union must name
 * its lifecycle commands from the unified suffix set
 * (roles.assign / game.begin / game.redeal / game.next /
 * game.returnToLobby / game.abort / role.viewed); the pre-unification
 * suffixes are banned outright. Gameplay commands (round.* mechanics,
 * phase.*, gallery.*, …) are each game's own vocabulary and out of
 * scope.
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
  'demo',
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
 * The lifecycle literals each game must expose after unification
 * (stage-2 plan §2). A game lists only the flows it actually has:
 * e.g. drawguess has no identity viewing, avalon has no abort.
 */
const EXPECTED_LIFECYCLE: Record<GameId, readonly string[]> = {
  werewolf: [
    'werewolf.roles.assign',
    'werewolf.game.begin',
    'werewolf.game.redeal',
    'werewolf.game.returnToLobby',
    'werewolf.game.abort',
    'werewolf.role.viewed',
  ],
  avalon: [
    'avalon.roles.assign',
    'avalon.game.begin',
    'avalon.game.returnToLobby',
    'avalon.role.viewed',
  ],
  fibking: [
    'fibking.roles.assign',
    'fibking.game.begin',
    'fibking.game.returnToLobby',
    'fibking.role.viewed',
  ],
  undercover: [
    'undercover.roles.assign',
    'undercover.game.begin',
    'undercover.game.redeal',
    'undercover.game.returnToLobby',
    'undercover.game.abort',
    'undercover.role.viewed',
  ],
  pictionary: [
    'pictionary.game.begin',
    'pictionary.game.next',
    'pictionary.game.returnToLobby',
    'pictionary.game.abort',
  ],
  storyrelay: [
    'storyrelay.game.begin',
    'storyrelay.game.next',
    'storyrelay.game.returnToLobby',
    'storyrelay.game.abort',
  ],
  drawguess: ['drawguess.game.begin', 'drawguess.game.returnToLobby'],
  demo: ['demo.roles.assign', 'demo.game.begin', 'demo.game.returnToLobby', 'demo.role.viewed'],
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
    const offenders = commandLiterals(game).filter((literal) =>
      FORBIDDEN_SUFFIXES.some((suffix) => literal.endsWith(suffix)),
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
