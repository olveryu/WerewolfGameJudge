/**
 * useConnectionSync — Dead Channel Detector + foreground fetch + online handler 单元测试
 *
 * 覆盖：Dead Channel Detector timer 触发、retry 上限、foreground fetch、
 * online handler 重置 retries。
 */

import { act, renderHook } from '@testing-library/react-native';

import type { IGameFacade } from '@/services/types/IGameFacade';
import { ConnectionStatus } from '@/services/types/IGameFacade';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../../utils/logger', () => ({
  connectionSyncLog: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { useConnectionSync } from '../useConnectionSync';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type StatusListener = (status: ConnectionStatus) => void;

function createMockFacade(): {
  facade: IGameFacade;
  mockReconnectChannel: jest.Mock;
  mockFetchStateFromDB: jest.Mock;
  statusListeners: Set<StatusListener>;
  emitStatus: (status: ConnectionStatus) => void;
} {
  const statusListeners = new Set<StatusListener>();
  const mockReconnectChannel = jest.fn().mockResolvedValue(undefined);
  const mockFetchStateFromDB = jest.fn().mockResolvedValue(true);

  const facade: IGameFacade = {
    addConnectionStatusListener: jest.fn((fn: StatusListener) => {
      statusListeners.add(fn);
      return () => statusListeners.delete(fn);
    }),
    reconnectChannel: mockReconnectChannel,
    fetchStateFromDB: mockFetchStateFromDB,
    // Minimal stubs for unused methods
    addListener: jest.fn().mockReturnValue(() => {}),
    subscribe: jest.fn().mockReturnValue(() => {}),
    getState: jest.fn().mockReturnValue(null),
    isHostPlayer: jest.fn().mockReturnValue(false),
    getMyUid: jest.fn().mockReturnValue(null),
    getMySeatNumber: jest.fn().mockReturnValue(null),
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
    setRoleRevealAnimation: jest.fn().mockResolvedValue({ success: true }),
    markViewedRole: jest.fn().mockResolvedValue({ success: true }),
    startNight: jest.fn().mockResolvedValue({ success: true }),
    restartGame: jest.fn().mockResolvedValue({ success: true }),
    submitAction: jest.fn().mockResolvedValue({ success: true }),
    submitRevealAck: jest.fn().mockResolvedValue({ success: true }),
    submitGroupConfirmAck: jest.fn().mockResolvedValue({ success: true }),
    endNight: jest.fn().mockResolvedValue({ success: true }),
    setAudioPlaying: jest.fn().mockResolvedValue({ success: true }),
    resumeAfterRejoin: jest.fn().mockResolvedValue(undefined),
    wasAudioInterrupted: false,
    postProgression: jest.fn().mockResolvedValue({ success: true }),
    fillWithBots: jest.fn().mockResolvedValue({ success: true }),
    markAllBotsViewed: jest.fn().mockResolvedValue({ success: true }),
    clearAllSeats: jest.fn().mockResolvedValue({ success: true }),
    getListenerCount: jest.fn().mockReturnValue(0),
    sendWolfRobotHunterStatusViewed: jest.fn().mockResolvedValue({ success: true }),
    shareNightReview: jest.fn().mockResolvedValue({ success: true }),
  } as any;

  const emitStatus = (status: ConnectionStatus) => {
    statusListeners.forEach((fn) => fn(status));
  };

  return { facade, mockReconnectChannel, mockFetchStateFromDB, statusListeners, emitStatus };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useConnectionSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('connection status tracking', () => {
    it('subscribes to facade status listener', () => {
      const { facade, statusListeners } = createMockFacade();

      renderHook(() => useConnectionSync(facade, { roomNumber: 'ABCD' }));

      expect(statusListeners.size).toBeGreaterThan(0);
    });

    it('reflects status changes from facade', () => {
      const { facade, emitStatus } = createMockFacade();

      const { result } = renderHook(() => useConnectionSync(facade, { roomNumber: 'ABCD' }));

      act(() => {
        emitStatus(ConnectionStatus.Live);
      });

      expect(result.current.connectionStatus).toBe(ConnectionStatus.Live);
    });
  });

  describe('Dead Channel Detector', () => {
    it('triggers reconnectChannel after delay when Disconnected', () => {
      const { facade, mockReconnectChannel, emitStatus } = createMockFacade();

      renderHook(() => useConnectionSync(facade, { roomNumber: 'ABCD' }));

      act(() => {
        emitStatus(ConnectionStatus.Disconnected);
      });

      expect(mockReconnectChannel).not.toHaveBeenCalled();

      // Advance past first delay (5000ms base)
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(mockReconnectChannel).toHaveBeenCalledTimes(1);
      expect(mockReconnectChannel).toHaveBeenCalledWith('deadChannel');
    });

    it('resets retry counter when status becomes Live', () => {
      const { facade, mockReconnectChannel, emitStatus } = createMockFacade();

      renderHook(() => useConnectionSync(facade, { roomNumber: 'ABCD' }));

      // Retry 1: Disconnected → timer fires
      act(() => {
        emitStatus(ConnectionStatus.Disconnected);
      });
      act(() => {
        jest.advanceTimersByTime(5000);
      });
      expect(mockReconnectChannel).toHaveBeenCalledTimes(1);

      // Simulate reconnect failure cycle: status goes Connecting → back to Disconnected
      // This re-triggers the useEffect with incremented retry counter
      act(() => {
        emitStatus(ConnectionStatus.Connecting);
      });
      act(() => {
        emitStatus(ConnectionStatus.Disconnected);
      });
      act(() => {
        jest.advanceTimersByTime(10000); // retry 2 (exponential: 10s)
      });

      expect(mockReconnectChannel).toHaveBeenCalledTimes(2);

      // Go Live — resets counter
      act(() => {
        emitStatus(ConnectionStatus.Live);
      });

      // Go Disconnected again — should start from delay=5s again (reset counter)
      mockReconnectChannel.mockClear();
      act(() => {
        emitStatus(ConnectionStatus.Disconnected);
      });
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(mockReconnectChannel).toHaveBeenCalledTimes(1);
    });

    it('stops after MAX_DEAD_CHANNEL_RETRIES (10)', () => {
      const { facade, mockReconnectChannel, emitStatus } = createMockFacade();
      const { connectionSyncLog } = jest.requireMock('../../utils/logger') as {
        connectionSyncLog: { warn: jest.Mock; info: jest.Mock };
      };

      renderHook(() => useConnectionSync(facade, { roomNumber: 'ABCD' }));

      // Simulate 10 retry cycles. Each cycle:
      // 1. Status is Disconnected → timer set with exponential backoff
      // 2. Timer fires → reconnectChannel called (incrementing retry counter)
      // 3. Simulate reconnect failure: Connecting → Disconnected (re-triggers effect)
      for (let i = 0; i < 10; i++) {
        if (i === 0) {
          act(() => {
            emitStatus(ConnectionStatus.Disconnected);
          });
        }
        const delay = Math.min(5000 * Math.pow(2, i), 60000);
        act(() => {
          jest.advanceTimersByTime(delay);
        });

        // Simulate reconnect failure cycle to re-trigger the effect
        if (i < 9) {
          act(() => {
            emitStatus(ConnectionStatus.Connecting);
          });
          act(() => {
            emitStatus(ConnectionStatus.Disconnected);
          });
        }
      }

      expect(mockReconnectChannel).toHaveBeenCalledTimes(10);

      // 11th attempt — simulate one more failure cycle
      mockReconnectChannel.mockClear();
      act(() => {
        emitStatus(ConnectionStatus.Connecting);
      });
      act(() => {
        emitStatus(ConnectionStatus.Disconnected);
      });
      act(() => {
        jest.advanceTimersByTime(120000); // well past any possible delay
      });

      expect(mockReconnectChannel).not.toHaveBeenCalled();
      expect(connectionSyncLog.warn).toHaveBeenCalledWith(
        'Dead channel retries exhausted, waiting for manual action or online event',
        expect.objectContaining({ attempt: 10 }),
      );
    });

    it('notifies dead-channel exhaustion callback once', () => {
      const { facade, emitStatus } = createMockFacade();
      const onDeadChannelRetriesExhausted = jest.fn();

      renderHook(() =>
        useConnectionSync(facade, { roomNumber: 'ABCD' }, onDeadChannelRetriesExhausted),
      );

      // Drive retries to exhaustion (10)
      for (let i = 0; i < 10; i++) {
        if (i === 0) {
          act(() => {
            emitStatus(ConnectionStatus.Disconnected);
          });
        }
        const delay = Math.min(5000 * Math.pow(2, i), 60000);
        act(() => {
          jest.advanceTimersByTime(delay);
        });

        if (i < 9) {
          act(() => {
            emitStatus(ConnectionStatus.Connecting);
          });
          act(() => {
            emitStatus(ConnectionStatus.Disconnected);
          });
        }
      }

      // Trigger one more disconnected cycle to hit exhaustion branch
      act(() => {
        emitStatus(ConnectionStatus.Connecting);
      });
      act(() => {
        emitStatus(ConnectionStatus.Disconnected);
      });
      act(() => {
        jest.advanceTimersByTime(120000);
      });

      expect(onDeadChannelRetriesExhausted).toHaveBeenCalledTimes(1);
      expect(onDeadChannelRetriesExhausted).toHaveBeenCalledWith({
        attempt: 10,
        roomNumber: 'ABCD',
      });
    });

    it('does not trigger when roomRecord is null', () => {
      const { facade, mockReconnectChannel, emitStatus } = createMockFacade();

      renderHook(() => useConnectionSync(facade, null));

      act(() => {
        emitStatus(ConnectionStatus.Disconnected);
      });

      act(() => {
        jest.advanceTimersByTime(60000);
      });

      expect(mockReconnectChannel).not.toHaveBeenCalled();
    });
  });

  describe('onStateReceived', () => {
    it('updates lastStateReceivedAt', () => {
      const { facade } = createMockFacade();

      const { result } = renderHook(() => useConnectionSync(facade, { roomNumber: 'ABCD' }));

      expect(result.current.lastStateReceivedAt).toBeNull();

      act(() => {
        result.current.onStateReceived();
      });

      expect(result.current.lastStateReceivedAt).not.toBeNull();
    });
  });
});
