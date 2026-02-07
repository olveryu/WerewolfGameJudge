import React from 'react';
import { render } from '@testing-library/react-native';
import SettingsScreen from '../SettingsScreen/SettingsScreen';

// Mock navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
}));

// Mock useAuth hook - default to unauthenticated state
jest.mock('../../hooks', () => ({
  useAuth: () => ({
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
jest.mock('../../utils/alert', () => ({
  showAlert: jest.fn(),
}));

jest.mock('../../utils/avatar', () => ({
  getAvatarImage: jest.fn(() => ({ uri: 'https://example.com/avatar.png' })),
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
      const { getByText } = render(<SettingsScreen />);

      expect(getByText('👤 账户')).toBeTruthy();
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
      expect(getByText('邮箱登录/注册')).toBeTruthy();
      expect(getByText('匿名登录')).toBeTruthy();
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
