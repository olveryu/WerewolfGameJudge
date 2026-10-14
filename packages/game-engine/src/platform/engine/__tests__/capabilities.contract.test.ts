/** Game capabilities contract: `GameEngineCapabilities` in each game's
 * engine definition is the single declaration source for the chassis
 * capability switches. This contract welds every declaration to the
 * wiring it claims, so a game that declares a capability it never
 * hooked up — or hooks one up without declaring it — fails here
 * naming the game and the switch.
 *
 * Welds used, per switch:
 * - `botsAndTakeover`, `hostConfig`, `botTestScaffold`,
 *   `stageDeadline`, `audioOrchestration`, `gallery`: a marker string
 *   that only exists in the game's non-test engine source when the
 *   platform wiring is present (the shared seating command, the
 *   per-game config/scaffold commands, the deadline state field, the
 *   audio machinery, the gallery flow).
 * - `identityViewing`: the per-game protocol scenario suite
 *   (`identityViewingProtocol.contract.test.ts`) exists exactly for
 *   the games that declare it; those suites pin the behavior itself.
 * - `wordLibrary`: the registration registry lists a word-supply
 *   workflow export exactly for the games that declare it.
 * - `nightPhase`: the declared set is pinned by the value table
 *   below and by the dedicated test in `contracts.test.ts`.
 * - `revealAnimation`: declaration-only for now. Its wiring is the
 *   client role-card and product presentation layer, which has no
 *   uniform engine-layer signal (the engine-side `revealEffect`
 *   seat-profile field also exists in games without role cards), so
 *   the value table below is its only pin until a client-layer
 *   contract exists.
 *
 * The value table is deliberate: flipping a declaration means
 * updating the expected row here in the same change.
 */

import fs from 'node:fs';
import path from 'node:path';

import { GAME_ENGINE_CATALOG } from '../../../games/catalog';
import { GAME_REGISTRY } from '../../../games/registry';
import { GAME_TYPES, type GameType } from '../../protocol/gameTypes';
import type { GameEngineCapabilities } from '../types';

const gamesDirectory = path.resolve(__dirname, '..', '..', '..', 'games');

const CAPABILITY_KEYS = [
  'nightPhase',
  'botsAndTakeover',
  'identityViewing',
  'revealAnimation',
  'stageDeadline',
  'audioOrchestration',
  'wordLibrary',
  'gallery',
  'hostConfig',
  'botTestScaffold',
] as const satisfies readonly (keyof GameEngineCapabilities)[];

/** Declared capabilities per game, verified against each game's wiring. */
const EXPECTED_CAPABILITIES: Readonly<Record<GameType, GameEngineCapabilities>> = {
  werewolf: {
    nightPhase: true,
    botsAndTakeover: true,
    identityViewing: true,
    revealAnimation: true,
    stageDeadline: false,
    audioOrchestration: true,
    wordLibrary: false,
    gallery: false,
    hostConfig: true,
    botTestScaffold: true,
  },
  fibking: {
    nightPhase: false,
    botsAndTakeover: true,
    identityViewing: true,
    revealAnimation: true,
    stageDeadline: false,
    audioOrchestration: false,
    wordLibrary: true,
    gallery: false,
    hostConfig: true,
    botTestScaffold: true,
  },
  pictionary: {
    nightPhase: false,
    botsAndTakeover: true,
    identityViewing: false,
    revealAnimation: false,
    stageDeadline: true,
    audioOrchestration: false,
    wordLibrary: false,
    gallery: true,
    hostConfig: true,
    botTestScaffold: false,
  },
  undercover: {
    nightPhase: false,
    botsAndTakeover: true,
    identityViewing: true,
    revealAnimation: true,
    stageDeadline: false,
    audioOrchestration: false,
    wordLibrary: true,
    gallery: false,
    hostConfig: true,
    botTestScaffold: true,
  },
  storyrelay: {
    nightPhase: false,
    botsAndTakeover: true,
    identityViewing: false,
    revealAnimation: false,
    stageDeadline: true,
    audioOrchestration: false,
    wordLibrary: false,
    gallery: true,
    hostConfig: true,
    botTestScaffold: false,
  },
  drawguess: {
    nightPhase: false,
    botsAndTakeover: true,
    identityViewing: false,
    revealAnimation: false,
    stageDeadline: true,
    audioOrchestration: false,
    wordLibrary: true,
    gallery: false,
    hostConfig: true,
    botTestScaffold: false,
  },
  avalon: {
    nightPhase: true,
    botsAndTakeover: true,
    identityViewing: true,
    revealAnimation: true,
    stageDeadline: true,
    audioOrchestration: true,
    wordLibrary: false,
    gallery: false,
    hostConfig: true,
    botTestScaffold: true,
  },
};

