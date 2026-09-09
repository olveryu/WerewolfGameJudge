/**
 * Contract test: Room creation → navigation roomCode consistency
 *
 * Verifies that ConfigScreen creates the room record in DB BEFORE navigating,
 * and the roomCode passed to RoomScreen matches the confirmed DB record —
 * never a pre-generated local code that might differ after 409 retry.
 */

import type { GameRuleOverrides } from '@game-judge/game-engine/games/werewolf/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { fireEvent, render, waitFor, within } from '@testing-library/react-native';

import { useServices } from '@/contexts/ServiceContext';
import type { RoomCreationRequest, RoomRecord } from '@/features/room/model/RoomDirectory';
import { SettingsService } from '@/features/settings/services/SettingsService';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';
import { ConfigScreen } from '@/games/werewolf/screens/ConfigScreen/ConfigScreen';
import { successfulRoomCommand } from '@/test-utils/roomCommand';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';
import { TESTIDS } from '@/testids';

// Access the jest-mocked useServices to override return values per test
const mockUseServices = useServices as jest.Mock;

// Mock the complete shared room-creation saga at the screen boundary.
const mockCreateRoom = jest.fn<Promise<RoomRecord>, [RoomCreationRequest]>();
jest.mock('@/features/room/controllers/useRoomCreationController', () => ({
  useRoomCreationController: () => ({ createRoom: mockCreateRoom, isCreating: false }),
}));

