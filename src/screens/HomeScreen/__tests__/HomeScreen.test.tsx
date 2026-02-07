import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { HomeScreen } from '../HomeScreen';

// Mock navigation
const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  replace: jest.fn(),
  goBack: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

// Mock useAuth hook
const mockSignInAnonymously = jest.fn();
const mockSignUpWithEmail = jest.fn();
const mockSignInWithEmail = jest.fn();
const mockSignOut = jest.fn();

jest.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    error: null,
    signInAnonymously: mockSignInAnonymously,
    signUpWithEmail: mockSignUpWithEmail,
    signInWithEmail: mockSignInWithEmail,
    signOut: mockSignOut,
    updateProfile: jest.fn(),
    uploadAvatar: jest.fn(),
  }),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

// Mock SafeAreaContext
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock utils
jest.mock('../../../utils/alert', () => ({
  showAlert: jest.fn(),
}));

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render main menu items', () => {
      const { getByText } = render(<HomeScreen />);

      expect(getByText('创建房间')).toBeTruthy();
      expect(getByText('进入房间')).toBeTruthy();
    });

    it('should render the app title', () => {
      const { getByText } = render(<HomeScreen />);

      expect(getByText('狼人杀法官')).toBeTruthy();
    });

    it('should render settings menu item', () => {
      const { getByText } = render(<HomeScreen />);

      expect(getByText('设置')).toBeTruthy();
    });
  });

  describe('Navigation', () => {
    it('should navigate to Config screen when "创建房间" is pressed', async () => {
      // Set up authenticated user
      jest.spyOn(require('../../../hooks/useAuth'), 'useAuth').mockReturnValue({
        user: { uid: 'test-user', displayName: 'Test' },
        loading: false,
        error: null,
        signInAnonymously: mockSignInAnonymously,
        signUpWithEmail: mockSignUpWithEmail,
        signInWithEmail: mockSignInWithEmail,
        signOut: mockSignOut,
        updateProfile: jest.fn(),
        uploadAvatar: jest.fn(),
      });

      const { getByText } = render(<HomeScreen />);

      fireEvent.press(getByText('创建房间'));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('Config');
      });
    });

    it('should navigate to Settings screen when settings is pressed', () => {
      const { getByText } = render(<HomeScreen />);

      fireEvent.press(getByText('设置'));

      expect(mockNavigate).toHaveBeenCalledWith('Settings');
    });
  });

  describe('Join Room Modal', () => {
    it('should show join room modal when "进入房间" is pressed', async () => {
      // Mock authenticated user
      jest.spyOn(require('../../../hooks/useAuth'), 'useAuth').mockReturnValue({
        user: { uid: 'test-user', displayName: 'Test' },
        loading: false,
        error: null,
        signInAnonymously: mockSignInAnonymously,
        signUpWithEmail: mockSignUpWithEmail,
        signInWithEmail: mockSignInWithEmail,
        signOut: mockSignOut,
        updateProfile: jest.fn(),
        uploadAvatar: jest.fn(),
      });

      const { getByText, queryByText } = render(<HomeScreen />);

      fireEvent.press(getByText('进入房间'));

      await waitFor(() => {
        expect(queryByText('输入4位房间号码')).toBeTruthy();
      });
    });
  });
});
