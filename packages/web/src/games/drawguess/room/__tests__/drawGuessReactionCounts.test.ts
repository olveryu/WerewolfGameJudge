import type { DrawGuessTurnRecord } from '@game-judge/game-engine/games/drawguess/public';

import {
  countDrawGuessReactionReceiptsByDrawer,
  countDrawGuessRoundReactionReceipts,
} from '../../model/drawGuessReactionCounts';

describe('DrawGuess received reaction counts', () => {
  it('counts this round’s reactions for its drawer', () => {
    expect(countDrawGuessRoundReactionReceipts({ 1: 'flower', 2: 'egg', 3: 'flower' })).toEqual({
      flower: 2,
      egg: 1,
      tomato: 0,
    });
  });

  it('accumulates completed-turn reactions for each receiving drawer, not the senders', () => {
    const turns: readonly Pick<DrawGuessTurnRecord, 'drawerSeat' | 'reactionsBySeat'>[] = [
      { drawerSeat: 0, reactionsBySeat: { 1: 'flower', 2: 'egg' } },
      { drawerSeat: 1, reactionsBySeat: { 0: 'tomato', 2: 'flower' } },
      { drawerSeat: 0, reactionsBySeat: { 3: 'tomato' } },
    ];

    expect(countDrawGuessReactionReceiptsByDrawer(turns)).toEqual({
      0: { flower: 1, egg: 1, tomato: 1 },
      1: { flower: 1, egg: 0, tomato: 1 },
    });
  });
});
