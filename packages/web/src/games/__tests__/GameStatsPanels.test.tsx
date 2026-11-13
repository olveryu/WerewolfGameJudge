import type { AvalonPublicStats } from '@game-judge/game-engine/games/avalon/public';
import type { DrawGuessPublicStats } from '@game-judge/game-engine/games/drawguess/public';
import type { FibPublicStats } from '@game-judge/game-engine/games/fibking/public';
import type { PictionaryPublicStats } from '@game-judge/game-engine/games/pictionary/public';
import type { StoryRelayPublicStats } from '@game-judge/game-engine/games/storyrelay/public';
import type { UndercoverPublicStats } from '@game-judge/game-engine/games/undercover/public';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { AvalonStatsPanel } from '@/games/avalon/components/AvalonStatsPanel';
import { DrawGuessStatsPanel } from '@/games/drawguess/components/DrawGuessStatsPanel';
import { FibStatsPanel } from '@/games/fibking/components/FibStatsPanel';
import { PictionaryStatsPanel } from '@/games/pictionary/components/PictionaryStatsPanel';
import { StoryRelayStatsPanel } from '@/games/storyrelay/components/StoryRelayStatsPanel';
import { UndercoverStatsPanel } from '@/games/undercover/components/UndercoverStatsPanel';

interface StatsQueryMock<TStats> {
  data: TStats | undefined;
  isPending: boolean;
  isError: boolean;
}

const mocks = vi.hoisted(() => {
  const query = <TStats,>(): StatsQueryMock<TStats> => ({
    data: undefined,
    isPending: false,
    isError: false,
  });
  return {
    avalon: query<AvalonPublicStats>(),
    drawguess: query<DrawGuessPublicStats>(),
    fibking: query<FibPublicStats>(),
    pictionary: query<PictionaryPublicStats>(),
    storyrelay: query<StoryRelayPublicStats>(),
    undercover: query<UndercoverPublicStats>(),
  };
});

vi.mock('@/games/avalon/hooks/useAvalonPublicStats', () => ({
  useAvalonPublicStats: () => mocks.avalon,
}));
vi.mock('@/games/drawguess/hooks/useDrawGuessPublicStats', () => ({
  useDrawGuessPublicStats: () => mocks.drawguess,
}));
vi.mock('@/games/fibking/hooks/useFibPublicStats', () => ({
  useFibPublicStats: () => mocks.fibking,
}));
vi.mock('@/games/pictionary/hooks/usePictionaryPublicStats', () => ({
  usePictionaryPublicStats: () => mocks.pictionary,
}));
vi.mock('@/games/storyrelay/hooks/useStoryRelayPublicStats', () => ({
  useStoryRelayPublicStats: () => mocks.storyrelay,
}));
vi.mock('@/games/undercover/hooks/useUndercoverPublicStats', () => ({
  useUndercoverPublicStats: () => mocks.undercover,
}));

function resetMocks() {
  for (const result of Object.values(mocks)) {
    result.data = undefined;
    result.isPending = false;
    result.isError = false;
  }
}

beforeEach(resetMocks);

describe('game-owned account statistics panels', () => {
  it('shows Avalon faction outcomes and expandable per-role wins', () => {
    mocks.avalon.data = {
      gameType: 'avalon',
      gamesPlayed: 1,
      roles: [
        { role: 'merlin', gamesPlayed: 1, wins: 1 },
        { role: 'assassin', gamesPlayed: 1, wins: 0 },
      ],
    };

    render(<AvalonStatsPanel userId="user-1" />);
    const factions = screen.getByRole('region', { name: '阿瓦隆阵营胜率' });
    expect(within(factions).getByText('好人')).toBeInTheDocument();
    expect(within(factions).getByText('1胜/1局')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/各身份胜率/));
    expect(screen.getByText('梅林')).toBeInTheDocument();
    expect(screen.getByText('刺客')).toBeInTheDocument();
  });

  it('shows Undercover role-specific win ratios', () => {
    mocks.undercover.data = {
      gameType: 'undercover',
      gamesPlayed: 2,
      roles: [
        { role: 'civilian', gamesPlayed: 1, wins: 1 },
        { role: 'undercover', gamesPlayed: 1, wins: 0 },
      ],
    };

    render(<UndercoverStatsPanel userId="user-1" />);
    const roleStats = screen.getByRole('region', { name: '谁是卧底各身份胜率' });
    expect(roleStats).toHaveTextContent(/平民.*1胜\/1局/);
    expect(roleStats).toHaveTextContent(/卧底.*0胜\/1局/);
    expect(roleStats).toHaveTextContent(/白板.*0胜\/0局/);
  });

  it('shows FibKing role distribution as raw rounds and counts', () => {
    mocks.fibking.data = {
      gameType: 'fibking',
      gamesPlayed: 4,
      guesserRounds: 2,
      honestRounds: 1,
      fibberRounds: 1,
      honestFoundRounds: 1,
      honestRevealedRounds: 0,
      fibberRevealedCount: 1,
    };

    render(<FibStatsPanel userId="user-1" />);
    expect(screen.getByText('大聪明 · 找到老实人')).toBeInTheDocument();
    expect(screen.getByText('瞎掰王 · 被误选')).toBeInTheDocument();
    expect(screen.getByText('2轮')).toBeInTheDocument();
    expect(screen.getByText('1次')).toBeInTheDocument();
  });

  it('shows DrawGuess attempts, timing, and received reactions', () => {
    mocks.drawguess.data = {
      gameType: 'drawguess',
      gamesPlayed: 1,
      guessAttempts: 5,
      guessRounds: 2,
      guessedRounds: 1,
      guessTimeMs: 12000,
      guessTimedRounds: 1,
      drawingRounds: 1,
      guessedDrawingRounds: 1,
      totalScore: 80,
      flowersReceived: 2,
      eggsReceived: 1,
      tomatoesReceived: 0,
    };

    render(<DrawGuessStatsPanel userId="user-1" />);
    expect(screen.getByText('猜词次数')).toBeInTheDocument();
    expect(screen.getByText('5次')).toBeInTheDocument();
    expect(screen.getByText('12.0秒')).toBeInTheDocument();
    expect(screen.getByText('累计收到')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows Pictionary creation totals without a win-rate metric', () => {
    mocks.pictionary.data = {
      gameType: 'pictionary',
      gamesPlayed: 3,
      textSubmissions: 6,
      drawingSubmissions: 5,
    };

    render(<PictionaryStatsPanel userId="user-1" />);
    expect(screen.getByText('写词')).toBeInTheDocument();
    expect(screen.getByText('6次')).toBeInTheDocument();
    expect(screen.queryByText(/胜率/)).toBeNull();
  });

  it('shows Story Relay paragraph submissions', () => {
    mocks.storyrelay.data = {
      gameType: 'storyrelay',
      gamesPlayed: 2,
      paragraphsSubmitted: 7,
    };

    render(<StoryRelayStatsPanel userId="user-1" />);
    expect(screen.getByText('写下的段落')).toBeInTheDocument();
    expect(screen.getByText('7段')).toBeInTheDocument();
  });
});
