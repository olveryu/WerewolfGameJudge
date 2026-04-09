import { render } from '@testing-library/react-native';

import { SettingsScreen } from '@/screens/SettingsScreen/SettingsScreen';

// Mock navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    addListener: jest.fn(() => jest.fn()),
  }),
  useRoute: () => ({ params: undefined }),
}));

// Mock useAuth hook - default to unauthenticated state
jest.mock('../../../contexts/AuthContext', () => ({
  useAuthContext: () => ({
    user: null,
    loading: false,
    error: null,
    signOut: jest.fn(),
    updateProfile: jest.fn(),
    uploadAvatar: jest.fn(),
    signInAnonymously: jest.fn(),
  }),
}));

// Mock utils
jest.mock('../../../utils/alert', () => ({
  ...jest.requireActual('../../../utils/alert'),
  showAlert: jest.fn(),
}));

jest.mock('../../../utils/avatar', () => ({
  AVATAR_IMAGES: Array.from({ length: 8 }, (_, i) => i),
  isBuiltinAvatarUrl: jest.fn(() => false),
  getBuiltinAvatarImage: jest.fn(() => 1),
  getAvatarImageByIndex: jest.fn(() => 1),
  getAvatarThumbByIndex: jest.fn(() => 1),
}));

jest.mock('../../../utils/defaultAvatarIcons', () => ({
  getAvatarIcon: jest.fn(() => ({
    image: 1,
    color: '#C0392B',
  })),
}));

// Mock GameFacadeContext — SettingsScreen calls facade methods for room state and profile sync
jest.mock('../../../contexts/GameFacadeContext', () => ({
  useGameFacade: () => ({
    getState: jest.fn().mockReturnValue(null),
    getMySeatNumber: jest.fn().mockReturnValue(null),
    subscribe: jest.fn().mockReturnValue(() => {}),
    updateMyUid: jest.fn(),
    updatePlayerProfile: jest.fn().mockResolvedValue({ success: true }),
  }),
}));

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render screen title', () => {
      const { getByText } = render(<SettingsScreen />);

      expect(getByText('设置')).toBeTruthy();
    });

    it('should render account section', () => {
      const { getByText, getAllByTestId } = render(<SettingsScreen />);

      expect(getAllByTestId('Ionicons-icon-person-outline').length).toBeGreaterThan(0);
      expect(getByText(/账户/)).toBeTruthy();
    });

    it('should render back button', () => {
      const { getByTestId } = render(<SettingsScreen />);

      expect(getByTestId('Ionicons-icon-chevron-back')).toBeTruthy();
    });
  });

  describe('Unauthenticated State', () => {
    it('should show login options when not authenticated', () => {
      const { getByText } = render(<SettingsScreen />);

      // Unauthenticated state shows inline LoginOptions
      expect(getByText(/邮箱登录/)).toBeTruthy();
      expect(getByText(/匿名登录/)).toBeTruthy();
    });
  });

  describe('Navigation', () => {
    it('should render navigation controls', () => {
      const { getByTestId } = render(<SettingsScreen />);

      // Back button should be present
      expect(getByTestId('Ionicons-icon-chevron-back')).toBeTruthy();
    });
  });
});
