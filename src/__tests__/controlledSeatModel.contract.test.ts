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

  it('the shared factory is the single producer of the controlled kind', () => {
    const factory = readFileSync(
      join(__dirname, '../features/room/model/createControlledSeatModel.ts'),
      'utf-8',
    );
    expect(factory).toContain("kind: 'controlled'");
    expect(factory).toContain('export function createControlledSeatModel');
  });
});
