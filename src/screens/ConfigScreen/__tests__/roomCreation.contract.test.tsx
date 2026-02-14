/**
 * Contract test: Room creation → navigation roomNumber consistency
 *
 * Verifies that ConfigScreen creates the room record in DB BEFORE navigating,
 * and the roomNumber passed to RoomScreen matches the confirmed DB record —
 * never a pre-generated local code that might differ after 409 retry.
 */

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { GameFacadeProvider } from '@/contexts/GameFacadeContext';
import { useServices } from '@/contexts/ServiceContext';
import { ConfigScreen } from '@/screens/ConfigScreen/ConfigScreen';
import type { IGameFacade } from '@/services/types/IGameFacade';

// Access the jest-mocked useServices to override return values per test
const mockUseServices = useServices as jest.Mock;

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
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

jest.mock('../../../utils/alert', () => ({
  showAlert: jest.fn(),
}));

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
    endNight: jest.fn(),
    setAudioPlaying: jest.fn(),
    requestSnapshot: jest.fn(),
    addConnectionStatusListener: jest.fn(() => jest.fn()),
  }) as unknown as IGameFacade;

describe('Room creation → navigation roomNumber contract', () => {
  let mockRoomService: { createRoom: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    // RoomService mock — simulate 409 retry: returned roomNumber differs from any pre-generated code
    mockRoomService = {
      createRoom: jest.fn().mockResolvedValue({
        roomNumber: '7777', // The confirmed DB roomNumber
        hostUid: 'host-uid',
        createdAt: new Date(),
      }),
    };

    // Override global ServiceContext mock with test-specific services
    mockUseServices.mockReturnValue({
      authService: {
        waitForInit: jest.fn().mockResolvedValue(undefined),
        getCurrentUserId: jest.fn().mockReturnValue('host-uid'),
        getCurrentDisplayName: jest.fn().mockResolvedValue('Test Host'),
        getCurrentAvatarUrl: jest.fn().mockResolvedValue(null),
      },
      roomService: mockRoomService,
      settingsService: {
        load: jest.fn().mockResolvedValue(undefined),
        getRoleRevealAnimation: jest.fn().mockReturnValue('random'),
        setRoleRevealAnimation: jest.fn().mockResolvedValue(undefined),
        setBgmEnabled: jest.fn().mockResolvedValue(undefined),
        isBgmEnabled: jest.fn().mockReturnValue(true),
        toggleBgm: jest.fn(),
        getThemeKey: jest.fn().mockReturnValue('dark'),
        setThemeKey: jest.fn(),
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

  it('should navigate with the roomNumber returned by createRoomRecord, not a pre-generated code', async () => {
    const mockFacade = createMockFacade();
    const { getByText } = render(
      <GameFacadeProvider facade={mockFacade}>
        <ConfigScreen />
      </GameFacadeProvider>,
    );

    // Press the create room button (default template has roles pre-selected)
    const createButton = getByText('创建房间');
    fireEvent.press(createButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });

    // CRITICAL CONTRACT: The roomNumber passed to navigation MUST be the one
    // returned by RoomService.createRoom (the confirmed DB record), not a
    // locally pre-generated code.
    const navArgs = mockNavigate.mock.calls[0];
    expect(navArgs[0]).toBe('Room');
    expect(navArgs[1].roomNumber).toBe('7777');
    expect(navArgs[1].isHost).toBe(true);
    expect(navArgs[1].template).toBeDefined();
  });

  it('should NOT navigate when createRoomRecord fails', async () => {
    // Simulate DB creation failure
    mockRoomService.createRoom.mockRejectedValueOnce(new Error('服务未配置'));

    const mockFacade = createMockFacade();
    const { getByText } = render(
      <GameFacadeProvider facade={mockFacade}>
        <ConfigScreen />
      </GameFacadeProvider>,
    );

    const createButton = getByText('创建房间');
    fireEvent.press(createButton);

    // Wait for async to settle
    await waitFor(() => {
      // createRoomRecord returns null on error → showAlert → no navigation
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  it('should save confirmed roomNumber to AsyncStorage (not a pre-generated code)', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    const mockFacade = createMockFacade();
    const { getByText } = render(
      <GameFacadeProvider facade={mockFacade}>
        <ConfigScreen />
      </GameFacadeProvider>,
    );

    const createButton = getByText('创建房间');
    fireEvent.press(createButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });

    // lastRoomNumber stored must match the confirmed DB code
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('lastRoomNumber', '7777');
  });
});
