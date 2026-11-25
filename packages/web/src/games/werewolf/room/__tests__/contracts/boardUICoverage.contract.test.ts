import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { BOARD_TEST_FILE_MAP, getAll12PBoards } from '@/games/werewolf/room/__tests__/harness';

const BOARD_UI_TEST_DIR = join(import.meta.dirname, '../boards');

describe('Werewolf board UI coverage', () => {
  const boards = getAll12PBoards();
  const files = readdirSync(BOARD_UI_TEST_DIR).filter((file) =>
    file.endsWith('.board.ui.test.tsx'),
  );

  it('maps every preset to exactly one board UI spec', () => {
    expect(new Set(Object.keys(BOARD_TEST_FILE_MAP))).toEqual(
      new Set(boards.map((board) => board.name)),
    );
    expect(new Set(Object.values(BOARD_TEST_FILE_MAP))).toEqual(new Set(files));
    expect(files).toHaveLength(boards.length);
  });

  it.each(boards)('$name exercises its real shared-step interactions', (board) => {
    const file = BOARD_TEST_FILE_MAP[board.name];
    if (file === undefined) throw new Error(`[TEST] No board UI spec for ${board.name}`);
    const source = readFileSync(join(BOARD_UI_TEST_DIR, file), 'utf8');
    expect(source).toContain(`collectBoardNightScenarios('${board.name}')`);
    expect(source).toMatch(/it\.each\(scenarios\)/);
    expect(source).toMatch(/await assertBoardNightScenario\(scenario\)/);
    expect(source).toMatch(/expect\.arrayContaining\(\[[\s\S]*?'wolfKill'/);
    expect(source).not.toMatch(/\b(?:it|test|describe)\.(?:skip|only)\s*\(/);
    expect(source).not.toMatch(/vi\.(?:mock|doMock)\(\s*['"]@\/utils\/alert['"]/);
  });
});
