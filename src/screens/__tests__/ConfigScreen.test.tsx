import React from 'react';
import { render } from '@testing-library/react-native';
import { ConfigScreen } from '../ConfigScreen/ConfigScreen';

// Mock navigation
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    replace: mockReplace,
    goBack: mockGoBack,
  }),
  useRoute: () => ({
    params: {},
  }),
}));

// Mock useRoom hook
const mockCreateRoom = jest.fn();

jest.mock('../../hooks/useRoom', () => ({
  useRoom: () => ({
    createRoom: mockCreateRoom,
    loading: false,
    error: null,
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
jest.mock('../../utils/alert', () => ({
  showAlert: jest.fn(),
}));

describe('ConfigScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render preset template buttons', () => {
      const { getByText } = render(<ConfigScreen />);
      
      // Check for common preset templates - actual UI uses "标准板12人"
      expect(getByText('标准板12人')).toBeTruthy();
    });

    it('should render role selection sections', () => {
      const { getByText } = render(<ConfigScreen />);
      
      // Check for role sections - actual UI uses these labels with emoji
      expect(getByText('✨ 神职')).toBeTruthy();
      expect(getByText('快速模板')).toBeTruthy();
    });

    it('should render create button', () => {
      const { getByText } = render(<ConfigScreen />);
      
      // Actual UI has "创建" button, not "开始游戏"
      expect(getByText('创建')).toBeTruthy();
    });

    it('should render screen title', () => {
      const { getByText } = render(<ConfigScreen />);
      
      expect(getByText('创建房间')).toBeTruthy();
    });
  });

  describe('Template Selection', () => {
    it('should render multiple template options', () => {
      const { getByText } = render(<ConfigScreen />);
      
      // Verify template options are rendered
      expect(getByText('标准板12人')).toBeTruthy();
      expect(getByText('狼美守卫12人')).toBeTruthy();
      expect(getByText('狼王守卫12人')).toBeTruthy();
    });
  });

  describe('Role Selection', () => {
    it('should render role chips', () => {
      const { getByText } = render(<ConfigScreen />);
      
      // Find role chips
      expect(getByText('女巫')).toBeTruthy();
      expect(getByText('预言家')).toBeTruthy();
      expect(getByText('猎人')).toBeTruthy();
    });
  });

  describe('Player Count', () => {
    it('should display player count', () => {
      const { getByText } = render(<ConfigScreen />);
      
      // Check that player count is shown
      expect(getByText(/名玩家/)).toBeTruthy();
    });
  });

  describe('Navigation', () => {
    it('should render back button', () => {
      const { getByText } = render(<ConfigScreen />);
      
      // Back button shows "←"
      expect(getByText('←')).toBeTruthy();
    });
  });
});
