import {
  DEFAULT_DRAWGUESS_CONFIG,
  DRAWGUESS_CONFIG_SCHEMA,
} from '@game-judge/game-engine/games/drawguess/public';

import { resolveConfigIssue } from '@/features/room/config/gameConfigFormModel';

describe('DrawGuess config form', () => {
  it('accepts 20 players and rejects 21', () => {
    expect(
      resolveConfigIssue(
        DRAWGUESS_CONFIG_SCHEMA,
        { ...DEFAULT_DRAWGUESS_CONFIG, numberOfPlayers: 20 },
        {},
      ),
    ).toBeNull();
    expect(
      resolveConfigIssue(
        DRAWGUESS_CONFIG_SCHEMA,
        { ...DEFAULT_DRAWGUESS_CONFIG, numberOfPlayers: 21 },
        {},
      ),
    ).toEqual({ field: 'numberOfPlayers', message: '玩家人数需为 4 至 20 的整数' });
  });
});
