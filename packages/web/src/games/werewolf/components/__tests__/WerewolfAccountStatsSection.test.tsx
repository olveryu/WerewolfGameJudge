import { render, screen } from '@testing-library/react';

import { useWerewolfPublicStats } from '@/games/werewolf/hooks/useWerewolfPublicStats';

import { WerewolfAccountStatsSection } from '../WerewolfAccountStatsSection';

vi.mock('@/games/werewolf/hooks/useWerewolfPublicStats', () => ({
  useWerewolfPublicStats: vi.fn(),
}));

const mockUseWerewolfPublicStats = vi.mocked(useWerewolfPublicStats);

describe('WerewolfAccountStatsSection', () => {
  beforeEach(() => {
    mockUseWerewolfPublicStats.mockReset();
  });

  it('renders the account user camp statistics', () => {
    mockUseWerewolfPublicStats.mockReturnValue({
      data: {
        gameType: 'werewolf',
        campStats: { total: 4, counts: { wolf: 2, god: 1, villager: 1, third: 0 } },
      },
      isPending: false,
      isError: false,
    } as ReturnType<typeof useWerewolfPublicStats>);

    render(<WerewolfAccountStatsSection userId="user-1" />);

    expect(screen.getByRole('heading', { name: '狼人杀阵营分布' })).toBeInTheDocument();
    expect(screen.getByText('4 局')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(mockUseWerewolfPublicStats).toHaveBeenCalledWith('user-1');
  });

  it('shows a specific error state instead of substituting empty statistics', () => {
    mockUseWerewolfPublicStats.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    } as ReturnType<typeof useWerewolfPublicStats>);

    render(<WerewolfAccountStatsSection userId="user-1" />);

    expect(screen.getByText('阵营统计加载失败')).toBeInTheDocument();
  });
});
