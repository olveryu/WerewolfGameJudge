import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { RoomStageHud } from '@/features/room/components/RoomStageHud';
import { seatSource } from '@/test-utils/roomSeat';

import { DrawGuessRankingSheet } from '../components/DrawGuessRanking';
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

/** The room wiring: the shared HUD draws the entry, the game owns the sheet it opens. */
function RankingHarness() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <RoomStageHud
        hud={{
          chips: [],
          roster: null,
          timer: null,
          secondaryChips: [{ key: 'score', label: '我 0 分', detail: null, tone: 'neutral' }],
        }}
        seats={seatSource([])}
        canTakeOverBots={{ isAllowed: false, reason: null }}
        controlledSeat={null}
        action={{ label: '总排名', isOpen, onOpen: () => setIsOpen(true) }}
      />
      {isOpen && <DrawGuessRankingSheet rows={rows} onClose={() => setIsOpen(false)} />}
    </>
  );
}

describe('DrawGuessRankingSheet', () => {
  it('opens the live cumulative leaderboard, preserves ties, and closes on Escape', async () => {
    const user = userEvent.setup();
    render(<RankingHarness />);

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
