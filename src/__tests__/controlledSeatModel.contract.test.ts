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
    // name; none passes a precomputed visibility flag.
    // Assembly sites: the shell factories in the adapters own the call for
    // six games; fibking/pictionary still assemble in their screen-state
    // hooks (their factories receive the model as an input).
    const consumers = [
      'avalon/room/avalonRoomAdapter.ts',
      'demo/room/demoRoomAdapter.ts',
      'drawguess/room/drawGuessRoomAdapter.ts',
      'fibking/room/hooks/useFibRoomScreenState.ts',
      'pictionary/room/hooks/usePictionaryRoomScreenState.ts',
      'storyrelay/room/storyRelayRoomAdapter.ts',
      'undercover/room/undercoverRoomAdapter.ts',
      'werewolf/werewolfRoomAdapter.ts',
    ];
    for (const consumer of consumers) {
      const source = readFileSync(join(GAMES_DIR, consumer), 'utf-8');
      const call = /createControlledSeatModel\(\{[\s\S]*?\}\)/.exec(source);
      if (call === null) throw new Error(`No factory call found in ${consumer}`);
      expect(call[0]).toMatch(/controlledSeat[:,]/);
      expect(call[0]).toMatch(/controlledBotName[:,]/);
      expect(call[0]).not.toMatch(/canControlBots|hasBots|isVisible/);
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
