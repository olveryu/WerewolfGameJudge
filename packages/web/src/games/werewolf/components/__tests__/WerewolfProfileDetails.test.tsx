import { render, screen } from '@testing-library/react';

import { useWerewolfPublicStats } from '@/games/werewolf/hooks/useWerewolfPublicStats';

import { WerewolfProfileDetails } from '../WerewolfProfileDetails';

vi.mock('@/games/werewolf/hooks/useWerewolfPublicStats', () => ({
  useWerewolfPublicStats: vi.fn(),
}));

const mockUseWerewolfPublicStats = vi.mocked(useWerewolfPublicStats);

describe('WerewolfProfileDetails', () => {
  beforeEach(() => {
    mockUseWerewolfPublicStats.mockReset();
  });

  it('renders the game-owned camp statistics for the profile user', () => {
    mockUseWerewolfPublicStats.mockReturnValue({
      data: {
        gameType: 'werewolf',
        campStats: { total: 4, counts: { wolf: 2, god: 1, villager: 1, third: 0 } },
      },
      isPending: false,
      isError: false,
    } as ReturnType<typeof useWerewolfPublicStats>);

    render(<WerewolfProfileDetails userId="user-1" />);

    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(mockUseWerewolfPublicStats).toHaveBeenCalledWith('user-1');
  });

  it('shows a specific error state instead of substituting empty statistics', () => {
    mockUseWerewolfPublicStats.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    } as ReturnType<typeof useWerewolfPublicStats>);

    render(<WerewolfProfileDetails userId="user-1" />);

    expect(screen.getByText('阵营统计加载失败')).toBeInTheDocument();
    expect(screen.queryByText('暂无阵营数据')).toBeNull();
  });
});
