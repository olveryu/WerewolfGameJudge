import { fireEvent, render } from '@testing-library/react-native';

import type { useAuthContext } from '@/contexts/AuthContext';
import { FashionConfigScreen } from '@/games/fashion-shadow/screens/ConfigScreen/FashionConfigScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockCreateRoom = jest.fn();
const mockHasCompletedFashionTutorial = jest.fn(() => false);
const mockUseAuthContext = jest.fn<ReturnType<typeof useAuthContext>, []>();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
  useRoute: () => ({
    params: { gameType: 'fashion-shadow', mode: 'create' },
  }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

jest.mock('@/features/room/controllers/useRoomCreationController', () => ({
  useRoomCreationController: () => ({
    createRoom: mockCreateRoom,
    isCreating: false,
  }),
}));

jest.mock('@/games/fashion-shadow/tutorial/tutorialProgress', () => ({
  hasCompletedFashionTutorial: () => mockHasCompletedFashionTutorial(),
  markFashionTutorialCompleted: jest.fn(),
}));

const authenticatedUser: NonNullable<ReturnType<typeof useAuthContext>['user']> = {
  id: 'fashion-user',
  email: null,
  displayName: 'Fashion Tester',
  avatarUrl: null,
  customAvatarUrl: null,
  avatarFrame: null,
  seatFlair: null,
  nameStyle: null,
  equippedEffect: null,
  seatAnimation: null,
  isAnonymous: true,
};

function authContext(
  user: ReturnType<typeof useAuthContext>['user'],
): ReturnType<typeof useAuthContext> {
  return {
    user,
    loading: false,
    error: null,
    isAuthenticated: user !== null,
    needsWechatLogin: false,
    refreshUser: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    retryInit: jest.fn<void, []>(),
  };
}

describe('FashionConfigScreen auth boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasCompletedFashionTutorial.mockReturnValue(false);
    mockCreateRoom.mockReturnValue(new Promise(() => undefined));
  });

  it('requires authentication before starting the tutorial from a direct config entry', () => {
    mockUseAuthContext.mockReturnValue(authContext(null));

    const ui = render(<FashionConfigScreen />);
    fireEvent.press(ui.getByText('登录后开始 5 分钟新手关卡'));

    expect(mockNavigate).toHaveBeenCalledWith('AuthLogin', {
      loginTitle: '登录后开始新手关卡',
      loginSubtitle: '完成 5 分钟训练后即可创建 7 人房间',
    });
    expect(ui.queryByText('打开牛皮纸信封')).toBeNull();
  });

  it('starts the tutorial immediately for an authenticated user', () => {
    mockUseAuthContext.mockReturnValue(authContext(authenticatedUser));

    const ui = render(<FashionConfigScreen />);
    fireEvent.press(ui.getByText('开始 5 分钟新手关卡'));

    expect(ui.getByText('打开牛皮纸信封')).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalledWith('AuthLogin', expect.anything());
  });

  it('creates the fixed seven-player Fashion Shadow room after tutorial completion', () => {
    mockUseAuthContext.mockReturnValue(authContext(authenticatedUser));
    mockHasCompletedFashionTutorial.mockReturnValue(true);

    const ui = render(<FashionConfigScreen />);
    fireEvent.press(ui.getByText('创建 7 人房间'));

    expect(mockCreateRoom).toHaveBeenCalledWith({
      expectedHostUserId: 'fashion-user',
      gameType: 'fashion-shadow',
      config: { numberOfPlayers: 7 },
    });
  });
});
