/**
 * Contract test: games must not hand-write controlled seat models.
 *
 * The controlled seat model may only be produced by the shared factory
 * `createControlledSeatModel` in src/features/room. The banner reports an
 * active takeover only: the factory returns a model while a seat is being
 * controlled and null otherwise — there is no hint variant, and no game
 * computes banner visibility itself.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import { CLIENT_GAME_PLUGIN_CATALOG } from '@/games/catalog';

const GAMES_DIR = join(__dirname, '../games');
const HANDWRITTEN_PATTERN = /displayName:.*\n.*onRelease:/;

function getAllTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...getAllTsFiles(fullPath));
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('controlled seat model contract', () => {
  it('no game file hand-writes a controlled seat model literal', () => {
    const violations: string[] = [];
    for (const file of getAllTsFiles(GAMES_DIR)) {
      if (file.includes('__tests__') || file.endsWith('.test.ts') || file.endsWith('.test.tsx')) {
        continue;
      }
      if (HANDWRITTEN_PATTERN.test(readFileSync(file, 'utf-8'))) {
        violations.push(file.replace(GAMES_DIR, 'src/games'));
      }
    }
    expect(violations).toEqual([]);
  });

  it('the factory owns the takeover-only rule and carries no hint variant', () => {
    const factory = readFileSync(
      join(__dirname, '../features/room/model/createControlledSeatModel.ts'),
      'utf-8',
    );
    expect(factory).toMatch(/if \(input\.controlledSeat === null\) return null;/);
    expect(factory).not.toMatch(/hint/);
    expect(factory).not.toMatch(/canControlBots|hasBots/);
    // Every game feeds the factory the controlled seat and its display
    // name; none passes a precomputed visibility flag. The coverage
    // set is derived from the client catalog: each registered game
    // must assemble the model through exactly one production call
    // site, discovered by scanning the game's own sources — the
    // assembly point differs per game (the shell factories in the
    // adapters own the call for most games; fibking/pictionary
    // assemble in their screen-state hooks, whose factories receive
    // the model as an input), so a hardcoded path list would
    // silently leave the next game uncovered.
    for (const gameType of Object.keys(CLIENT_GAME_PLUGIN_CATALOG)) {
      const callSites: { file: string; call: string }[] = [];
      for (const file of getAllTsFiles(join(GAMES_DIR, gameType))) {
        if (file.includes('__tests__') || file.endsWith('.test.ts') || file.endsWith('.test.tsx')) {
          continue;
        }
        const call = /createControlledSeatModel\(\{[\s\S]*?\}\)/.exec(readFileSync(file, 'utf-8'));
        if (call !== null) callSites.push({ file, call: call[0] });
      }
      if (callSites.length !== 1 || callSites[0] === undefined) {
        throw new Error(
          `${gameType}: expected exactly one createControlledSeatModel call site, ` +
            `found ${callSites.length}` +
            (callSites.length > 0
              ? `: ${callSites.map((site) => site.file.replace(GAMES_DIR, 'src/games')).join(', ')}`
              : ''),
        );
      }
      const { call } = callSites[0];
      expect(call).toMatch(/controlledSeat[:,]/);
      expect(call).toMatch(/controlledBotName[:,]/);
      expect(call).not.toMatch(/canControlBots|hasBots|isVisible/);
    }
  });

  it('the shared factory is the single producer of the banner model', () => {
    const factory = readFileSync(
      join(__dirname, '../features/room/model/createControlledSeatModel.ts'),
      'utf-8',
    );
    expect(factory).toContain('export function createControlledSeatModel');
    expect(factory).toContain('onRelease: input.release');
  });
});
