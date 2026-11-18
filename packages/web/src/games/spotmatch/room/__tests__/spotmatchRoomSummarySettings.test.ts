import { DEFAULT_SPOTMATCH_CONFIG } from '@game-judge/game-engine/games/spotmatch/public';

import { createSpotmatchRoomSummarySettings } from '../spotmatchRoomAdapter';

it('shows the Spotmatch card count and untimed race rule', () => {
  expect(
    createSpotmatchRoomSummarySettings({
      ...DEFAULT_SPOTMATCH_CONFIG,
      cardsPerPlayer: 15,
    }),
  ).toEqual([
    { label: '每人牌数', value: '15 张' },
    { label: '比赛时限', value: '不限时' },
  ]);
});
