/**
 * Contract test: src/features/room/ must not import from @/games/*
 *
 * The shared room UI layer is game-agnostic. Any game-specific logic
 * must live in the game's own directory (src/games/<game>/), not in
 * the shared layer. This test prevents future drift.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const ROOM_DIR = join(__dirname, '../features/room/components/RoleRevealEffects');
const FORBIDDEN_PATTERNS = [
  /from\s+['"]@\/games\//,
  /import\s*\(\s*['"]@\/games\//,
  /@game-judge\/game-engine\/games\/werewolf/,
  /@game-judge\/game-engine\/games\/avalon/,
];

function getAllTsFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...getAllTsFiles(fullPath));
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('room shared layer game-agnostic contract', () => {
  it('does not import from @/games/*', () => {
    const files = getAllTsFiles(ROOM_DIR);
    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          const relativePath = file.replace(ROOM_DIR, 'src/features/room');
          violations.push(`${relativePath}: matches ${pattern}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