/** Concatenated non-test engine source of one game, with the
 * capabilities declaration block itself stripped — its key names
 * contain several weld markers (`audioOrchestration`, `gallery`) and
 * must not count as their own wiring evidence. */
function readGameSource(gameType: GameType): string {
  const chunks: string[] = [];
  const walk = (current: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') walk(entryPath);
      } else if (entry.name.endsWith('.ts')) {
        chunks.push(fs.readFileSync(entryPath, 'utf8'));
      }
    }
  };
  walk(path.join(gamesDirectory, gameType));
  return chunks.join('\n').replace(/capabilities:\s*\{[^}]*\}/, 'capabilities: {}');
}

const SOURCE_WELDS: readonly {
  readonly capability: keyof GameEngineCapabilities;
  readonly marker: (gameType: GameType) => string;
}[] = [
  { capability: 'botsAndTakeover', marker: () => 'room.seat.fillBots' },
  { capability: 'hostConfig', marker: (gameType) => `${gameType}.config.update` },
  {
    capability: 'botTestScaffold',
    marker: (gameType) => `${gameType}.bots.markAllBotsViewed`,
  },
  { capability: 'stageDeadline', marker: () => 'deadlineAt' },
  { capability: 'audioOrchestration', marker: () => 'audio' },
  { capability: 'gallery', marker: () => 'gallery' },
];

describe('game capabilities completeness', () => {
  it('declares exactly the canonical switch set, all boolean, for every game', () => {
    for (const gameType of GAME_TYPES) {
      const capabilities = GAME_ENGINE_CATALOG[gameType].capabilities;
      expect(Object.keys(capabilities).sort()).toEqual([...CAPABILITY_KEYS].sort());
      for (const key of CAPABILITY_KEYS) {
        expect(typeof capabilities[key]).toBe('boolean');
      }
    }
  });

  it('matches the verified declaration table for every game', () => {
    for (const gameType of GAME_TYPES) {
      expect({ ...GAME_ENGINE_CATALOG[gameType].capabilities }).toEqual(
        EXPECTED_CAPABILITIES[gameType],
      );
    }
  });
});

describe('game capabilities wiring welds', () => {
  for (const weld of SOURCE_WELDS) {
    it(`welds ${weld.capability} to the engine wiring of every game`, () => {
      for (const gameType of GAME_TYPES) {
        const declared = GAME_ENGINE_CATALOG[gameType].capabilities[weld.capability];
        const wired = readGameSource(gameType)
          .toLowerCase()
          .includes(weld.marker(gameType).toLowerCase());
        expect(declared).toBe(wired);
      }
    });
  }

  it('welds identityViewing to the per-game protocol scenario suites', () => {
    for (const gameType of GAME_TYPES) {
      const declared = GAME_ENGINE_CATALOG[gameType].capabilities.identityViewing;
      const suiteExists = fs.existsSync(
        path.join(
          gamesDirectory,
          gameType,
          '__tests__',
          'identityViewingProtocol.contract.test.ts',
        ),
      );
      expect(declared).toBe(suiteExists);
    }
  });

  it('welds wordLibrary to the registered word-supply workflows', () => {
    for (const gameType of GAME_TYPES) {
      const declared = GAME_ENGINE_CATALOG[gameType].capabilities.wordLibrary;
      const registered = GAME_REGISTRY[gameType].workerWorkflows.some((workflow) =>
        workflow.exportName.endsWith('WordSupplyWorkflow'),
      );
      expect(declared).toBe(registered);
    }
  });
});
