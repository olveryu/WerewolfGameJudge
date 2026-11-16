/** 计分板：按总分排序、结算双列、自己一行高亮、终局不渲染本轮段。 */

import { render, screen } from '@testing-library/react';

import {
  DrawGuessScoreboard,
  type DrawGuessScoreboardRow,
} from '../components/DrawGuessScoreboard';

const rows: readonly DrawGuessScoreboardRow[] = [
  {
    seat: 0,
    displayName: '画手',
    isBot: false,
    isDrawer: true,
    isSelf: false,
    roundScore: 50,
    totalScore: 300,
  },
  {
    seat: 1,
    displayName: '我',
    isBot: false,
    isDrawer: false,
    isSelf: true,
    roundScore: 20,
    totalScore: 300,
  },
  {
    seat: 2,
    displayName: '后来者',
    isBot: false,
    isDrawer: false,
    isSelf: false,
    roundScore: 100,
    totalScore: 100,
  },
];

describe('DrawGuessScoreboard', () => {
  it('sorts by total score and shares the competition rank on a tie', () => {
    render(<DrawGuessScoreboard title="本轮得分" competitionRanking rows={rows} />);
    expect(screen.getAllByText('🥇')).toHaveLength(2);
    expect(screen.getByText('🥉')).toBeInTheDocument();
    const names = screen
      .getAllByRole('listitem')
      .map((item) => item.querySelector('.drawguess-scoreboard-name')?.textContent);
    expect(names).toEqual(['画手 · 画手', '我', '后来者']);
  });

  it('renders the round gain and the total on each settlement row', () => {
    render(<DrawGuessScoreboard title="本轮得分" competitionRanking={false} rows={rows} />);
    expect(screen.getByText('+50 · 总分 300')).toBeInTheDocument();
    expect(screen.getByText('+20 · 总分 300')).toBeInTheDocument();
    expect(screen.getByText('+100 · 总分 100')).toBeInTheDocument();
  });

  it('marks the viewer row and renders totals only on the final board', () => {
    render(
      <DrawGuessScoreboard
        title="最终排名"
        competitionRanking
        rows={rows.map((row) => ({ ...row, roundScore: null }))}
      />,
    );
    expect(screen.getByText('我')).toHaveAttribute('aria-current', 'true');
    expect(screen.getAllByText('300 分')).toHaveLength(2);
    expect(screen.queryByText(/总分/)).toBeNull();
  });

  it('shows received reaction counts under each player when a settlement supplies them', () => {
    render(
      <DrawGuessScoreboard
        title="最终排名"
        competitionRanking
        reactionCountLabel="本局收到"
        rows={[
          {
            ...rows[0]!,
            reactionCounts: { flower: 2, egg: 1, tomato: 0 },
          },
        ]}
      />,
    );

    expect(screen.getByText('本局收到：鲜花 2 · 鸡蛋 1 · 番茄 0')).toBeInTheDocument();
  });
});
