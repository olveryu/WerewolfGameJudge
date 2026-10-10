/**
 * Contract test: games must not hand-write controlled seat models.
 *
 * The controlled seat model (RoomShellModel.seatBanner union member with
 * kind: 'controlled') may only be produced by the shared factory
 * `createControlledSeatModel` in src/features/room. A game that hand-writes
 * `{ kind: 'controlled', ... }` drifts from the shared banner contract.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const GAMES_DIR = join(__dirname, '../games');
const HANDWRITTEN_PATTERN = /kind:\s*['"]controlled['"]/;

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

  it('the visibility gate lives in the factory, fed by two inputs from every game', () => {
    const factory = readFileSync(
      join(__dirname, '../features/room/model/createControlledSeatModel.ts'),
      'utf-8',
    );
    // The factory owns the gate; its input carries no precomputed visibility.
    expect(factory).not.toMatch(/isVisible: boolean/);
    expect(factory).toMatch(/canControlBots: boolean;/);
    expect(factory).toMatch(/hasBots: boolean;/);
    expect(factory).toMatch(
      /input\.controlledSeat !== null \|\| \(input\.canControlBots && input\.hasBots\)/,
    );
    // Every game passes both gate inputs; none hand-writes the visibility rule.
    const consumers = [
      'avalon/room/hooks/useAvalonRoomState.ts',
      'drawguess/room/hooks/useDrawGuessRoomState.ts',
      'fibking/room/hooks/useFibRoomScreenState.ts',
      'pictionary/room/hooks/usePictionaryRoomScreenState.ts',
      'storyrelay/room/hooks/useStoryRelayRoomState.ts',
      'undercover/room/hooks/useUndercoverRoomScreenState.ts',
      'werewolf/werewolfRoomAdapter.ts',
    ];
    for (const consumer of consumers) {
      const source = readFileSync(join(GAMES_DIR, consumer), 'utf-8');
      const call = /createControlledSeatModel\(\{[\s\S]*?\}\)/.exec(source);
      if (call === null) throw new Error(`No factory call found in ${consumer}`);
      expect(call[0]).toMatch(/canControlBots[:,]/);
      expect(call[0]).toMatch(/hasBots[:,]/);
      expect(call[0]).not.toMatch(/isVisible/);
    }
  });

  it('the shared factory is the single producer of the controlled kind', () => {
    const factory = readFileSync(
      join(__dirname, '../features/room/model/createControlledSeatModel.ts'),
      'utf-8',
    );
    expect(factory).toContain("kind: 'controlled'");
    expect(factory).toContain('export function createControlledSeatModel');
  });
});
