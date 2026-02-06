import React from 'react';
import { render } from '@testing-library/react-native';
import { ConfigScreen } from '../ConfigScreen/ConfigScreen';
import { GameFacadeProvider } from '../../contexts/GameFacadeContext';
import type { IGameFacade } from '../../services/types/IGameFacade';

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

// Mock facade for testing
const createMockFacade = (): IGameFacade =>
  ({
    addListener: jest.fn(() => jest.fn()),
    getState: jest.fn(() => null),
    isHostPlayer: jest.fn(() => false),
    getMyUid: jest.fn(() => null),
    getMySeatNumber: jest.fn(() => null),
    getStateRevision: jest.fn(() => 0),
    initializeAsHost: jest.fn(),
    joinAsPlayer: jest.fn(),
    leaveRoom: jest.fn(),
    takeSeat: jest.fn(),
    takeSeatWithAck: jest.fn(),
    leaveSeat: jest.fn(),
    leaveSeatWithAck: jest.fn(),
    assignRoles: jest.fn(),
    updateTemplate: jest.fn().mockResolvedValue({ success: true }),
    startNight: jest.fn(),
    restartGame: jest.fn(),
    markViewedRole: jest.fn(),
    submitAction: jest.fn(),
    submitWolfVote: jest.fn(),
    submitRevealAck: jest.fn(),
    advanceNight: jest.fn(),
    endNight: jest.fn(),
    setAudioPlaying: jest.fn(),
    requestSnapshot: jest.fn(),
  }) as unknown as IGameFacade;

const renderWithFacade = (ui: React.ReactElement) => {
  const mockFacade = createMockFacade();
  return render(<GameFacadeProvider facade={mockFacade}>{ui}</GameFacadeProvider>);
};

describe('ConfigScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render preset template buttons', () => {
      const { getByText } = renderWithFacade(<ConfigScreen />);

      // Check for common preset templates - actual UI uses "标准板12人"
      expect(getByText('标准板12人')).toBeTruthy();
    });

    it('should render role selection sections', () => {
      const { getByText } = renderWithFacade(<ConfigScreen />);

      // Check for role sections - new UI uses faction cards
      expect(getByText('🐺 狼人阵营')).toBeTruthy();
      expect(getByText('👥 好人阵营')).toBeTruthy();
      expect(getByText('⚖️ 中立阵营')).toBeTruthy();
      expect(getByText('神职')).toBeTruthy();
    });

    it('should render create button in header', () => {
      const { getByText } = renderWithFacade(<ConfigScreen />);

      // Header right button shows "创建"
      expect(getByText('创建')).toBeTruthy();
    });

    it('should render header title and player count', () => {
      const { getByText } = renderWithFacade(<ConfigScreen />);

      // Header shows title and player count
      expect(getByText('创建房间')).toBeTruthy();
      expect(getByText(/\d+ 名玩家/)).toBeTruthy();
    });
  });

  describe('Template Selection', () => {
    it('should render template dropdown with default selected', () => {
      const { getByText } = renderWithFacade(<ConfigScreen />);

      // Template dropdown shows selected template name
      expect(getByText('标准板12人')).toBeTruthy();
      // Dropdown label
      expect(getByText('板子')).toBeTruthy();
    });
  });

  describe('Role Selection', () => {
    it('should render role chips', () => {
      const { getByText } = renderWithFacade(<ConfigScreen />);

      // Find role chips
      expect(getByText('女巫')).toBeTruthy();
      expect(getByText('预言家')).toBeTruthy();
      expect(getByText('猎人')).toBeTruthy();
    });
  });

  describe('Navigation', () => {
    it('should render back button', () => {
      const { getByText } = renderWithFacade(<ConfigScreen />);

      // Back button shows "←"
      expect(getByText('←')).toBeTruthy();
    });
  });
});
