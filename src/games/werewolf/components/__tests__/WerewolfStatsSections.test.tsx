import { render } from '@testing-library/react-native';

import { useWerewolfPublicStats } from '@/games/werewolf/hooks/useWerewolfPublicStats';

import { WerewolfAccountStatsSection } from '../WerewolfAccountStatsSection';
import { WerewolfProfileDetails } from '../WerewolfProfileDetails';

jest.mock('@/games/werewolf/hooks/useWerewolfPublicStats', () => ({
  useWerewolfPublicStats: jest.fn(),
}));

const mockUseWerewolfPublicStats = jest.mocked(useWerewolfPublicStats);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Werewolf stats sections', () => {
  it('renders the same game-owned statistics in profile and account surfaces', () => {
    mockUseWerewolfPublicStats.mockReturnValue({
      data: {
        gameType: 'werewolf',
        campStats: {
          total: 4,
          counts: { wolf: 2, god: 1, villager: 1, third: 0 },
        },
      },
      isPending: false,
      isError: false,
    } as ReturnType<typeof useWerewolfPublicStats>);

    const profile = render(<WerewolfProfileDetails userId="user-1" />);
    expect(profile.getByText('统计 4 局')).toBeTruthy();
    expect(profile.getByText('50%')).toBeTruthy();
    profile.unmount();

    const account = render(<WerewolfAccountStatsSection userId="user-1" />);
    expect(account.getByText('狼人杀阵营分布')).toBeTruthy();
    expect(account.getByText('4 局')).toBeTruthy();
    expect(mockUseWerewolfPublicStats).toHaveBeenCalledWith('user-1');
  });

  it('shows a specific error state instead of substituting empty statistics', () => {
    mockUseWerewolfPublicStats.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    } as ReturnType<typeof useWerewolfPublicStats>);

    const view = render(<WerewolfProfileDetails userId="user-1" />);
    expect(view.getByText('阵营统计加载失败')).toBeTruthy();
    expect(view.queryByText('暂无阵营数据')).toBeNull();
  });
});
