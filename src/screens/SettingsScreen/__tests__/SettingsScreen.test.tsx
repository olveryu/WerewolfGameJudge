import { render } from '@testing-library/react-native';
import React from 'react';

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

// Mock SafeAreaContext
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

// Mock utils
jest.mock('../../../utils/alert', () => ({
  ...jest.requireActual('../../../utils/alert'),
  showAlert: jest.fn(),
}));

jest.mock('../../../utils/avatar', () => ({
  getAvatarImage: jest.fn(() => ({ uri: 'https://example.com/avatar.png' })),
  isBuiltinAvatarUrl: jest.fn(() => false),
  getBuiltinAvatarImage: jest.fn(() => 1),
  makeBuiltinAvatarUrl: jest.fn(
    (i: number) => `builtin://villager_${String(i + 1).padStart(3, '0')}`,
  ),
  BUILTIN_AVATAR_PREFIX: 'builtin://',
  AVATAR_IMAGES: [],
  AVATAR_CATEGORIES: [{ key: 'human', label: '👤 人物', start: 0, end: 0 }],
  getAvatarImageByIndex: jest.fn(() => 1),
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

      // Unauthenticated state shows login options
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
