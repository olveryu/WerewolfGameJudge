import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { HomeScreen } from '@/screens/HomeScreen/HomeScreen';

// Mock navigation
const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  replace: jest.fn(),
  goBack: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

// Mock useAuth hook
const mockSignInAnonymously = jest.fn();
const mockSignUpWithEmail = jest.fn();
const mockSignInWithEmail = jest.fn();
const mockSignOut = jest.fn();

jest.mock('../../../contexts/AuthContext', () => ({
  useAuthContext: () => ({
    user: null,
    loading: false,
    error: null,
    signInAnonymously: mockSignInAnonymously,
    signUpWithEmail: mockSignUpWithEmail,
    signInWithEmail: mockSignInWithEmail,
    signOut: mockSignOut,
    updateProfile: jest.fn(),
    uploadAvatar: jest.fn(),
    signInWithWechat: jest.fn(),
    bindWechat: jest.fn(),
  }),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  multiGet: jest.fn(() => Promise.resolve([])),
}));

// Mock utils
jest.mock('../../../utils/alert', () => ({
  ...jest.requireActual('../../../utils/alert'),
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

      expect(getByText('大柠檬助手')).toBeTruthy();
    });

    it('should render settings button in top bar', () => {
      const { getByTestId } = render(<HomeScreen />);

      expect(getByTestId('home-settings-button')).toBeTruthy();
    });
  });

  describe('Navigation', () => {
    it('should navigate to Config screen when "创建房间" is pressed', async () => {
      // Set up authenticated user
      jest.spyOn(require('@/contexts/AuthContext'), 'useAuthContext').mockReturnValue({
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
        expect(mockNavigate).toHaveBeenCalledWith('BoardPicker');
      });
    });

    it('should navigate to Settings screen when settings is pressed', () => {
      const { getByTestId } = render(<HomeScreen />);

      fireEvent.press(getByTestId('home-settings-button'));

      expect(mockNavigate).toHaveBeenCalledWith('Settings');
    });
  });

  describe('Join Room Modal', () => {
    it('should show join room modal when "进入房间" is pressed', async () => {
      // Mock authenticated user
      jest.spyOn(require('@/contexts/AuthContext'), 'useAuthContext').mockReturnValue({
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
