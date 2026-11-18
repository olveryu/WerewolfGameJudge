import { DEFAULT_DRAWGUESS_CONFIG } from '@game-judge/game-engine/games/drawguess/public';

import { createDrawGuessRoomSummarySettings } from '../drawGuessRoomAdapter';

it('includes every fixed DrawGuess lobby rule', () => {
  expect(createDrawGuessRoomSummarySettings(DEFAULT_DRAWGUESS_CONFIG)).toEqual([
    { label: '每人轮数', value: '2 轮' },
    { label: '选词时限', value: '15 秒' },
    { label: '作画时限', value: '90 秒' },
    { label: '提示间隔', value: '20 秒' },
    { label: '结算展示', value: '8 秒' },
  ]);
});
