/**
 * Contract test: packages/web/src/features/room/ must not import from @/games/*
 *
 * The shared room UI layer is game-agnostic. Any game-specific logic
 * must live in the game's own directory (packages/web/src/games/<game>/), not in
 * the shared layer. This test prevents future drift.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOM_DIR = join(import.meta.dirname, '../features/room');
const FORBIDDEN_PATTERNS = [
  /from\s+['"]@\/games\//,
  /import\s*\(\s*['"]@\/games\//,
  /@game-judge\/game-engine\/games\//,
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
  const gamesDir = join(import.meta.dirname, '../games');
  const games = readdirSync(gamesDir).filter((game) => existsSync(join(gamesDir, game, 'room')));
  it.each(games)('%s uses the one shared game configuration card', (game) => {
    const sources = getAllTsFiles(join(gamesDir, game, 'room'))
      .filter((file) => !file.includes('__tests__') && !file.endsWith('.test.tsx'))
      .map((file) => readFileSync(file, 'utf-8'))
      .join('\n');
    expect(sources).toContain("from '@/features/room/components/RoomGameSummary'");
    expect(sources).toContain('<RoomGameSummary');
    expect(sources).not.toContain('<RoomGuideButton');
    expect(sources).not.toContain('<BoardInfoCard');
    expect(sources).not.toContain('className="room-game-summary');
  });

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
