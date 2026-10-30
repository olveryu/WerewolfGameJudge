import type {
  GameState,
  WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';
import { fireEvent, render } from '@testing-library/react-native';
import type React from 'react';

import type { WerewolfRoomSession } from '@/games/werewolf/model/WerewolfRoomSession';
import { ConfigScreen } from '@/games/werewolf/screens/ConfigScreen/ConfigScreen';
import { createFakeRoomLink, idleLinkSnapshot } from '@/test-utils/linkSnapshot';
import { successfulRoomCommand } from '@/test-utils/roomCommand';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';

// Mock navigation
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockGoBack = jest.fn();
let mockNavigationIndex = 0;
const flowCallbacks = {
  onExitFlow: jest.fn(),
  onReturnToRoom: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    replace: mockReplace,
    goBack: mockGoBack,
    getState: () => ({ index: mockNavigationIndex }),
    addListener: jest.fn(() => jest.fn()),
  }),
  useRoute: () => ({
    params: { presetName: '预女猎白' },
  }),
}));

// Mock MMKV storage
jest.mock('@/services/infra/localStorage', () => ({
  storage: {
    getString: jest.fn(() => undefined),
    set: jest.fn(),
    remove: jest.fn(),
  },
}));

// Mock utils
jest.mock('@/utils/alert', () => ({
  ...jest.requireActual<typeof import('@/utils/alert')>('@/utils/alert'),
  showAlert: jest.fn(),
}));

// Services are injected via DI (ServiceContext), no concrete mocks needed here.

const createMockSession = (): WerewolfRoomSession =>
  createFakeRoomLink<GameState, WerewolfPublicCommand>(idleLinkSnapshot<GameState>(), () =>
    Promise.resolve(successfulRoomCommand(buildWerewolfTestState())),
  );

const renderWithClient = (ui: React.ReactElement) => {
  return render(ui);
};

describe('ConfigScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigationIndex = 0;
  });

  describe('Rendering', () => {
    it('should render preset template buttons', () => {
      const { getByText } = renderWithClient(
        <ConfigScreen session={createMockSession()} {...flowCallbacks} />,
      );

      // Template title in header shows short display name + arrow
      expect(getByText(/预女猎白/)).toBeTruthy();
    });

    it('should render role selection sections', () => {
      const { getByText, getByTestId } = renderWithClient(
        <ConfigScreen session={createMockSession()} {...flowCallbacks} />,
      );

      // Check for faction tabs in tab bar (use testID to avoid emoji encoding issues)
      expect(getByTestId('config-faction-tab-Villager')).toBeTruthy();
      expect(getByTestId('config-faction-tab-Wolf')).toBeTruthy();
      expect(getByTestId('config-faction-tab-Special')).toBeTruthy();
      // Active tab (good) shows its section title
      expect(getByText('神职')).toBeTruthy();
    });

    it('should render the next-step button at bottom', () => {
      const { getByText } = renderWithClient(
        <ConfigScreen session={createMockSession()} {...flowCallbacks} />,
      );

      // Bottom sticky button leads to the rules step; creation happens there
      expect(getByText('下一步：规则')).toBeTruthy();
    });

    it('should render header with player count and reset button', () => {
      const { getByText, getByTestId } = renderWithClient(
        <ConfigScreen session={createMockSession()} {...flowCallbacks} />,
      );

      // Header shows player count
      expect(getByText(/\d+人/)).toBeTruthy();
      // Reset button for clearing selection
      expect(getByTestId('config-overflow-reset')).toBeTruthy();
    });
  });

  describe('Template Selection', () => {
    it('should render template dropdown in header with default selected', () => {
      const { getByText } = renderWithClient(
        <ConfigScreen session={createMockSession()} {...flowCallbacks} />,
      );

      // Template title in header shows short name + arrow indicator
      expect(getByText(/预女猎白/)).toBeTruthy();
    });
  });

  describe('Role Selection', () => {
    it('should render role chips for active tab', () => {
      const { getByText, getByTestId } = renderWithClient(
        <ConfigScreen session={createMockSession()} {...flowCallbacks} />,
      );

      // Default active tab is good -- god role chips should be visible
      expect(getByText('女巫')).toBeTruthy();
      expect(getByText('预言家')).toBeTruthy();
      expect(getByTestId('config-stepper-dec-villager')).toBeTruthy();
    });
  });

  describe('Navigation', () => {
    it('should render back button', () => {
      const { getByTestId } = renderWithClient(
        <ConfigScreen session={createMockSession()} {...flowCallbacks} />,
      );

      // Back button renders chevron-back icon
      expect(getByTestId('Ionicons-icon-chevron-back')).toBeTruthy();
    });

    it('exits through the explicit flow boundary at the first nested route', () => {
      const { getByTestId } = renderWithClient(
        <ConfigScreen session={createMockSession()} {...flowCallbacks} />,
      );

      fireEvent.press(getByTestId('config-back-button'));

      expect(flowCallbacks.onExitFlow).toHaveBeenCalledTimes(1);
      expect(mockGoBack).not.toHaveBeenCalled();
    });

    it('goes back inside the nested flow when a previous local route exists', () => {
      mockNavigationIndex = 1;
      const { getByTestId } = renderWithClient(
        <ConfigScreen session={createMockSession()} {...flowCallbacks} />,
      );

      fireEvent.press(getByTestId('config-back-button'));

      expect(mockGoBack).toHaveBeenCalledTimes(1);
      expect(flowCallbacks.onExitFlow).not.toHaveBeenCalled();
    });
  });
});
