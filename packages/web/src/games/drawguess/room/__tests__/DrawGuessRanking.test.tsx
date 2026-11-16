import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DrawGuessRanking } from '../components/DrawGuessRanking';
import type { DrawGuessScoreboardRow } from '../components/DrawGuessScoreboard';

const rows: readonly DrawGuessScoreboardRow[] = [
  {
    seat: 0,
    displayName: '小满',
    isBot: false,
    isDrawer: false,
    isSelf: true,
    roundScore: 15,
    totalScore: 120,
  },
  {
    seat: 1,
    displayName: '阿青',
    isBot: false,
    isDrawer: false,
    isSelf: false,
    roundScore: 10,
    totalScore: 120,
  },
  {
    seat: 2,
    displayName: '木木',
    isBot: false,
    isDrawer: false,
    isSelf: false,
    roundScore: 0,
    totalScore: 90,
  },
];

describe('DrawGuessRanking', () => {
  it('opens the live cumulative leaderboard, preserves ties, and closes on Escape', async () => {
    const user = userEvent.setup();
    render(<DrawGuessRanking rows={rows} />);

    const trigger = screen.getByRole('button', { name: '总排名' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);

    expect(await screen.findByRole('heading', { name: '本局总排名' })).toBeInTheDocument();
    expect(screen.getAllByText('🥇')).toHaveLength(2);
    expect(screen.getByText('90 分')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('heading', { name: '本局总排名' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
