/**
 * Contract test: Room creation → navigation roomCode consistency
 *
 * Verifies that ConfigScreen creates the room record in DB BEFORE navigating,
 * and the roomCode passed to RoomScreen matches the confirmed DB record —
 * never a pre-generated local code that might differ after 409 retry.
 */

import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { RECENT_ROOM_CODES_KEY } from '@/config/storageKeys';
import { useServices } from '@/contexts/ServiceContext';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';
import { WerewolfGameProvider } from '@/games/werewolf/runtime/WerewolfGameContext';
import { ConfigScreen } from '@/screens/ConfigScreen/ConfigScreen';
import type { CreateRoomRequest, RoomRecord } from '@/services/types/IRoomDirectoryService';

// Access the jest-mocked useServices to override return values per test
const mockUseServices = useServices as jest.Mock;

// Mock useCreateRoom mutation hook
const mockCreateRoomMutateAsync = jest.fn<
  Promise<RoomRecord & { creationId: string }>,
  [CreateRoomRequest]
>();
const mockAcknowledgeRoomCreation = jest.fn();
jest.mock('@/hooks/mutations/useRoomMutations', () => ({
  useCreateRoom: () => ({
    mutateAsync: mockCreateRoomMutateAsync,
    isPending: false,
  }),
}));

// Mock navigation
const mockNavigate = jest.fn<
  void,
  [string, { roomCode: string; isHost: boolean; template: unknown }]
>();
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
jest.mock('@/lib/storage', () => ({
  storage: {
    getString: jest.fn(() => undefined),
    set: jest.fn(),
    remove: jest.fn(),
  },
}));

jest.mock('../../../utils/alert', () => ({
  ...jest.requireActual<typeof import('../../../utils/alert')>('../../../utils/alert'),
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

const createMockFacade = (): WerewolfGameClient =>
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

describe('Room creation → navigation roomCode contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mutation mock returns the room code allocated by the server saga.
    mockCreateRoomMutateAsync.mockResolvedValue({
      roomCode: '7777',
      roomId: 'room-id-7777',
      gameType: 'werewolf',
      hostUserId: 'test-uid',
      createdAt: new Date(),
      creationId: 'creation-id-7777',
    });

    // Override global ServiceContext mock with test-specific services
    mockUseServices.mockReturnValue({
      authService: {
        waitForInit: jest.fn().mockResolvedValue(undefined),
      },
      roomDirectory: { acknowledgeRoomCreation: mockAcknowledgeRoomCreation },
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
    const mockFacade = createMockFacade();
    const { getByText } = render(
      <WerewolfGameProvider client={mockFacade}>
        <ConfigScreen />
      </WerewolfGameProvider>,
    );

    // Press the create room button (default template has roles pre-selected)
    const createButton = getByText('创建房间');
    fireEvent.press(createButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });

    // CRITICAL CONTRACT: The roomCode passed to navigation MUST be the one
    // returned by createRoomMutation.mutateAsync (the confirmed DB record), not a
    // locally pre-generated code.
    const navArgs = mockNavigate.mock.calls[0];
    if (navArgs === undefined) throw new Error('Missing room navigation call');
    expect(navArgs[0]).toBe('Room');
    expect(navArgs[1].roomCode).toBe('7777');
    expect(navArgs[1]).toEqual({ roomCode: '7777', entryReason: 'created' });
    const createRequest = mockCreateRoomMutateAsync.mock.calls[0]?.[0];
    if (createRequest === undefined) throw new Error('Missing create-room request');
    expect(createRequest.expectedHostUserId).toBe('test-uid');
    expect(createRequest.gameType).toBe('werewolf');
    expect(Array.isArray(createRequest.config.templateRoles)).toBe(true);
    expect(createRequest).not.toHaveProperty('buildInitialState');
    expect(createRequest).not.toHaveProperty('initialState');
  });

  it('should NOT navigate when createRoomRecord fails', async () => {
    // Simulate DB creation failure
    mockCreateRoomMutateAsync.mockRejectedValueOnce(new Error('服务未配置'));

    const mockFacade = createMockFacade();
    const { getByText } = render(
      <WerewolfGameProvider client={mockFacade}>
        <ConfigScreen />
      </WerewolfGameProvider>,
    );

    const createButton = getByText('创建房间');
    fireEvent.press(createButton);

    // Wait for async to settle
    await waitFor(() => {
      // createRoomRecord returns null on error → showAlert → no navigation
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  it('should save confirmed roomCode to MMKV storage (not a pre-generated code)', async () => {
    const { storage } = require('@/lib/storage') as {
      storage: { set: jest.Mock; getString: jest.Mock };
    };
    storage.getString.mockReturnValue(undefined);
    const mockFacade = createMockFacade();
    const { getByText } = render(
      <WerewolfGameProvider client={mockFacade}>
        <ConfigScreen />
      </WerewolfGameProvider>,
    );

    const createButton = getByText('创建房间');
    fireEvent.press(createButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });

    // recentRoomCodes stored must contain the confirmed DB code
    expect(storage.set).toHaveBeenCalledWith(
      RECENT_ROOM_CODES_KEY,
      expect.stringContaining('7777'),
    );
  });

  it('acknowledges the creation intent after persisting the recent room', async () => {
    const mockFacade = createMockFacade();
    const { getByText } = render(
      <WerewolfGameProvider client={mockFacade}>
        <ConfigScreen />
      </WerewolfGameProvider>,
    );

    fireEvent.press(getByText('创建房间'));

    await waitFor(() => {
      expect(mockAcknowledgeRoomCreation).toHaveBeenCalledWith('creation-id-7777');
    });
  });
});
