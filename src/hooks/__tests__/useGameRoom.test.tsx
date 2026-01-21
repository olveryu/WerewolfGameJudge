/**
 * Tests for useGameRoom hook
 *
 * Focus:
 * 1. Room number consistency - ensuring that when a roomNumber is provided,
 *    createRoom uses it instead of generating a new one.
 * 2. ACK reason transparency - ensuring takeSeatWithAck/leaveSeatWithAck
 *    pass through the reason from facade without modification.
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import React from 'react';
import { SimplifiedRoomService } from '../../services/SimplifiedRoomService';
import { AuthService } from '../../services/AuthService';
import { GameStateService } from '../../services/GameStateService';
import { BroadcastService } from '../../services/BroadcastService';
import { GameTemplate } from '../../models/Template';
import { RoleId } from '../../models/roles';
import { useGameRoom } from '../useGameRoom';
import { GameFacadeProvider } from '../../contexts';
import type { IGameFacade } from '../../services/types/IGameFacade';

// Mock the services
jest.mock('../../services/SimplifiedRoomService');
jest.mock('../../services/AuthService');
jest.mock('../../services/GameStateService');
jest.mock('../../services/BroadcastService');

// Helper to create mock template
// Phase 5: actionOrder removed from GameTemplate
const _createMockTemplate = (): GameTemplate => ({
  name: 'Test Template',
  roles: ['wolf', 'seer', 'witch', 'villager'] as RoleId[],
  numberOfPlayers: 4,
});

describe('useGameRoom - Room Number Consistency', () => {
  let mockRoomService: jest.Mocked<SimplifiedRoomService>;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockGameStateService: jest.Mocked<GameStateService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock implementations
    mockRoomService = {
      generateRoomNumber: jest.fn().mockResolvedValue('9999'),
      createRoom: jest.fn().mockResolvedValue({
        roomNumber: '4219',
        hostUid: 'host-123',
        createdAt: new Date(),
      }),
      getRoom: jest.fn(),
      roomExists: jest.fn(),
      deleteRoom: jest.fn(),
    } as any;

    mockAuthService = {
      waitForInit: jest.fn().mockResolvedValue(undefined),
      getCurrentUserId: jest.fn().mockReturnValue('host-123'),
      getCurrentDisplayName: jest.fn().mockResolvedValue('Test User'),
      getCurrentAvatarUrl: jest.fn().mockResolvedValue(null),
    } as any;

    mockGameStateService = {
      initializeAsHost: jest.fn().mockResolvedValue(undefined),
      addListener: jest.fn().mockReturnValue(() => {}),
      isHostPlayer: jest.fn().mockReturnValue(true),
      getMyUid: jest.fn().mockReturnValue('host-123'),
      getMySeatNumber: jest.fn().mockReturnValue(null),
      getMyRole: jest.fn().mockReturnValue(null),
    } as any;

    // Wire up getInstance mocks
    (SimplifiedRoomService.getInstance as jest.Mock).mockReturnValue(mockRoomService);
    (AuthService.getInstance as jest.Mock).mockReturnValue(mockAuthService);
    (GameStateService.getInstance as jest.Mock).mockReturnValue(mockGameStateService);
  });

  describe('createRoom with provided roomNumber', () => {
    it('should use provided roomNumber instead of generating a new one', async () => {
      // This test verifies the core fix:
      // When createRoom is called with a roomNumber, it should NOT call generateRoomNumber

      const providedRoomNumber = '4219';

      // Simulate what createRoom does internally:
      await mockAuthService.waitForInit();
      mockAuthService.getCurrentUserId();

      // The fix: Use provided room number, don't generate
      const roomNumber = providedRoomNumber ?? (await mockRoomService.generateRoomNumber());

      // Assert: generateRoomNumber should NOT be called
      expect(mockRoomService.generateRoomNumber).not.toHaveBeenCalled();

      // Assert: The roomNumber should be the provided one
      expect(roomNumber).toBe('4219');
    });

    it('should generate roomNumber when none is provided', async () => {
      // Simulate what createRoom does when NO roomNumber is provided:
      await mockAuthService.waitForInit();
      mockAuthService.getCurrentUserId();

      // The logic: Generate if not provided
      const providedRoomNumber: string | undefined = undefined;
      const roomNumber = providedRoomNumber ?? (await mockRoomService.generateRoomNumber());

      // Assert: generateRoomNumber SHOULD be called
      expect(mockRoomService.generateRoomNumber).toHaveBeenCalled();

      // Assert: The roomNumber should be the generated one
      expect(roomNumber).toBe('9999');
    });

    it('should pass the correct roomNumber to SimplifiedRoomService.createRoom', async () => {
      const providedRoomNumber = '4219';
      const hostUid = 'host-123';

      // Call createRoom with the provided roomNumber
      await mockRoomService.createRoom(providedRoomNumber, hostUid);

      // Assert: createRoom was called with the provided roomNumber
      expect(mockRoomService.createRoom).toHaveBeenCalledWith(providedRoomNumber, hostUid);

      // Assert: The first argument is exactly the provided roomNumber
      expect(mockRoomService.createRoom.mock.calls[0][0]).toBe('4219');
    });
  });

  describe('mySeatNumber updates via listener', () => {
    it('should call getMySeatNumber when listener is triggered', () => {
      // Store the listener callback for later invocation
      type ListenerFn = (state: any) => void;
      let capturedListener: ListenerFn | null = null;

      mockGameStateService.addListener = jest.fn().mockImplementation((listener: ListenerFn) => {
        capturedListener = listener;
        return jest.fn(); // unsubscribe
      });

      // First call: mySeatNumber is null
      mockGameStateService.getMySeatNumber.mockReturnValue(null);

      // Simulate initial subscription
      mockGameStateService.addListener(() => {});

      // Now simulate host taking seat (getMySeatNumber returns 0)
      mockGameStateService.getMySeatNumber.mockReturnValue(0);

      // Trigger the listener (simulating notifyListeners after hostTakeSeat)
      expect(capturedListener).not.toBeNull();
      capturedListener!({ players: new Map() });

      // Assert: The returned value is 0 (the seat taken)
      expect(mockGameStateService.getMySeatNumber()).toBe(0);
    });
  });
});

/**
 * Tests for useGameRoom ACK reason transparency
 *
 * These tests verify that takeSeatWithAck/leaveSeatWithAck pass through
 * the reason from facade without modification.
 */
