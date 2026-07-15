import { PRESET_TEMPLATES } from '@werewolf/game-engine/models/Template';

import {
  getWerewolfBoardsByVersion,
  WEREWOLF_BOARD_VERSIONS_DESC,
} from '@/games/werewolf/home/boardAnnouncements';

describe('getWerewolfBoardsByVersion', () => {
  it('accounts for every preset board exactly once in descending release order', () => {
    const groups = getWerewolfBoardsByVersion(PRESET_TEMPLATES);

    expect(groups.map((group) => group.version)).toEqual(WEREWOLF_BOARD_VERSIONS_DESC);
    expect(groups.flatMap((group) => group.boards)).toHaveLength(PRESET_TEMPLATES.length);
    expect(new Set(groups.flatMap((group) => group.boards.map((board) => board.name))).size).toBe(
      PRESET_TEMPLATES.length,
    );
  });

  it('fails when release metadata references a board outside the supplied catalog', () => {
    expect(() => getWerewolfBoardsByVersion(PRESET_TEMPLATES.slice(1))).toThrow(
      '[FAIL-FAST] Werewolf board release metadata references',
    );
  });
});
