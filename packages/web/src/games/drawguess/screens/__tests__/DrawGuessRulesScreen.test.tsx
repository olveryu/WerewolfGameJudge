/**
 * DrawGuess guide copy contract: every number in the guide comes from the
 * engine constants that decide it; changing a constant moves the copy.
 */

import {
  DRAWGUESS_ALL_GUESSED_REMAINING_SECONDS,
  DRAWGUESS_DRAWER_FLAT_AFTER_FIRST,
  DRAWGUESS_DRAWER_ROUND_CAP,
  DRAWGUESS_DRAWING_DURATION_SECONDS,
  DRAWGUESS_FIRST_GUESS_REMAINING_CAP_SECONDS,
  DRAWGUESS_GUESS_BASE_SCORE,
  DRAWGUESS_GUESS_SPEED_BONUS_MAX,
  DRAWGUESS_HINT_REVEAL_INTERVAL_SECONDS,
  DRAWGUESS_MAX_PLAYERS,
  DRAWGUESS_MIN_PLAYERS,
  DRAWGUESS_ROUND_END_SECONDS,
  DRAWGUESS_ROUNDS_PER_DRAWER,
  DRAWGUESS_WORD_CHOICE_COUNT,
  DRAWGUESS_WORD_SELECT_SECONDS,
} from '@game-judge/game-engine/games/drawguess/public';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { DrawGuessRulesScreen } from '../DrawGuessRulesScreen';

describe('DrawGuessRulesScreen', () => {
  it('renders timing and scoring numbers from the engine constants', () => {
    render(
      <MemoryRouter>
        <DrawGuessRulesScreen />
      </MemoryRouter>,
    );
    const view = screen;
    expect(view.getByText(`画手 ${DRAWGUESS_WORD_CHOICE_COUNT} 选 1`)).toBeVisible();
    expect(
      view.getByText(
        `支持 ${DRAWGUESS_MIN_PLAYERS} 至 ${DRAWGUESS_MAX_PLAYERS} 人。轮到你当画手时，从 ${DRAWGUESS_WORD_CHOICE_COUNT} 个候选词里选 1 个作画，${DRAWGUESS_WORD_SELECT_SECONDS} 秒内没选则由系统随机指派。每人按座位顺序轮流画 ${DRAWGUESS_ROUNDS_PER_DRAWER} 轮。`,
      ),
    ).toBeVisible();
    expect(view.getByText(`${DRAWGUESS_DRAWING_DURATION_SECONDS} 秒作画`)).toBeVisible();
    expect(
      view.getByText(
        `画手有 ${DRAWGUESS_DRAWING_DURATION_SECONDS} 秒作画。第一人猜中后剩余时间最多留 ${DRAWGUESS_FIRST_GUESS_REMAINING_CAP_SECONDS} 秒；除画手外全部猜中后 ${DRAWGUESS_ALL_GUESSED_REMAINING_SECONDS} 秒结束本轮。画布提供画笔、橡皮、直线、矩形、椭圆和填充工具；作画不许写字、写数字，这是房间规则。`,
      ),
    ).toBeVisible();
    expect(
      view.getByText(
        `猜中得 ${DRAWGUESS_GUESS_BASE_SCORE} 分保底 + 最高 ${DRAWGUESS_GUESS_SPEED_BONUS_MAX} 分速度加成：开局即猜中得 ${DRAWGUESS_GUESS_BASE_SCORE + DRAWGUESS_GUESS_SPEED_BONUS_MAX} 分，压哨猜中得 ${DRAWGUESS_GUESS_BASE_SCORE} 分。速度按作画开始时间计算，倒计时被压缩不影响得分。`,
      ),
    ).toBeVisible();
    expect(view.getByText('画手得分看难度')).toBeVisible();
    expect(
      view.getByText(
        `首个猜中者得分的一半归画手，之后每多一人猜中加 ${DRAWGUESS_DRAWER_FLAT_AFTER_FIRST} 分，单轮封顶 ${DRAWGUESS_DRAWER_ROUND_CAP} 分；全员猜中则画手本轮 0 分（画得太简单）。无人猜中则画手 0 分。`,
      ),
    ).toBeVisible();
    expect(
      view.getByText(
        `猜题者看到题目字数和拼音首字母占位（如「3个字 · d _ _」），每 ${DRAWGUESS_HINT_REVEAL_INTERVAL_SECONDS} 秒揭示一个首字母，始终至少留一个不揭示。`,
      ),
    ).toBeVisible();
    expect(
      view.getByText(
        `作画倒计时结束后公布答案，结算展示 ${DRAWGUESS_ROUND_END_SECONDS} 秒后自动进入下一轮。房主可在主持管理中中止本局，清除本局画作、猜词记录和比分，保留座位和设置并返回大厅，不发完成奖励。`,
      ),
    ).toBeVisible();
  });
});
