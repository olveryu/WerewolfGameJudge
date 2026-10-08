/**
 * Contract test: shared host-management action keys come only from builders.
 *
 * The four cross-game host actions (start-game, fill-bots, clear-seats,
 * configure-game) are built by src/features/room/model/hostManagementActions
 * so labels/icons/variants stay consistent. A game that hand-writes an
 * action object with one of these keys drifts from the shared panel.
 * Game-specific actions use their own keys and are unaffected.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const GAMES_DIR = join(__dirname, '../games');
const SHARED_KEYS = ['start-game', 'fill-bots', 'clear-seats', 'configure-game'] as const;
const HANDWRITTEN_PATTERN = new RegExp(`key:\\s*['"](${SHARED_KEYS.join('|')})['"]`);

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

describe('host management actions contract', () => {
  it('no game file hand-writes a shared host action key', () => {
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

  it('the builders are the single source of the shared keys', () => {
    const builders = readFileSync(
      join(__dirname, '../features/room/model/hostManagementActions.ts'),
      'utf-8',
    );
    for (const key of SHARED_KEYS) {
      expect(builders).toContain(`'${key}'`);
    }
  });
});
