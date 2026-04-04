import { act, renderHook } from '@testing-library/react-native';

import type { IGameFacade } from '@/services/types/IGameFacade';
import { ConnectionStatus } from '@/services/types/IGameFacade';

import { useConnectionStatus } from '../useConnectionStatus';

// ─────────────────────────────────────────────────────────────────────────────
// Mock Facade
// ─────────────────────────────────────────────────────────────────────────────

type StatusListener = (status: ConnectionStatus) => void;

function createMockFacade(): IGameFacade & {
  listeners: Set<StatusListener>;
  simulateStatus: (status: ConnectionStatus) => void;
} {
  const listeners = new Set<StatusListener>();
  return {
    listeners,
    simulateStatus: (status: ConnectionStatus) => {
      listeners.forEach((l) => l(status));
    },
    addConnectionStatusListener: jest.fn((listener: StatusListener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    // Stubs for unused IGameFacade methods
    addListener: jest.fn().mockReturnValue(() => {}),
    subscribe: jest.fn().mockReturnValue(() => {}),
    getState: jest.fn().mockReturnValue(null),
    isHostPlayer: jest.fn().mockReturnValue(false),
    getMyUid: jest.fn().mockReturnValue('uid'),
    getMySeatNumber: jest.fn().mockReturnValue(null),
    getStateRevision: jest.fn().mockReturnValue(0),
    createRoom: jest.fn(),
    joinRoom: jest.fn(),
    leaveRoom: jest.fn(),
    takeSeat: jest.fn(),
    takeSeatWithAck: jest.fn(),
    leaveSeat: jest.fn(),
    leaveSeatWithAck: jest.fn(),
    assignRoles: jest.fn(),
    updateTemplate: jest.fn(),
    setRoleRevealAnimation: jest.fn(),
    startNight: jest.fn(),
    restartGame: jest.fn(),
    fillWithBots: jest.fn(),
    markAllBotsViewed: jest.fn(),
    markAllBotsGroupConfirmed: jest.fn(),
    clearAllSeats: jest.fn(),
    markViewedRole: jest.fn(),
    submitAction: jest.fn(),
    submitRevealAck: jest.fn(),
    submitGroupConfirmAck: jest.fn(),
    endNight: jest.fn(),
    setAudioPlaying: jest.fn(),
    postProgression: jest.fn(),
    fetchStateFromDB: jest.fn(),
    sendWolfRobotHunterStatusViewed: jest.fn(),
    wasAudioInterrupted: false,
    resumeAfterRejoin: jest.fn(),
    shareNightReview: jest.fn(),
    manualReconnect: jest.fn(),
    updateMyUid: jest.fn(),
    updatePlayerProfile: jest.fn(),
  } as unknown as IGameFacade & {
    listeners: Set<StatusListener>;
    simulateStatus: (status: ConnectionStatus) => void;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('useConnectionStatus', () => {
  it('subscribes to facade on mount', () => {
    const facade = createMockFacade();
    renderHook(() => useConnectionStatus(facade));
    expect(facade.addConnectionStatusListener).toHaveBeenCalledTimes(1);
  });

  it('defaults to Disconnected', () => {
    const facade = createMockFacade();
    const { result } = renderHook(() => useConnectionStatus(facade));
    expect(result.current.connectionStatus).toBe(ConnectionStatus.Disconnected);
  });

  it('updates connectionStatus when facade emits', () => {
    const facade = createMockFacade();
    const { result } = renderHook(() => useConnectionStatus(facade));

    act(() => facade.simulateStatus(ConnectionStatus.Live));
    expect(result.current.connectionStatus).toBe(ConnectionStatus.Live);

    act(() => facade.simulateStatus(ConnectionStatus.Disconnected));
    expect(result.current.connectionStatus).toBe(ConnectionStatus.Disconnected);
  });

  it('unsubscribes on unmount', () => {
    const facade = createMockFacade();
    const { unmount } = renderHook(() => useConnectionStatus(facade));

    expect(facade.listeners.size).toBe(1);
    unmount();
    expect(facade.listeners.size).toBe(0);
  });

  it('onStateReceived updates lastStateReceivedAt', () => {
    const facade = createMockFacade();
    const { result } = renderHook(() => useConnectionStatus(facade));

    expect(result.current.lastStateReceivedAt).toBeNull();

    const before = Date.now();
    act(() => result.current.onStateReceived());
    const after = Date.now();

    expect(result.current.lastStateReceivedAt).toBeGreaterThanOrEqual(before);
    expect(result.current.lastStateReceivedAt).toBeLessThanOrEqual(after);
  });

  it('setStateRevision updates stateRevision', () => {
    const facade = createMockFacade();
    const { result } = renderHook(() => useConnectionStatus(facade));

    expect(result.current.stateRevision).toBe(0);

    act(() => result.current.setStateRevision(42));
    expect(result.current.stateRevision).toBe(42);
  });
});
