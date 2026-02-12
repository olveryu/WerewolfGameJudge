/**
 * Tests for useGameRoom hook
 *
 * Focus: ACK reason transparency - ensuring takeSeatWithAck/leaveSeatWithAck
 * pass through the reason from facade without modification.
 *
 * PR8: 完全切换到 facade，不再依赖 legacy GameStateService
 */

import { act, renderHook } from '@testing-library/react-native';
import React from 'react';

import { GameFacadeProvider } from '@/contexts';
import { useServices } from '@/contexts/ServiceContext';
import { useGameRoom } from '@/hooks/useGameRoom';
import type { IGameFacade } from '@/services/types/IGameFacade';

// Access the jest-mocked useServices to override return values per test
const mockUseServices = useServices as jest.Mock;

/**
 * Tests for useGameRoom ACK reason transparency
 *
 * These tests verify that takeSeatWithAck/leaveSeatWithAck pass through
 * the reason from facade without modification.
 */
describe('useGameRoom - ACK reason transparency', () => {
  // Create a mock facade for testing
  const createMockFacade = (overrides: Partial<IGameFacade> = {}): IGameFacade => ({
    addListener: jest.fn().mockReturnValue(() => {}),
    getState: jest.fn().mockReturnValue(null),
    isHostPlayer: jest.fn().mockReturnValue(false),
    getMyUid: jest.fn().mockReturnValue('player-uid'),
    getMySeatNumber: jest.fn().mockReturnValue(null),
    getStateRevision: jest.fn().mockReturnValue(0),
    initializeAsHost: jest.fn().mockResolvedValue(undefined),
    joinAsPlayer: jest.fn().mockResolvedValue(undefined),
    joinAsHost: jest.fn().mockResolvedValue({ success: true }),
    leaveRoom: jest.fn().mockResolvedValue(undefined),
    takeSeat: jest.fn().mockResolvedValue(true),
    takeSeatWithAck: jest.fn().mockResolvedValue({ success: true }),
    leaveSeat: jest.fn().mockResolvedValue(true),
    leaveSeatWithAck: jest.fn().mockResolvedValue({ success: true }),
    assignRoles: jest.fn().mockResolvedValue({ success: true }),
    updateTemplate: jest.fn().mockResolvedValue({ success: true }),
    setRoleRevealAnimation: jest.fn().mockResolvedValue({ success: true }),
    startNight: jest.fn().mockResolvedValue({ success: true }),
    restartGame: jest.fn().mockResolvedValue({ success: true }),
    fillWithBots: jest.fn().mockResolvedValue({ success: true }),
    markAllBotsViewed: jest.fn().mockResolvedValue({ success: true }),
    markViewedRole: jest.fn().mockResolvedValue({ success: true }),
    submitAction: jest.fn().mockResolvedValue({ success: true }),
    submitWolfVote: jest.fn().mockResolvedValue({ success: true }),
    submitRevealAck: jest.fn().mockResolvedValue({ success: true }),
    advanceNight: jest.fn().mockResolvedValue({ success: true }),
    endNight: jest.fn().mockResolvedValue({ success: true }),
    setAudioPlaying: jest.fn().mockResolvedValue({ success: true }),
    requestSnapshot: jest.fn().mockResolvedValue(true),
    sendWolfRobotHunterStatusViewed: jest.fn().mockResolvedValue({ success: true }),
    addConnectionStatusListener: jest.fn().mockReturnValue(() => {}),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Override global useServices mock with test-specific values
    mockUseServices.mockReturnValue({
      authService: {
        waitForInit: jest.fn().mockResolvedValue(undefined),
        getCurrentUserId: jest.fn().mockReturnValue('player-uid'),
        getCurrentDisplayName: jest.fn().mockResolvedValue('Test Player'),
        getCurrentAvatarUrl: jest.fn().mockResolvedValue(null),
      },
      roomService: {
        createRoom: jest.fn(),
        getRoom: jest
          .fn()
          .mockResolvedValue({ roomNumber: '1234', hostUid: 'test-uid', createdAt: new Date() }),
        deleteRoom: jest.fn(),
      },
      settingsService: {
        load: jest.fn(),
        isBgmEnabled: jest.fn().mockReturnValue(true),
        toggleBgm: jest.fn(),
        getRoleRevealAnimation: jest.fn().mockReturnValue('random'),
      },
      audioService: {
        startBgm: jest.fn().mockResolvedValue(undefined),
        stopBgm: jest.fn(),
        cleanup: jest.fn(),
      },
      avatarUploadService: { uploadAvatar: jest.fn() },
    });
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

  describe('Player auto-recovery', () => {
    it('should expose lastStateReceivedAt and isStateStale', () => {
      const mockFacade = createMockFacade();

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
      );

      const { result } = renderHook(() => useGameRoom(), { wrapper });

      // Initially null and stale (no state received)
      expect(result.current.lastStateReceivedAt).toBeNull();
      expect(result.current.isStateStale).toBe(true);
    });

    it('should update lastStateReceivedAt when state is received', async () => {
      let stateListener: ((state: any) => void) | null = null;

      const mockFacade = createMockFacade({
        addListener: jest.fn().mockImplementation((fn) => {
          stateListener = fn;
          return () => {};
        }),
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
      );

      const { result } = renderHook(() => useGameRoom(), { wrapper });

      // Initially null
      expect(result.current.lastStateReceivedAt).toBeNull();

      // Simulate receiving state
      const mockState = {
        roomCode: 'TEST',
        hostUid: 'host-1',
        status: 'unseated',
        templateRoles: ['villager', 'wolf', 'seer'],
        players: {},
        currentStepIndex: -1,
        isAudioPlaying: false,
      };

      await act(async () => {
        stateListener?.(mockState);
      });

      // Now should have timestamp
      expect(result.current.lastStateReceivedAt).not.toBeNull();
      expect(typeof result.current.lastStateReceivedAt).toBe('number');
    });
  });

  // =========================================================================
  // Auto-recovery throttle: 同一 live session 只请求一次，避免 REQUEST_STATE spam
  // =========================================================================
  describe('auto-recovery throttle (fake-timers)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should only call requestSnapshot once per live session (no spam)', async () => {
      const requestSnapshotMock = jest.fn().mockResolvedValue(true);
      let statusListener: ((status: 'live' | 'connecting' | 'disconnected') => void) | null = null;

      const mockFacade = createMockFacade({
        requestSnapshot: requestSnapshotMock,
        isHostPlayer: jest.fn().mockReturnValue(false), // Player mode
        addConnectionStatusListener: jest.fn().mockImplementation((fn) => {
          statusListener = fn;
          return () => {};
        }),
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
      );

      // roomRecord 不存在时不会触发 auto-recovery，需要 mock 一个房间
      const mockRoomService = {
        getRoom: jest.fn().mockResolvedValue({
          id: 'room-id',
          room_number: 'TEST',
          status: 'active',
          host_uid: 'host-1',
          created_at: new Date().toISOString(),
        }),
        deleteRoom: jest.fn(),
        subscribeToRoom: jest.fn().mockReturnValue(() => {}),
      };
      jest.requireMock('../../services/infra/RoomService').RoomService = {
        getInstance: () => mockRoomService,
      };

      const { result } = renderHook(() => useGameRoom(), { wrapper });

      // 模拟加入房间
      await act(async () => {
        await result.current.joinRoom('TEST');
      });

      // 第一次 live：触发 auto-recovery timer
      act(() => {
        statusListener?.('live');
      });

      // 快进 2 秒，触发 requestSnapshot
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      expect(requestSnapshotMock).toHaveBeenCalledTimes(1);

      // 模拟断线
      act(() => {
        statusListener?.('connecting');
      });

      // 重新连接（同一 session，因为没有收到新 STATE_UPDATE）
      act(() => {
        statusListener?.('live');
      });

      // 再次快进 2 秒
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      // 仍然只调用一次（throttle 生效）
      expect(requestSnapshotMock).toHaveBeenCalledTimes(1);
    });

    it('should allow new requestSnapshot after receiving state (throttle reset)', async () => {
      const requestSnapshotMock = jest.fn().mockResolvedValue(true);
      let statusListener: ((status: 'live' | 'connecting' | 'disconnected') => void) | null = null;
      let stateListener: ((state: any) => void) | null = null;

      const mockFacade = createMockFacade({
        requestSnapshot: requestSnapshotMock,
        isHostPlayer: jest.fn().mockReturnValue(false), // Player mode
        addListener: jest.fn().mockImplementation((fn) => {
          stateListener = fn;
          return () => {};
        }),
        addConnectionStatusListener: jest.fn().mockImplementation((fn) => {
          statusListener = fn;
          return () => {};
        }),
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
      );

      const mockRoomService = {
        getRoom: jest.fn().mockResolvedValue({
          id: 'room-id',
          room_number: 'TEST',
          status: 'active',
          host_uid: 'host-1',
          created_at: new Date().toISOString(),
        }),
        deleteRoom: jest.fn(),
        subscribeToRoom: jest.fn().mockReturnValue(() => {}),
      };
      jest.requireMock('../../services/infra/RoomService').RoomService = {
        getInstance: () => mockRoomService,
      };

      const { result } = renderHook(() => useGameRoom(), { wrapper });

      await act(async () => {
        await result.current.joinRoom('TEST');
      });

      // 第一次 live：触发 auto-recovery
      act(() => {
        statusListener?.('live');
      });

      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      expect(requestSnapshotMock).toHaveBeenCalledTimes(1);

      // 收到 STATE_UPDATE（重置 throttle）
      const mockState = {
        roomCode: 'TEST',
        hostUid: 'host-1',
        status: 'unseated',
        templateRoles: ['villager'],
        players: {},
        currentStepIndex: -1,
        isAudioPlaying: false,
      };

      await act(async () => {
        stateListener?.(mockState);
      });

      // 模拟断线
      act(() => {
        statusListener?.('connecting');
      });

      // 重新连接（新 session，因为收到了 STATE_UPDATE 重置 throttle）
      act(() => {
        statusListener?.('live');
      });

      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      // 现在应该调用第二次
      expect(requestSnapshotMock).toHaveBeenCalledTimes(2);
    });
  });
});

// =============================================================================
// Debug Bot Control: effectiveSeat/effectiveRole Tests
// =============================================================================

describe('useGameRoom - effectiveSeat/effectiveRole for debug bot control', () => {
  // Create a mock facade for testing
  const createMockFacade = (overrides: Partial<IGameFacade> = {}): IGameFacade => ({
    addListener: jest.fn().mockReturnValue(() => {}),
    getState: jest.fn().mockReturnValue(null),
    isHostPlayer: jest.fn().mockReturnValue(true),
    getMyUid: jest.fn().mockReturnValue('host-uid'),
    getMySeatNumber: jest.fn().mockReturnValue(0),
    getStateRevision: jest.fn().mockReturnValue(1),
    initializeAsHost: jest.fn().mockResolvedValue(undefined),
    joinAsPlayer: jest.fn().mockResolvedValue(undefined),
    joinAsHost: jest.fn().mockResolvedValue({ success: true }),
    leaveRoom: jest.fn().mockResolvedValue(undefined),
    takeSeat: jest.fn().mockResolvedValue(true),
    takeSeatWithAck: jest.fn().mockResolvedValue({ success: true }),
    leaveSeat: jest.fn().mockResolvedValue(true),
    leaveSeatWithAck: jest.fn().mockResolvedValue({ success: true }),
    assignRoles: jest.fn().mockResolvedValue({ success: true }),
    updateTemplate: jest.fn().mockResolvedValue({ success: true }),
    setRoleRevealAnimation: jest.fn().mockResolvedValue({ success: true }),
    startNight: jest.fn().mockResolvedValue({ success: true }),
    restartGame: jest.fn().mockResolvedValue({ success: true }),
    fillWithBots: jest.fn().mockResolvedValue({ success: true }),
    markAllBotsViewed: jest.fn().mockResolvedValue({ success: true }),
    markViewedRole: jest.fn().mockResolvedValue({ success: true }),
    submitAction: jest.fn().mockResolvedValue({ success: true }),
    submitWolfVote: jest.fn().mockResolvedValue({ success: true }),
    submitRevealAck: jest.fn().mockResolvedValue({ success: true }),
    advanceNight: jest.fn().mockResolvedValue({ success: true }),
    endNight: jest.fn().mockResolvedValue({ success: true }),
    setAudioPlaying: jest.fn().mockResolvedValue({ success: true }),
    requestSnapshot: jest.fn().mockResolvedValue(true),
    sendWolfRobotHunterStatusViewed: jest.fn().mockResolvedValue({ success: true }),
    addConnectionStatusListener: jest.fn().mockReturnValue(() => {}),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Override global useServices mock with test-specific values
    mockUseServices.mockReturnValue({
      authService: {
        waitForInit: jest.fn().mockResolvedValue(undefined),
        getCurrentUserId: jest.fn().mockReturnValue('host-uid'),
        getCurrentDisplayName: jest.fn().mockResolvedValue('Host Player'),
        getCurrentAvatarUrl: jest.fn().mockResolvedValue(null),
      },
      roomService: {
        createRoom: jest.fn(),
        getRoom: jest
          .fn()
          .mockResolvedValue({ roomNumber: '1234', hostUid: 'host-uid', createdAt: new Date() }),
        deleteRoom: jest.fn(),
      },
      settingsService: {
        load: jest.fn(),
        isBgmEnabled: jest.fn().mockReturnValue(true),
        toggleBgm: jest.fn(),
        getRoleRevealAnimation: jest.fn().mockReturnValue('random'),
      },
      audioService: {
        startBgm: jest.fn().mockResolvedValue(undefined),
        stopBgm: jest.fn(),
        cleanup: jest.fn(),
      },
      avatarUploadService: { uploadAvatar: jest.fn() },
    });
  });

  it('submitAction should use effectiveSeat and effectiveRole when controlledSeat is set', async () => {
    const submitActionMock = jest.fn().mockResolvedValue({ success: true });
    let stateListener: ((state: any) => void) | null = null;

    // Mock state with Host at seat 0 (villager) and bot at seat 1 (wolf)
    // Use 'assigned' status to avoid triggering nightPlan logic in hook
    // Players must be Record<number, ...> for broadcastToLocalState adapter
    const mockState = {
      roomCode: 'TEST',
      hostUid: 'host-uid',
      status: 'assigned' as const,
      templateRoles: ['villager', 'wolf'],
      players: {
        0: {
          uid: 'host-uid',
          seatNumber: 0,
          displayName: 'Host',
          role: 'villager',
          hasViewedRole: true,
        },
        1: {
          uid: 'bot-1',
          seatNumber: 1,
          displayName: 'Bot 1',
          role: 'wolf',
          hasViewedRole: true,
          isBot: true,
        },
      },
      currentStepIndex: -1,
      isAudioPlaying: false,
      debugMode: { botsEnabled: true },
      currentNightResults: {},
    };

    const mockFacade = createMockFacade({
      addListener: jest.fn().mockImplementation((fn) => {
        stateListener = fn;
        return () => {};
      }),
      getState: jest.fn().mockReturnValue(mockState),
      getMySeatNumber: jest.fn().mockReturnValue(0),
      submitAction: submitActionMock,
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
    );

    const { result } = renderHook(() => useGameRoom(), { wrapper });

    // Trigger state update through listener (this populates mySeatNumber from localState)
    await act(async () => {
      stateListener?.(mockState);
    });

    // Initially: effectiveSeat = 0 (mySeatNumber), effectiveRole = 'villager'
    expect(result.current.effectiveSeat).toBe(0);
    expect(result.current.effectiveRole).toBe('villager');

    // Set controlledSeat to 1 (bot seat)
    await act(async () => {
      result.current.setControlledSeat(1);
    });

    // Now: effectiveSeat = 1, effectiveRole = 'wolf'
    expect(result.current.effectiveSeat).toBe(1);
    expect(result.current.effectiveRole).toBe('wolf');

    // Submit action - should use effectiveSeat=1 and effectiveRole='wolf'
    await act(async () => {
      await result.current.submitAction(5); // target seat 5
    });

    // Verify facade.submitAction was called with bot's seat and role
    expect(submitActionMock).toHaveBeenCalledWith(1, 'wolf', 5, undefined);
    // NOT called with Host's seat and role
    expect(submitActionMock).not.toHaveBeenCalledWith(0, 'villager', 5, undefined);
  });

  it('submitWolfVote should use effectiveSeat when controlledSeat is set', async () => {
    const submitWolfVoteMock = jest.fn().mockResolvedValue({ success: true });
    let stateListener: ((state: any) => void) | null = null;

    // Use 'assigned' status to avoid triggering nightPlan logic in hook
    // Players must be Record<number, ...> for broadcastToLocalState adapter
    const mockState = {
      roomCode: 'TEST',
      hostUid: 'host-uid',
      status: 'assigned' as const,
      templateRoles: ['villager', 'wolf'],
      players: {
        0: {
          uid: 'host-uid',
          seatNumber: 0,
          displayName: 'Host',
          role: 'villager',
          hasViewedRole: true,
        },
        1: {
          uid: 'bot-1',
          seatNumber: 1,
          displayName: 'Bot 1',
          role: 'wolf',
          hasViewedRole: true,
          isBot: true,
        },
      },
      currentStepIndex: -1,
      isAudioPlaying: false,
      debugMode: { botsEnabled: true },
      currentNightResults: {},
    };

    const mockFacade = createMockFacade({
      addListener: jest.fn().mockImplementation((fn) => {
        stateListener = fn;
        return () => {};
      }),
      getState: jest.fn().mockReturnValue(mockState),
      getMySeatNumber: jest.fn().mockReturnValue(0),
      submitWolfVote: submitWolfVoteMock,
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
    );

    const { result } = renderHook(() => useGameRoom(), { wrapper });

    // Trigger state update through listener
    await act(async () => {
      stateListener?.(mockState);
    });

    // Set controlledSeat to 1 (bot seat)
    await act(async () => {
      result.current.setControlledSeat(1);
    });

    // Submit wolf vote - should use effectiveSeat=1
    await act(async () => {
      await result.current.submitWolfVote(5);
    });

    // Verify facade.submitWolfVote was called with bot's seat
    expect(submitWolfVoteMock).toHaveBeenCalledWith(1, 5);
    // NOT called with Host's seat
    expect(submitWolfVoteMock).not.toHaveBeenCalledWith(0, 5);
  });

  it('sendWolfRobotHunterStatusViewed should use effectiveSeat when controlledSeat is set', async () => {
    const sendWolfRobotHunterStatusViewedMock = jest.fn().mockResolvedValue({ success: true });
    let stateListener: ((state: any) => void) | null = null;

    const mockState = {
      roomCode: 'TEST',
      hostUid: 'host-uid',
      status: 'assigned' as const,
      templateRoles: ['villager', 'wolfRobot'],
      players: {
        0: {
          uid: 'host-uid',
          seatNumber: 0,
          displayName: 'Host',
          role: 'villager',
          hasViewedRole: true,
        },
        1: {
          uid: 'bot-1',
          seatNumber: 1,
          displayName: 'Bot 1',
          role: 'wolfRobot',
          hasViewedRole: true,
          isBot: true,
        },
      },
      currentStepIndex: -1,
      isAudioPlaying: false,
      debugMode: { botsEnabled: true },
      currentNightResults: {},
    };

    const mockFacade = createMockFacade({
      addListener: jest.fn().mockImplementation((fn) => {
        stateListener = fn;
        return () => {};
      }),
      getState: jest.fn().mockReturnValue(mockState),
      getMySeatNumber: jest.fn().mockReturnValue(0),
      sendWolfRobotHunterStatusViewed: sendWolfRobotHunterStatusViewedMock,
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
    );

    const { result } = renderHook(() => useGameRoom(), { wrapper });

    await act(async () => {
      stateListener?.(mockState);
    });

    // Set controlledSeat to 1 (wolfRobot bot seat)
    await act(async () => {
      result.current.setControlledSeat(1);
    });

    // effectiveSeat should now be 1
    expect(result.current.effectiveSeat).toBe(1);

    // Call sendWolfRobotHunterStatusViewed with effectiveSeat
    await act(async () => {
      await result.current.sendWolfRobotHunterStatusViewed(result.current.effectiveSeat!);
    });

    // Verify facade was called with bot's seat (effectiveSeat=1), NOT Host's seat
    expect(sendWolfRobotHunterStatusViewedMock).toHaveBeenCalledWith(1);
    expect(sendWolfRobotHunterStatusViewedMock).not.toHaveBeenCalledWith(0);
  });

  it('effectiveRole should be null when effectiveSeat has no player', async () => {
    let stateListener: ((state: any) => void) | null = null;

    // Use 'assigned' status to avoid triggering nightPlan logic in hook
    // Players must be Record<number, ...> for broadcastToLocalState adapter
    const mockState = {
      roomCode: 'TEST',
      hostUid: 'host-uid',
      status: 'assigned' as const,
      templateRoles: ['villager', 'wolf', 'seer'],
      players: {
        0: {
          uid: 'host-uid',
          seatNumber: 0,
          displayName: 'Host',
          role: 'villager',
          hasViewedRole: true,
        },
        // seat 1 is empty (null)
        1: null,
      },
      currentStepIndex: -1,
      isAudioPlaying: false,
      currentNightResults: {},
    };

    const mockFacade = createMockFacade({
      addListener: jest.fn().mockImplementation((fn) => {
        stateListener = fn;
        return () => {};
      }),
      getState: jest.fn().mockReturnValue(mockState),
      getMySeatNumber: jest.fn().mockReturnValue(0),
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
    );

    const { result } = renderHook(() => useGameRoom(), { wrapper });

    // Trigger state update through listener
    await act(async () => {
      stateListener?.(mockState);
    });

    // Set controlledSeat to empty seat 1
    await act(async () => {
      result.current.setControlledSeat(1);
    });

    expect(result.current.effectiveSeat).toBe(1);
    expect(result.current.effectiveRole).toBeNull();
  });
});
