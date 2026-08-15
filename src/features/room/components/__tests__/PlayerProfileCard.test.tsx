import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { UserPublicProfile } from '@/features/account/services/accountApi';
import { ClientProductUiProvider } from '@/features/product/context/ClientProductUiContext';
import type { ClientProductUi } from '@/features/product/model/ClientProductUi';
import type { RoomProfileCardModel } from '@/features/room/model/RoomProfile';

import { PlayerProfileCard } from '../PlayerProfileCard';

const mockUseUserProfileQuery = jest.fn<unknown, unknown[]>();
jest.mock('@/features/account/queries/useUserProfileQuery', () => ({
  useUserProfileQuery: (...args: unknown[]) => mockUseUserProfileQuery(...args),
}));

const productUi: ClientProductUi = {
  getAvatarDisplayName: (avatarId) => avatarId,
  getRevealEffectPresentation: (effectId) => {
    if (effectId !== 'random') {
      throw new Error(`[FAIL-FAST] Unexpected profile reveal effect: ${effectId}`);
    }
    return {
      id: 'random',
      label: '随机',
      icon: 'shuffle-outline',
      shortDescription: '每局随机一种揭晓动画',
      Preview: () => null,
    };
  },
};

function renderProfile(model: RoomProfileCardModel) {
  return render(
    <ClientProductUiProvider value={productUi}>
      <PlayerProfileCard model={model} />
    </ClientProductUiProvider>,
  );
}

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
    const view = renderProfile(createModel());

    expect(view.getByText('机器人3号')).toBeTruthy();
    expect(view.getByText('机器人')).toBeTruthy();
    expect(mockUseUserProfileQuery).toHaveBeenCalledWith(
      'bot-2',
      expect.objectContaining({ enabled: false }),
    );
  });

  it('does not infer bot identity from a userId prefix', () => {
    renderProfile(
      createModel({
        target: {
          seat: 2,
          userId: 'bot-looking-human-id',
          occupantKind: 'human',
          rosterName: '真人玩家',
        },
      }),
    );

    expect(mockUseUserProfileQuery).toHaveBeenCalledWith(
      'bot-looking-human-id',
      expect.objectContaining({ enabled: true }),
    );
  });

  it('shows kick only when the executable capability is present', () => {
    const withKick = renderProfile(createModel());
    expect(withKick.getByText('移出座位')).toBeTruthy();
    withKick.unmount();

    const withoutKick = renderProfile(createModel({ onKick: null }));
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
    };
    mockUseUserProfileQuery.mockReturnValue({
      data: profile,
      isLoading: false,
      isError: false,
    });

    const view = renderProfile(
      createModel({
        target: {
          seat: 1,
          userId: 'user-abc',
          occupantKind: 'human',
          rosterName: 'Alice',
        },
        gameDetails: {
          title: '阵营分布',
          content: <Text>狼人杀阵营详情</Text>,
        },
      }),
    );

    expect(view.getByText('Alice')).toBeTruthy();
    expect(view.getByText('狼人杀阵营详情')).toBeTruthy();
  });

  it('shows the next XP threshold above the former level cap', () => {
    const profile: UserPublicProfile = {
      displayName: 'Alice',
      xp: 4_500,
      level: 52,
      title: '神话',
      gamesPlayed: 100,
      unlockedItemCount: 3,
    };
    mockUseUserProfileQuery.mockReturnValue({
      data: profile,
      isLoading: false,
      isError: false,
    });

    const view = renderProfile(
      createModel({
        target: {
          seat: 1,
          userId: 'user-abc',
          occupantKind: 'human',
          rosterName: 'Alice',
        },
      }),
    );

    expect(view.getByText('4500 / 4560')).toBeTruthy();
  });

  it('renders the random reveal-effect selection without treating it as a reward item', () => {
    const profile: UserPublicProfile = {
      displayName: 'Alice',
      revealEffect: 'random',
      xp: 100,
      level: 2,
      title: '新手',
      gamesPlayed: 5,
      unlockedItemCount: 3,
    };
    mockUseUserProfileQuery.mockReturnValue({
      data: profile,
      isLoading: false,
      isError: false,
    });

    const view = renderProfile(
      createModel({
        target: {
          seat: 1,
          userId: 'user-abc',
          occupantKind: 'human',
          rosterName: 'Alice',
        },
      }),
    );

    expect(view.getByText('随机')).toBeTruthy();
    view.unmount();
  });
});
