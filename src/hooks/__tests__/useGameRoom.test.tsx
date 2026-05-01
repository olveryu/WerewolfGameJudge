/**
 * Tests for useGameRoom hook
 *
 * Focus: ACK reason transparency - ensuring takeSeatWithAck/leaveSeatWithAck
 * pass through the reason from facade without modification.
 *
 * PR8: 完全切换到 facade，不再依赖 legacy GameStateService
 */

import { act, renderHook } from '@testing-library/react-native';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type React from 'react';

import { GameFacadeProvider } from '@/contexts';
import { useServices } from '@/contexts/ServiceContext';
import { useGameRoom } from '@/hooks/useGameRoom';
import type { IGameFacade } from '@/services/types/IGameFacade';

// useIsFocused must return true in tests (simulates focused screen)
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

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
    subscribe: jest.fn().mockReturnValue(() => {}),
    getState: jest.fn().mockReturnValue(null),
    isHostPlayer: jest.fn().mockReturnValue(false),
    getMyUserId: jest.fn().mockReturnValue('player-uid'),
    getMySeat: jest.fn().mockReturnValue(null),
    getStateRevision: jest.fn().mockReturnValue(0),
    createRoom: jest.fn().mockResolvedValue(undefined),
    joinRoom: jest.fn().mockResolvedValue({ success: true }),
    leaveRoom: jest.fn().mockResolvedValue(undefined),
    takeSeat: jest.fn().mockResolvedValue(true),
    takeSeatWithAck: jest.fn().mockResolvedValue({ success: true }),
    leaveSeat: jest.fn().mockResolvedValue(true),
    leaveSeatWithAck: jest.fn().mockResolvedValue({ success: true }),
    assignRoles: jest.fn().mockResolvedValue({ success: true }),
    updateTemplate: jest.fn().mockResolvedValue({ success: true }),
    startNight: jest.fn().mockResolvedValue({ success: true }),
    restartGame: jest.fn().mockResolvedValue({ success: true }),
    fillWithBots: jest.fn().mockResolvedValue({ success: true }),
    markAllBotsViewed: jest.fn().mockResolvedValue({ success: true }),
    markAllBotsGroupConfirmed: jest.fn().mockResolvedValue({ success: true }),
    clearAllSeats: jest.fn().mockResolvedValue({ success: true }),
    markViewedRole: jest.fn().mockResolvedValue({ success: true }),
    submitAction: jest.fn().mockResolvedValue({ success: true }),
    submitRevealAck: jest.fn().mockResolvedValue({ success: true }),
    submitGroupConfirmAck: jest.fn().mockResolvedValue({ success: true }),
    setAudioPlaying: jest.fn().mockResolvedValue({ success: true }),
    postProgression: jest.fn().mockResolvedValue({ success: true }),
    fetchStateFromDB: jest.fn().mockResolvedValue(true),

    sendWolfRobotHunterStatusViewed: jest.fn().mockResolvedValue({ success: true }),
    addConnectionStatusListener: jest.fn().mockReturnValue(() => {}),
    wasAudioInterrupted: false,
    resumeAfterRejoin: jest.fn().mockResolvedValue(undefined),
    shareNightReview: jest.fn().mockResolvedValue({ success: true }),
    manualReconnect: jest.fn(),
    updateMyUserId: jest.fn(),
    updatePlayerProfile: jest.fn().mockResolvedValue({ success: true }),
    kickPlayer: jest.fn().mockResolvedValue({ success: true }),
    consumeLastAction: jest.fn().mockReturnValue(null),
    addSettleResultListener: jest.fn().mockReturnValue(() => {}),
    boardNominate: jest.fn().mockResolvedValue({ success: true }),
    boardUpvote: jest.fn().mockResolvedValue({ success: true }),
    boardWithdraw: jest.fn().mockResolvedValue({ success: true }),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Override global useServices mock with test-specific values
    mockUseServices.mockReturnValue({
      authService: {
        waitForInit: jest.fn().mockResolvedValue(undefined),
        getCurrentUserId: jest.fn().mockReturnValue('player-uid'),
      },
      roomService: {
        createRoom: jest.fn(),
        getRoom: jest
          .fn()
          .mockResolvedValue({ roomCode: '1234', hostUserId: 'test-uid', createdAt: new Date() }),
        deleteRoom: jest.fn(),
      },
      settingsService: {
        load: jest.fn(),
        isBgmEnabled: jest.fn().mockReturnValue(true),
        getBgmTrack: jest.fn().mockReturnValue('random'),
        toggleBgm: jest.fn(),
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
      expect(mockFacade.takeSeatWithAck).toHaveBeenCalledWith(
        1,
        'TestPlayer',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
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
    it('should expose lastStateReceivedAt', () => {
      const mockFacade = createMockFacade();

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
      );

      const { result } = renderHook(() => useGameRoom(), { wrapper });

      // Initially null (no state received)
      expect(result.current.lastStateReceivedAt).toBeNull();
    });

    it('should update lastStateReceivedAt when state is received', async () => {
      let onStoreChange: (() => void) | null = null;

      const mockState = {
        roomCode: 'TEST',
        hostUserId: 'host-1',
        status: GameStatus.Unseated,
        templateRoles: ['villager', 'wolf', 'seer'],
        players: {},
        currentStepIndex: -1,
        isAudioPlaying: false,
        actions: [],
        pendingRevealAcks: [],
      };

      const mockFacade = createMockFacade({
        subscribe: jest.fn().mockImplementation((cb) => {
          onStoreChange = cb;
          return () => {};
        }),
        getState: jest.fn().mockReturnValue(mockState),
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
      );

      const { result } = renderHook(() => useGameRoom(), { wrapper });

      // Trigger store notification so the side-effect useEffect runs
      await act(async () => {
        onStoreChange?.();
      });

      // Now should have timestamp
      expect(result.current.lastStateReceivedAt).not.toBeNull();
      expect(typeof result.current.lastStateReceivedAt).toBe('number');
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
    subscribe: jest.fn().mockReturnValue(() => {}),
    getState: jest.fn().mockReturnValue(null),
    isHostPlayer: jest.fn().mockReturnValue(true),
    getMyUserId: jest.fn().mockReturnValue('host-uid'),
    getMySeat: jest.fn().mockReturnValue(0),
    getStateRevision: jest.fn().mockReturnValue(1),
    consumeLastAction: jest.fn().mockReturnValue(null),
    addSettleResultListener: jest.fn().mockReturnValue(() => {}),
    createRoom: jest.fn().mockResolvedValue(undefined),
    joinRoom: jest.fn().mockResolvedValue({ success: true }),
    leaveRoom: jest.fn().mockResolvedValue(undefined),
    takeSeat: jest.fn().mockResolvedValue(true),
    takeSeatWithAck: jest.fn().mockResolvedValue({ success: true }),
    leaveSeat: jest.fn().mockResolvedValue(true),
    leaveSeatWithAck: jest.fn().mockResolvedValue({ success: true }),
    assignRoles: jest.fn().mockResolvedValue({ success: true }),
    updateTemplate: jest.fn().mockResolvedValue({ success: true }),
    startNight: jest.fn().mockResolvedValue({ success: true }),
    restartGame: jest.fn().mockResolvedValue({ success: true }),
    fillWithBots: jest.fn().mockResolvedValue({ success: true }),
    markAllBotsViewed: jest.fn().mockResolvedValue({ success: true }),
    markAllBotsGroupConfirmed: jest.fn().mockResolvedValue({ success: true }),
    clearAllSeats: jest.fn().mockResolvedValue({ success: true }),
    markViewedRole: jest.fn().mockResolvedValue({ success: true }),
    submitAction: jest.fn().mockResolvedValue({ success: true }),
    submitRevealAck: jest.fn().mockResolvedValue({ success: true }),
    submitGroupConfirmAck: jest.fn().mockResolvedValue({ success: true }),
    setAudioPlaying: jest.fn().mockResolvedValue({ success: true }),
    postProgression: jest.fn().mockResolvedValue({ success: true }),
    fetchStateFromDB: jest.fn().mockResolvedValue(true),

    sendWolfRobotHunterStatusViewed: jest.fn().mockResolvedValue({ success: true }),
    addConnectionStatusListener: jest.fn().mockReturnValue(() => {}),
    wasAudioInterrupted: false,
    resumeAfterRejoin: jest.fn().mockResolvedValue(undefined),
    shareNightReview: jest.fn().mockResolvedValue({ success: true }),
    manualReconnect: jest.fn(),
    updateMyUserId: jest.fn(),
    updatePlayerProfile: jest.fn().mockResolvedValue({ success: true }),
    kickPlayer: jest.fn().mockResolvedValue({ success: true }),
    boardNominate: jest.fn().mockResolvedValue({ success: true }),
    boardUpvote: jest.fn().mockResolvedValue({ success: true }),
    boardWithdraw: jest.fn().mockResolvedValue({ success: true }),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Override global useServices mock with test-specific values
    mockUseServices.mockReturnValue({
      authService: {
        waitForInit: jest.fn().mockResolvedValue(undefined),
        getCurrentUserId: jest.fn().mockReturnValue('host-uid'),
      },
      roomService: {
        createRoom: jest.fn(),
        getRoom: jest
          .fn()
          .mockResolvedValue({ roomCode: '1234', hostUserId: 'host-uid', createdAt: new Date() }),
        deleteRoom: jest.fn(),
      },
      settingsService: {
        load: jest.fn(),
        isBgmEnabled: jest.fn().mockReturnValue(true),
        getBgmTrack: jest.fn().mockReturnValue('random'),
        toggleBgm: jest.fn(),
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

    // Mock state with Host at seat 0 (villager) and bot at seat 1 (wolf)
    // Use GameStatus.Assigned status to avoid triggering nightPlan logic in hook
    // Players must be Record<number, ...> for toLocalState adapter
    const mockState = {
      roomCode: 'TEST',
      hostUserId: 'host-uid',
      status: GameStatus.Assigned as const,
      templateRoles: ['villager', 'wolf'],
      players: {
        0: {
          userId: 'host-uid',
          seat: 0,
          displayName: 'Host',
          role: 'villager',
          hasViewedRole: true,
        },
        1: {
          userId: 'bot-1',
          seat: 1,
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
      subscribe: jest.fn().mockReturnValue(() => {}),
      getState: jest.fn().mockReturnValue(mockState),
      getMySeat: jest.fn().mockReturnValue(0),
      submitAction: submitActionMock,
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
    );

    const { result } = renderHook(() => useGameRoom(), { wrapper });

    // useSyncExternalStore reads getState() synchronously — state is already populated
    // Initially: effectiveSeat = 0 (mySeat), effectiveRole = 'villager'
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

  it('sendWolfRobotHunterStatusViewed should use effectiveSeat when controlledSeat is set', async () => {
    const sendWolfRobotHunterStatusViewedMock = jest.fn().mockResolvedValue({ success: true });

    const mockState = {
      roomCode: 'TEST',
      hostUserId: 'host-uid',
      status: GameStatus.Assigned as const,
      templateRoles: ['villager', 'wolfRobot'],
      players: {
        0: {
          userId: 'host-uid',
          seat: 0,
          displayName: 'Host',
          role: 'villager',
          hasViewedRole: true,
        },
        1: {
          userId: 'bot-1',
          seat: 1,
          displayName: 'Bot 1',
          role: 'wolfRobot',
          hasViewedRole: true,
          isBot: true,
        },
      },
      currentStepIndex: -1,
      isAudioPlaying: false,
      actions: [],
      pendingRevealAcks: [],
      debugMode: { botsEnabled: true },
      currentNightResults: {},
    };

    const mockFacade = createMockFacade({
      subscribe: jest.fn().mockReturnValue(() => {}),
      getState: jest.fn().mockReturnValue(mockState),
      getMySeat: jest.fn().mockReturnValue(0),
      sendWolfRobotHunterStatusViewed: sendWolfRobotHunterStatusViewedMock,
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
    );

    const { result } = renderHook(() => useGameRoom(), { wrapper });

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
    // Use GameStatus.Assigned status to avoid triggering nightPlan logic in hook
    // Players must be Record<number, ...> for toLocalState adapter
    const mockState = {
      roomCode: 'TEST',
      hostUserId: 'host-uid',
      status: GameStatus.Assigned as const,
      templateRoles: ['villager', 'wolf', 'seer'],
      players: {
        0: {
          userId: 'host-uid',
          seat: 0,
          displayName: 'Host',
          role: 'villager',
          hasViewedRole: true,
        },
        // seat 1 is empty (null)
        1: null,
      },
      currentStepIndex: -1,
      isAudioPlaying: false,
      actions: [],
      pendingRevealAcks: [],
      currentNightResults: {},
    };

    const mockFacade = createMockFacade({
      getState: jest.fn().mockReturnValue(mockState),
      getMySeat: jest.fn().mockReturnValue(0),
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
    );

    const { result } = renderHook(() => useGameRoom(), { wrapper });

    // Set controlledSeat to empty seat 1
    await act(async () => {
      result.current.setControlledSeat(1);
    });

    expect(result.current.effectiveSeat).toBe(1);
    expect(result.current.effectiveRole).toBeNull();
  });
});

// =============================================================================
// Rejoin overlay integration tests
// =============================================================================

describe('useGameRoom - rejoin continue overlay', () => {
  /** Create a mock facade (duplicated from outer describe, which scopes it) */
  const createMockFacade = (overrides: Partial<IGameFacade> = {}): IGameFacade => ({
    addListener: jest.fn().mockReturnValue(() => {}),
    subscribe: jest.fn().mockReturnValue(() => {}),
    getState: jest.fn().mockReturnValue(null),
    isHostPlayer: jest.fn().mockReturnValue(false),
    getMyUserId: jest.fn().mockReturnValue('player-uid'),
    getMySeat: jest.fn().mockReturnValue(null),
    getStateRevision: jest.fn().mockReturnValue(0),
    consumeLastAction: jest.fn().mockReturnValue(null),
    addSettleResultListener: jest.fn().mockReturnValue(() => {}),
    createRoom: jest.fn().mockResolvedValue(undefined),
    joinRoom: jest.fn().mockResolvedValue({ success: true }),
    leaveRoom: jest.fn().mockResolvedValue(undefined),
    takeSeat: jest.fn().mockResolvedValue(true),
    takeSeatWithAck: jest.fn().mockResolvedValue({ success: true }),
    leaveSeat: jest.fn().mockResolvedValue(true),
    leaveSeatWithAck: jest.fn().mockResolvedValue({ success: true }),
    assignRoles: jest.fn().mockResolvedValue({ success: true }),
    updateTemplate: jest.fn().mockResolvedValue({ success: true }),
    startNight: jest.fn().mockResolvedValue({ success: true }),
    restartGame: jest.fn().mockResolvedValue({ success: true }),
    fillWithBots: jest.fn().mockResolvedValue({ success: true }),
    markAllBotsViewed: jest.fn().mockResolvedValue({ success: true }),
    markAllBotsGroupConfirmed: jest.fn().mockResolvedValue({ success: true }),
    clearAllSeats: jest.fn().mockResolvedValue({ success: true }),
    markViewedRole: jest.fn().mockResolvedValue({ success: true }),
    submitAction: jest.fn().mockResolvedValue({ success: true }),
    submitRevealAck: jest.fn().mockResolvedValue({ success: true }),
    submitGroupConfirmAck: jest.fn().mockResolvedValue({ success: true }),
    setAudioPlaying: jest.fn().mockResolvedValue({ success: true }),
    postProgression: jest.fn().mockResolvedValue({ success: true }),
    fetchStateFromDB: jest.fn().mockResolvedValue(true),

    sendWolfRobotHunterStatusViewed: jest.fn().mockResolvedValue({ success: true }),
    addConnectionStatusListener: jest.fn().mockReturnValue(() => {}),
    wasAudioInterrupted: false,
    resumeAfterRejoin: jest.fn().mockResolvedValue(undefined),
    shareNightReview: jest.fn().mockResolvedValue({ success: true }),
    manualReconnect: jest.fn(),
    updateMyUserId: jest.fn(),
    updatePlayerProfile: jest.fn().mockResolvedValue({ success: true }),
    kickPlayer: jest.fn().mockResolvedValue({ success: true }),
    boardNominate: jest.fn().mockResolvedValue({ success: true }),
    boardUpvote: jest.fn().mockResolvedValue({ success: true }),
    boardWithdraw: jest.fn().mockResolvedValue({ success: true }),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Override global useServices mock with test-specific values
    mockUseServices.mockReturnValue({
      authService: {
        waitForInit: jest.fn().mockResolvedValue(undefined),
        getCurrentUserId: jest.fn().mockReturnValue('host-uid'),
      },
      roomService: {
        createRoom: jest.fn(),
        getRoom: jest
          .fn()
          .mockResolvedValue({ roomCode: '1234', hostUserId: 'host-uid', createdAt: new Date() }),
        deleteRoom: jest.fn(),
      },
      settingsService: {
        load: jest.fn(),
        isBgmEnabled: jest.fn().mockReturnValue(true),
        getBgmTrack: jest.fn().mockReturnValue('random'),
        toggleBgm: jest.fn(),
      },
      audioService: {
        startBgm: jest.fn().mockResolvedValue(undefined),
        stopBgm: jest.fn(),
        cleanup: jest.fn(),
      },
      avatarUploadService: { uploadAvatar: jest.fn() },
    });
  });

  /** Ongoing broadcast state for rejoin scenarios */
  const ongoingGameState = {
    roomCode: 'REJN',
    hostUserId: 'host-uid',
    status: GameStatus.Ongoing as const,
    templateRoles: ['wolf', 'villager'],
    players: {
      0: {
        userId: 'host-uid',
        seat: 0,
        displayName: 'Host',
        avatarUrl: undefined,
        role: 'wolf',
        hasViewedRole: true,
      },
    },
    currentStepIndex: 0,
    currentStepId: 'wolfKill',
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
  };

  it('should set needsContinueOverlay=true when host + ongoing + wasAudioInterrupted', async () => {
    const mockFacade = createMockFacade({
      isHostPlayer: jest.fn().mockReturnValue(true),
      wasAudioInterrupted: true,
      getState: jest.fn().mockReturnValue(ongoingGameState),
      getMyUserId: jest.fn().mockReturnValue('host-uid'),
      getMySeat: jest.fn().mockReturnValue(0),
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
    );

    const { result } = renderHook(() => useGameRoom(), { wrapper });

    // useSyncExternalStore reads getState() on initial render;
    // useEffect sets overlay within renderHook's internal act.
    expect(result.current.needsContinueOverlay).toBe(true);
  });

  it('should NOT set overlay when wasAudioInterrupted=false', async () => {
    const mockFacade = createMockFacade({
      isHostPlayer: jest.fn().mockReturnValue(true),
      wasAudioInterrupted: false,
      getState: jest.fn().mockReturnValue(ongoingGameState),
      getMyUserId: jest.fn().mockReturnValue('host-uid'),
      getMySeat: jest.fn().mockReturnValue(0),
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
    );

    const { result } = renderHook(() => useGameRoom(), { wrapper });

    expect(result.current.needsContinueOverlay).toBe(false);
  });

  it('should NOT set overlay for non-host player', async () => {
    const mockFacade = createMockFacade({
      isHostPlayer: jest.fn().mockReturnValue(false),
      wasAudioInterrupted: true,
      getState: jest.fn().mockReturnValue(ongoingGameState),
      getMyUserId: jest.fn().mockReturnValue('player-2'),
      getMySeat: jest.fn().mockReturnValue(1),
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
    );

    const { result } = renderHook(() => useGameRoom(), { wrapper });

    expect(result.current.needsContinueOverlay).toBe(false);
  });

  it('resumeAfterRejoin should close overlay and call facade.resumeAfterRejoin', async () => {
    const mockFacade = createMockFacade({
      isHostPlayer: jest.fn().mockReturnValue(true),
      wasAudioInterrupted: true,
      getState: jest.fn().mockReturnValue(ongoingGameState),
      getMyUserId: jest.fn().mockReturnValue('host-uid'),
      getMySeat: jest.fn().mockReturnValue(0),
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
    );

    const { result } = renderHook(() => useGameRoom(), { wrapper });

    // Overlay set on initial render via useEffect (getState returns ongoing state)
    expect(result.current.needsContinueOverlay).toBe(true);

    // Call resume
    await act(async () => {
      result.current.resumeAfterRejoin();
    });

    expect(result.current.needsContinueOverlay).toBe(false);
    expect(mockFacade.resumeAfterRejoin).toHaveBeenCalledTimes(1);
  });

  it('dismissContinueOverlay should close overlay without calling facade', async () => {
    const mockFacade = createMockFacade({
      isHostPlayer: jest.fn().mockReturnValue(true),
      wasAudioInterrupted: true,
      getState: jest.fn().mockReturnValue(ongoingGameState),
      getMyUserId: jest.fn().mockReturnValue('host-uid'),
      getMySeat: jest.fn().mockReturnValue(0),
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
    );

    const { result } = renderHook(() => useGameRoom(), { wrapper });

    // Overlay set on initial render
    expect(result.current.needsContinueOverlay).toBe(true);

    // Dismiss without resuming
    await act(async () => {
      result.current.dismissContinueOverlay();
    });

    expect(result.current.needsContinueOverlay).toBe(false);
    expect(mockFacade.resumeAfterRejoin).not.toHaveBeenCalled();
  });
});