// Mock navigation
const mockNavigate = jest.fn();
const mockOnRoomCreated = jest.fn();
let mockSettingsService: SettingsService;
let mockRouteParams: {
  presetName?: string;
  existingRoomCode?: string;
  updatedRules?: GameRuleOverrides;
} = {
  presetName: '预女猎白',
};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  }),
  useRoute: () => ({
    params: mockRouteParams,
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

jest.mock('@/utils/alert', () => ({
  ...jest.requireActual<typeof import('@/utils/alert')>('@/utils/alert'),
  showAlert: jest.fn(),
}));

const idleRoomSnapshot = {
  phase: 'idle' as const,
  epoch: 0,
  identity: null,
  connection: 'disconnected' as const,
  snapshot: null,
  lastCommand: null,
  error: null,
};

const createMockClient = (): WerewolfGameClient => {
  const commandResult = successfulRoomCommand(buildWerewolfTestState());
  return {
    roomSession: {
      getSnapshot: () => idleRoomSnapshot,
      subscribe: jest.fn(() => () => undefined),
    },
    assignRoles: jest.fn(),
    updateTemplate: jest.fn().mockResolvedValue(commandResult),
    startNight: jest.fn(),
    restartGame: jest.fn(),
    markViewedRole: jest.fn(),
    submitAction: jest.fn(),
    submitRevealAck: jest.fn(),
  } as unknown as WerewolfGameClient;
};

function renderConfigScreen(mockClient = createMockClient()) {
  return render(
    <ConfigScreen
      client={mockClient}
      onExitFlow={jest.fn()}
      onReturnToRoom={jest.fn()}
      onRoomCreated={mockOnRoomCreated}
    />,
  );
}

describe('Room creation → navigation roomCode contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = { presetName: '预女猎白' };
    mockSettingsService = new SettingsService();

    // Mutation mock returns the room code allocated by the server saga.
    mockCreateRoom.mockResolvedValue({
      roomCode: '7777',
      roomId: 'room-id-7777',
      gameType: 'werewolf',
      hostUserId: 'test-uid',
      createdAt: new Date(),
    });

    // Override global ServiceContext mock with test-specific services
    mockUseServices.mockReturnValue({
      authService: {
        waitForInit: jest.fn().mockResolvedValue(undefined),
      },
      settingsService: mockSettingsService,
      audioService: {
        startBgm: jest.fn().mockResolvedValue(undefined),
        stopBgm: jest.fn(),
        cleanup: jest.fn(),
      },
      avatarUploadService: { uploadAvatar: jest.fn() },
    });
  });

  it('should navigate with the roomCode returned by createRoomRecord, not a pre-generated code', async () => {
    const { getByText } = renderConfigScreen();

    // Press the create room button (default template has roles pre-selected)
    const createButton = getByText('创建房间');
    fireEvent.press(createButton);

    await waitFor(() => {
      expect(mockOnRoomCreated).toHaveBeenCalledTimes(1);
    });

    // CRITICAL CONTRACT: The roomCode passed to navigation MUST be the one
    // returned by createRoomMutation.mutateAsync (the confirmed DB record), not a
    // locally pre-generated code.
    expect(mockOnRoomCreated).toHaveBeenCalledWith('7777');
    const createRequest = mockCreateRoom.mock.calls[0]?.[0];
    if (createRequest === undefined) throw new Error('Missing create-room request');
    expect(createRequest.expectedHostUserId).toBe('test-uid');
    expect(createRequest.gameType).toBe('werewolf');
    expect(Array.isArray(createRequest.config.templateRoles)).toBe(true);
    expect(createRequest.config.rules).toEqual({ isSheriffElectionEnabled: true });
    expect(createRequest).not.toHaveProperty('buildInitialState');
    expect(createRequest).not.toHaveProperty('initialState');
  });

  it('submits the independent sheriff switch without changing mode and role rules', async () => {
    mockRouteParams = {
      presetName: '预女猎白',
      updatedRules: {
        isSheriffElectionEnabled: true,
        witchCanSelfHeal: true,
        isPlagueMode: true,
      },
    };
    const { getByText, getByTestId } = renderConfigScreen();
    const sheriffSwitch = getByTestId(TESTIDS.gameRuleSwitch('isSheriffElectionEnabled'));
    const rulesEntry = within(getByTestId(TESTIDS.configGameRulesButton));

    expect(sheriffSwitch.props.value).toBe(true);
    expect(rulesEntry.getByText('2')).toBeTruthy();
    fireEvent(sheriffSwitch, 'valueChange', false);
    expect(getByTestId(TESTIDS.gameRuleSwitch('isSheriffElectionEnabled')).props.value).toBe(false);
    expect(rulesEntry.getByText('2')).toBeTruthy();

    expect(mockSettingsService.isSheriffElectionEnabled()).toBe(false);
    fireEvent.press(getByText('创建房间'));

    await waitFor(() => expect(mockCreateRoom).toHaveBeenCalledTimes(1));
    expect(mockCreateRoom.mock.calls[0]?.[0].config.rules).toEqual({
      isSheriffElectionEnabled: false,
      witchCanSelfHeal: true,
      isPlagueMode: true,
    });
  });

  it('remembers the switch immediately for the next new room without remembering other rules', async () => {
    mockRouteParams = {
      presetName: '预女猎白',
      updatedRules: { isSheriffElectionEnabled: true, witchCanSelfHeal: true, isPlagueMode: true },
    };
    const screen = renderConfigScreen();

    fireEvent(
      screen.getByTestId(TESTIDS.gameRuleSwitch('isSheriffElectionEnabled')),
      'valueChange',
      false,
    );
    expect(mockSettingsService.isSheriffElectionEnabled()).toBe(false);
    expect(mockCreateRoom).not.toHaveBeenCalled();
    screen.unmount();

    mockRouteParams = { presetName: '预女猎白' };
    const nextScreen = renderConfigScreen();
    expect(
      nextScreen.getByTestId(TESTIDS.gameRuleSwitch('isSheriffElectionEnabled')).props.value,
    ).toBe(false);
    fireEvent.press(nextScreen.getByText('创建房间'));

    await waitFor(() => expect(mockCreateRoom).toHaveBeenCalledTimes(1));
    expect(mockCreateRoom.mock.calls[0]?.[0].config.rules).toEqual({
      isSheriffElectionEnabled: false,
    });
  });

  it.each([true, false])(
    'uses the existing room sheriff setting %s instead of the local preference',
    async (isSheriffElectionEnabled) => {
      await mockSettingsService.setSheriffElectionEnabled(!isSheriffElectionEnabled);
      const state = buildWerewolfTestState({ rules: { isSheriffElectionEnabled } });
      const mockClient = createMockClient();
      const snapshot = {
        phase: 'ready' as const,
        epoch: 1,
        identity: {
          room: {
            roomCode: state.roomCode,
            roomId: 'room-id-1234',
            gameType: 'werewolf' as const,
            hostUserId: state.hostUserId,
            createdAt: new Date(),
          },
          userId: state.hostUserId,
        },
        connection: 'live' as const,
        pendingCommandCount: 0,
        lastRecoveredCommandRejection: null,
        snapshot: createRoomSnapshot(state, 1),
        lastCommand: null,
        error: null,
      };
      jest.spyOn(mockClient.roomSession, 'getSnapshot').mockReturnValue(snapshot);
      mockRouteParams = { existingRoomCode: state.roomCode };

      const screen = renderConfigScreen(mockClient);

      expect(
        screen.getByTestId(TESTIDS.gameRuleSwitch('isSheriffElectionEnabled')).props.value,
      ).toBe(isSheriffElectionEnabled);
      expect(mockSettingsService.isSheriffElectionEnabled()).toBe(!isSheriffElectionEnabled);
    },
  );

  it('should NOT navigate when createRoomRecord fails', async () => {
    // Simulate DB creation failure
    mockCreateRoom.mockRejectedValueOnce(new Error('服务未配置'));

    const { getByText } = renderConfigScreen();

    const createButton = getByText('创建房间');
    fireEvent.press(createButton);

    // Wait for async to settle
    await waitFor(() => {
      // A failed create operation never crosses the flow boundary.
      expect(mockOnRoomCreated).not.toHaveBeenCalled();
    });
  });
});
