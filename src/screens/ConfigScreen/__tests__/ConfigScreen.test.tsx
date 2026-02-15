import { render } from '@testing-library/react-native';
import React from 'react';

import { GameFacadeProvider } from '@/contexts/GameFacadeContext';
import { ConfigScreen } from '@/screens/ConfigScreen/ConfigScreen';
import type { IGameFacade } from '@/services/types/IGameFacade';

// Mock navigation
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    replace: mockReplace,
    goBack: mockGoBack,
    addListener: jest.fn(() => jest.fn()),
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
jest.mock('../../../utils/alert', () => ({
  showAlert: jest.fn(),
}));

// Mock services used by useGameRoom (now called from ConfigScreen)
jest.mock('../../../services/infra/RoomService');
jest.mock('../../../services/infra/AuthService');

// Mock facade for testing
const createMockFacade = (): IGameFacade =>
  ({
    addListener: jest.fn(() => jest.fn()),
    getState: jest.fn(() => null),
    isHostPlayer: jest.fn(() => false),
    getMyUid: jest.fn(() => null),
    getMySeatNumber: jest.fn(() => null),
    getStateRevision: jest.fn(() => 0),
    createRoom: jest.fn(),
    joinRoom: jest.fn().mockResolvedValue({ success: true }),
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
    endNight: jest.fn(),
    setAudioPlaying: jest.fn(),
    requestSnapshot: jest.fn(),
    postProgression: jest.fn(),
    fetchStateFromDB: jest.fn(),
    sendWolfRobotHunterStatusViewed: jest.fn(),
    get wasAudioInterrupted() {
      return false;
    },
    resumeAfterRejoin: jest.fn(),
    fillWithBots: jest.fn(),
    markAllBotsViewed: jest.fn(),
    setRoleRevealAnimation: jest.fn(),
    addConnectionStatusListener: jest.fn(() => jest.fn()),
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

      // Template title in header shows short display name + arrow
      expect(getByText(/标准板/)).toBeTruthy();
    });

    it('should render role selection sections', () => {
      const { getByText, getByTestId } = renderWithFacade(<ConfigScreen />);

      // Check for faction tabs in tab bar (use testID to avoid emoji encoding issues)
      expect(getByTestId('config-faction-tab-villager')).toBeTruthy();
      expect(getByTestId('config-faction-tab-wolf')).toBeTruthy();
      expect(getByTestId('config-faction-tab-special')).toBeTruthy();
      // Active tab (good) shows its section title
      expect(getByText('神职')).toBeTruthy();
    });

    it('should render create button at bottom', () => {
      const { getByText } = renderWithFacade(<ConfigScreen />);

      // Bottom sticky button shows "创建房间"
      expect(getByText('创建房间')).toBeTruthy();
    });

    it('should render header with player count and gear button', () => {
      const { getByText, getByTestId } = renderWithFacade(<ConfigScreen />);

      // Header shows player count
      expect(getByText(/\d+人/)).toBeTruthy();
      // Gear button for settings
      expect(getByTestId('config-gear-btn')).toBeTruthy();
    });
  });

  describe('Template Selection', () => {
    it('should render template dropdown in header with default selected', () => {
      const { getByText } = renderWithFacade(<ConfigScreen />);

      // Template title in header shows short name + arrow indicator
      expect(getByText(/标准板/)).toBeTruthy();
    });
  });

  describe('Role Selection', () => {
    it('should render role chips for active tab', () => {
      const { getByText, getByTestId } = renderWithFacade(<ConfigScreen />);

      // Default active tab is good — god role chips should be visible
      expect(getByText('女巫')).toBeTruthy();
      expect(getByText('预言家')).toBeTruthy();
      expect(getByTestId('config-stepper-dec-villager')).toBeTruthy();
    });
  });

  describe('Navigation', () => {
    it('should render back button', () => {
      const { getByTestId } = renderWithFacade(<ConfigScreen />);

      // Back button renders chevron-back icon
      expect(getByTestId('Ionicons-icon-chevron-back')).toBeTruthy();
    });
  });
});
