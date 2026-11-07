/** The DrawGuess result presentation shared by the in-room boards and the review. */

import { DRAWGUESS_DRAWER_ZEROED_NOTE } from '../../room/components/DrawGuessDrawerZeroedNote';
import {
  DRAWGUESS_DRAWER_ZEROED_DETAIL,
  DRAWGUESS_DRAWER_ZEROED_TITLE,
  formatDrawGuessScore,
  rankDrawGuessScores,
} from '../drawGuessResults';

describe('rankDrawGuessScores', () => {
  it('ranks by total score, sharing a rank on a tie and skipping the next', () => {
    const ranked = rankDrawGuessScores([
      { seat: 0, totalScore: 300 },
      { seat: 1, totalScore: 300 },
      { seat: 2, totalScore: 100 },
      { seat: 3, totalScore: 500 },
    ]);
    expect(ranked).toEqual([
      { seat: 3, totalScore: 500, rank: 1 },
      { seat: 0, totalScore: 300, rank: 2 },
      { seat: 1, totalScore: 300, rank: 2 },
      { seat: 2, totalScore: 100, rank: 4 },
    ]);
  });

  it('keeps tied seats in the order they were given', () => {
    expect(
      rankDrawGuessScores([
        { seat: 2, totalScore: 0 },
        { seat: 0, totalScore: 0 },
      ]).map((entry) => [entry.seat, entry.rank]),
    ).toEqual([
      [2, 1],
      [0, 1],
    ]);
  });
});

describe('DrawGuess result copy', () => {
  it('formats a score and composes the all-guessed note from its parts', () => {
    expect(formatDrawGuessScore(120)).toBe('120 分');
    expect(DRAWGUESS_DRAWER_ZEROED_NOTE).toBe(
      `${DRAWGUESS_DRAWER_ZEROED_TITLE}：${DRAWGUESS_DRAWER_ZEROED_DETAIL}`,
    );
    expect(DRAWGUESS_DRAWER_ZEROED_NOTE).toBe('全员猜中：画得太简单了，画手本轮 0 分');
  });
});
