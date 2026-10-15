/**
 * Engine skeleton contract (AU-34): every game implements the same
 * engine skeleton. Required modules per game:
 *
 *   engine.ts                  the GameEngineDefinition
 *   public.ts                  the package's public surface
 *   commands/types.ts          command vocabulary
 *   domain/decision.ts         the Decision alias + commit helper
 *   domain/evolve.ts           event application (the definition's evolve)
 *   domain/visibility.ts       viewer projections (privacy boundary home)
 *   state/codec.ts             the thin {...IDENTITY, parse} codec shell
 *   state/parseState.ts        strict parser + persisted-state migration
 *   state/normalize.ts         semantic invariants over authoritative state
 *   state/types.ts             state shape, config, state-derived helpers
 *   state/version.ts           X_STATE_VERSION + X_STATE_IDENTITY
 *
 * Registered exceptions (deliberate, do not "fix" without a ruling):
 * werewolf predates the skeleton and keeps its reducer architecture —
 * its evolve is the gameReducer under domain/reducer/, its normalize
 * and state construction live under domain/state/, its state types
 * under domain/models + domain/protocol/, and it has no single
 * visibility module (its viewer projections are a separately tracked
 * aggregation item). Its engine definition still satisfies
 * GameEngineDefinition with evolve bound to the reducer.
 * storyrelay runs on the shared relay chain machine (E1,
 * platform/room/relay): its viewer projection is assembled in
 * domain/relay.ts, the binding module over the machine whose tasks
 * module owns the privacy boundary.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const gamesDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'games');

const REQUIRED_MODULES = [
  'engine.ts',
  'public.ts',
  'commands/types.ts',
  'domain/decision.ts',
  'domain/evolve.ts',
  'domain/visibility.ts',
  'state/codec.ts',
  'state/parseState.ts',
  'state/normalize.ts',
  'state/types.ts',
  'state/version.ts',
] as const;

/** Registered per-game replacements for required modules (AU-34). */
const REGISTERED_EXCEPTIONS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  werewolf: {
    'domain/evolve.ts': 'domain/reducer/gameReducer.ts',
    'domain/visibility.ts': 'domain/playerHelpers.ts',
    'state/normalize.ts': 'domain/state/normalize.ts',
    'state/types.ts': 'domain/protocol/types.ts',
  },
  storyrelay: {
    'domain/visibility.ts': 'domain/relay.ts',
  },
};

const gameTypes = fs
  .readdirSync(gamesDirectory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

describe('engine skeleton contract', () => {
  it('covers every game in the catalog', () => {
    expect(gameTypes).toEqual([
      'avalon',
      'demo',
      'drawguess',
      'fibking',
      'pictionary',
      'storyrelay',
      'undercover',
      'werewolf',
    ]);
  });

  it.each(gameTypes)('%s implements the skeleton (or its registered exceptions)', (game) => {
    const exceptions = REGISTERED_EXCEPTIONS[game] ?? {};
    for (const required of REQUIRED_MODULES) {
      const expected = exceptions[required] ?? required;
      const fullPath = path.join(gamesDirectory, game, expected);
      expect(fs.existsSync(fullPath), `${game}: expected ${expected}`).toBe(true);
    }
  });
});