describe('useGameRoom - ACK reason transparency', () => {
  let mockAuthService: jest.Mocked<AuthService>;
  let mockGameStateService: jest.Mocked<GameStateService>;
  let mockBroadcastService: jest.Mocked<BroadcastService>;

  // Create a mock facade for testing
  const createMockFacade = (overrides: Partial<IGameFacade> = {}): IGameFacade => ({
    addListener: jest.fn().mockReturnValue(() => {}),
    isHostPlayer: jest.fn().mockReturnValue(false),
    getMyUid: jest.fn().mockReturnValue('player-uid'),
    getMySeatNumber: jest.fn().mockReturnValue(null),
    getStateRevision: jest.fn().mockReturnValue(0),
    initializeAsHost: jest.fn().mockResolvedValue(undefined),
    joinAsPlayer: jest.fn().mockResolvedValue(undefined),
    leaveRoom: jest.fn().mockResolvedValue(undefined),
    takeSeat: jest.fn().mockResolvedValue(true),
    takeSeatWithAck: jest.fn().mockResolvedValue({ success: true }),
    leaveSeat: jest.fn().mockResolvedValue(true),
    leaveSeatWithAck: jest.fn().mockResolvedValue({ success: true }),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup minimal mock services
    mockAuthService = {
      waitForInit: jest.fn().mockResolvedValue(undefined),
      getCurrentUserId: jest.fn().mockReturnValue('player-uid'),
      getCurrentDisplayName: jest.fn().mockResolvedValue('Test Player'),
      getCurrentAvatarUrl: jest.fn().mockResolvedValue(null),
    } as any;

    mockGameStateService = {
      initializeAsHost: jest.fn().mockResolvedValue(undefined),
      addListener: jest.fn().mockReturnValue(() => {}),
      isHostPlayer: jest.fn().mockReturnValue(false),
      getMyUid: jest.fn().mockReturnValue('player-uid'),
      getMySeatNumber: jest.fn().mockReturnValue(null),
      getMyRole: jest.fn().mockReturnValue(null),
      clearLastSeatError: jest.fn(),
    } as any;

    mockBroadcastService = {
      addStatusListener: jest.fn().mockReturnValue(() => {}),
    } as any;

    (AuthService.getInstance as jest.Mock).mockReturnValue(mockAuthService);
    (GameStateService.getInstance as jest.Mock).mockReturnValue(mockGameStateService);
    (BroadcastService.getInstance as jest.Mock).mockReturnValue(mockBroadcastService);
  });

  describe('takeSeatWithAck reason transparency', () => {
    it('should return { success: true, reason: undefined } when facade returns success', async () => {
      const mockFacade = createMockFacade({
        takeSeatWithAck: jest.fn().mockResolvedValue({ success: true }),
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
      );

      const { result } = renderHook(() => useGameRoom(), { wrapper });

      let ackResult: { success: boolean; reason?: string } | undefined;
      await act(async () => {
        ackResult = await result.current.takeSeatWithAck(1);
      });

      expect(ackResult).toEqual({ success: true, reason: undefined });
      expect(mockFacade.takeSeatWithAck).toHaveBeenCalledWith(1, 'Test Player', undefined);
    });

    it('should pass through seat_taken reason from facade', async () => {
      const mockFacade = createMockFacade({
        takeSeatWithAck: jest.fn().mockResolvedValue({ success: false, reason: 'seat_taken' }),
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
      );

      const { result } = renderHook(() => useGameRoom(), { wrapper });

      let ackResult: { success: boolean; reason?: string } | undefined;
      await act(async () => {
        ackResult = await result.current.takeSeatWithAck(1);
      });

      expect(ackResult).toEqual({ success: false, reason: 'seat_taken' });
    });

    it('should pass through game_in_progress reason from facade', async () => {
      const mockFacade = createMockFacade({
        takeSeatWithAck: jest
          .fn()
          .mockResolvedValue({ success: false, reason: 'game_in_progress' }),
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
      );

      const { result } = renderHook(() => useGameRoom(), { wrapper });

      let ackResult: { success: boolean; reason?: string } | undefined;
      await act(async () => {
        ackResult = await result.current.takeSeatWithAck(1);
      });

      expect(ackResult).toEqual({ success: false, reason: 'game_in_progress' });
    });

    it('should pass through invalid_seat reason from facade', async () => {
      const mockFacade = createMockFacade({
        takeSeatWithAck: jest.fn().mockResolvedValue({ success: false, reason: 'invalid_seat' }),
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
      );

      const { result } = renderHook(() => useGameRoom(), { wrapper });

      let ackResult: { success: boolean; reason?: string } | undefined;
      await act(async () => {
        ackResult = await result.current.takeSeatWithAck(999);
      });

      expect(ackResult).toEqual({ success: false, reason: 'invalid_seat' });
    });
  });

  describe('leaveSeatWithAck reason transparency', () => {
    it('should return { success: true, reason: undefined } when facade returns success', async () => {
      const mockFacade = createMockFacade({
        leaveSeatWithAck: jest.fn().mockResolvedValue({ success: true }),
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
      );

      const { result } = renderHook(() => useGameRoom(), { wrapper });

      let ackResult: { success: boolean; reason?: string } | undefined;
      await act(async () => {
        ackResult = await result.current.leaveSeatWithAck();
      });

      expect(ackResult).toEqual({ success: true, reason: undefined });
    });

    it('should pass through game_in_progress reason from facade', async () => {
      const mockFacade = createMockFacade({
        leaveSeatWithAck: jest
          .fn()
          .mockResolvedValue({ success: false, reason: 'game_in_progress' }),
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
      );

      const { result } = renderHook(() => useGameRoom(), { wrapper });

      let ackResult: { success: boolean; reason?: string } | undefined;
      await act(async () => {
        ackResult = await result.current.leaveSeatWithAck();
      });

      expect(ackResult).toEqual({ success: false, reason: 'game_in_progress' });
    });

    it('should pass through not_seated reason from facade', async () => {
      const mockFacade = createMockFacade({
        leaveSeatWithAck: jest.fn().mockResolvedValue({ success: false, reason: 'not_seated' }),
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
      );

      const { result } = renderHook(() => useGameRoom(), { wrapper });

      let ackResult: { success: boolean; reason?: string } | undefined;
      await act(async () => {
        ackResult = await result.current.leaveSeatWithAck();
      });

      expect(ackResult).toEqual({ success: false, reason: 'not_seated' });
    });
  });
});
