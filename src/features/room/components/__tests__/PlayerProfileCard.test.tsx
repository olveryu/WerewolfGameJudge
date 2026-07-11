import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { RoomProfileCardModel } from '@/features/room/model/RoomProfile';
import type { UserPublicProfile } from '@/services/feature/StatsService';

import { PlayerProfileCard } from '../PlayerProfileCard';

const mockUseUserProfileQuery = jest.fn<unknown, unknown[]>();
jest.mock('@/hooks/queries/useUserProfileQuery', () => ({
  useUserProfileQuery: (...args: unknown[]) => mockUseUserProfileQuery(...args),
}));

function createModel(overrides: Partial<RoomProfileCardModel> = {}): RoomProfileCardModel {
  return {
    target: {
      seat: 2,
      userId: 'bot-2',
      occupantKind: 'bot',
      rosterName: '机器人3号',
    },
    isSelf: false,
    onClose: jest.fn(),
    onKick: jest.fn(),
    onLeaveSeat: null,
    resolveBuiltinAvatarName: (avatarId) => avatarId,
    gameDetails: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseUserProfileQuery.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
  });
});

describe('PlayerProfileCard', () => {
  it('uses explicit occupant kind for a bot and does not issue a profile query', () => {
    const view = render(<PlayerProfileCard model={createModel()} />);

    expect(view.getByText('机器人3号')).toBeTruthy();
    expect(view.getByText('机器人')).toBeTruthy();
    expect(mockUseUserProfileQuery).toHaveBeenCalledWith(
      'bot-2',
      expect.objectContaining({ enabled: false }),
    );
  });

  it('does not infer bot identity from a userId prefix', () => {
    render(
      <PlayerProfileCard
        model={createModel({
          target: {
            seat: 2,
            userId: 'bot-looking-human-id',
            occupantKind: 'human',
            rosterName: '真人玩家',
          },
        })}
      />,
    );

    expect(mockUseUserProfileQuery).toHaveBeenCalledWith(
      'bot-looking-human-id',
      expect.objectContaining({ enabled: true }),
    );
  });

  it('shows kick only when the executable capability is present', () => {
    const withKick = render(<PlayerProfileCard model={createModel()} />);
    expect(withKick.getByText('移出座位')).toBeTruthy();
    withKick.unmount();

    const withoutKick = render(<PlayerProfileCard model={createModel({ onKick: null })} />);
    expect(withoutKick.queryByText('移出座位')).toBeNull();
  });

  it('renders public profile data and the game-owned details slot', () => {
    const profile: UserPublicProfile = {
      displayName: 'Alice',
      xp: 100,
      level: 2,
      title: '',
      gamesPlayed: 5,
      unlockedItemCount: 3,
      campStats: { total: 0, counts: { wolf: 0, god: 0, villager: 0, third: 0 } },
    };
    mockUseUserProfileQuery.mockReturnValue({
      data: profile,
      isLoading: false,
      isError: false,
    });

    const view = render(
      <PlayerProfileCard
        model={createModel({
          target: {
            seat: 1,
            userId: 'user-abc',
            occupantKind: 'human',
            rosterName: 'Alice',
          },
          gameDetails: {
            title: '阵营分布',
            render: () => <Text>狼人杀阵营详情</Text>,
          },
        })}
      />,
    );

    expect(view.getByText('Alice')).toBeTruthy();
    expect(view.getByText('狼人杀阵营详情')).toBeTruthy();
  });
});
