/** Avalon fail-threshold rules: the double-fail round pins the deciding literals. */

import { getAvalonFailsNeeded } from '../domain/rules';
import {
  AVALON_DOUBLE_FAIL_QUEST_ROUND,
  AVALON_DOUBLE_FAILS_NEEDED,
  AVALON_FOURTH_QUEST_DOUBLE_FAIL_MIN_PLAYERS,
  AVALON_QUESTS_TO_WIN,
} from '../state/types';

describe('Avalon fail thresholds', () => {
  it('requires the double-fail count only on the double-fail round at or above the player floor', () => {
    expect(
      getAvalonFailsNeeded(
        AVALON_FOURTH_QUEST_DOUBLE_FAIL_MIN_PLAYERS,
        AVALON_DOUBLE_FAIL_QUEST_ROUND,
      ),
    ).toBe(AVALON_DOUBLE_FAILS_NEEDED);
    expect(AVALON_DOUBLE_FAILS_NEEDED).toBe(2);
    expect(AVALON_DOUBLE_FAIL_QUEST_ROUND).toBe(4);
  });

  it('requires one fail on every other round or below the player floor', () => {
    expect(getAvalonFailsNeeded(7, 3)).toBe(1);
    expect(getAvalonFailsNeeded(6, 4)).toBe(1);
    expect(getAvalonFailsNeeded(10, 5)).toBe(1);
  });

  it('wins a side at the quest majority', () => {
    expect(AVALON_QUESTS_TO_WIN).toBe(3);
  });
});
