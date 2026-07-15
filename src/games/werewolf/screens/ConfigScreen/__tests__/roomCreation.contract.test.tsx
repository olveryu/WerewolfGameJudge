/**
 * Contract test: Room creation → navigation roomCode consistency
 *
 * Verifies that ConfigScreen creates the room record in DB BEFORE navigating,
 * and the roomCode passed to RoomScreen matches the confirmed DB record —
 * never a pre-generated local code that might differ after 409 retry.
 */

import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { useServices } from '@/contexts/ServiceContext';
import type { RoomCreationRequest, RoomRecord } from '@/features/room/model/RoomDirectory';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';
import { ConfigScreen } from '@/games/werewolf/screens/ConfigScreen/ConfigScreen';

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
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
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

const createMockClient = (): WerewolfGameClient =>
  ({
    roomSession: {
      getSnapshot: () => idleRoomSnapshot,
      subscribe: jest.fn(() => () => undefined),
    },
    assignRoles: jest.fn(),
    updateTemplate: jest.fn().mockResolvedValue({ success: true }),
    startNight: jest.fn(),
    restartGame: jest.fn(),
    markViewedRole: jest.fn(),
    submitAction: jest.fn(),
    submitRevealAck: jest.fn(),
    setAudioPlaying: jest.fn(),
  }) as unknown as WerewolfGameClient;

function renderConfigScreen() {
  const mockClient = createMockClient();
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
      settingsService: {
        load: jest.fn().mockResolvedValue(undefined),
        setBgmEnabled: jest.fn().mockResolvedValue(undefined),
        isBgmEnabled: jest.fn().mockReturnValue(true),
        getBgmTrack: jest.fn().mockReturnValue('random'),
        toggleBgm: jest.fn(),
        addListener: jest.fn().mockReturnValue(jest.fn()),
      },
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
    expect(createRequest).not.toHaveProperty('buildInitialState');
    expect(createRequest).not.toHaveProperty('initialState');
  });

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
