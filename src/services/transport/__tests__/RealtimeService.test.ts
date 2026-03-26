/**
 * RealtimeService — 状态机 + 重连行为单元测试
 *
 * 覆盖：subscribe → Syncing、CHANNEL_ERROR → Disconnected、timeout → reject、
 * rejoinCurrentRoom guard（Connecting/Syncing skip）、markAsLive 仅 Syncing。
 */

import { ConnectionStatus } from '@/services/types/IGameFacade';

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing RealtimeService
// ---------------------------------------------------------------------------

let mockSubscribeCallback: ((status: string) => void) | null = null;

const mockUnsubscribe = jest.fn().mockResolvedValue(undefined);
const mockRemoveChannel = jest.fn().mockResolvedValue('ok');
const mockDisconnect = jest.fn();

const mockChannel: Record<string, any> = {
  on: jest.fn().mockReturnThis(),
  subscribe: jest.fn((cb: (status: string) => void) => {
    mockSubscribeCallback = cb;
    return mockChannel;
  }),
  unsubscribe: mockUnsubscribe,
};

jest.mock('../../infra/supabaseClient', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    channel: jest.fn(() => mockChannel),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
    realtime: {
      disconnect: () => mockDisconnect(),
      isDisconnecting: jest.fn(() => false),
      getChannels: jest.fn(() => []),
    },
  },
}));

jest.mock('../../../utils/logger', () => ({
  realtimeLog: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { RealtimeService } from '../RealtimeService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createService(): RealtimeService {
  return new RealtimeService();
}

/** Trigger subscribe callback with the given status and return a promise for joinRoom */
function joinRoomAndGetSubscribe(
  service: RealtimeService,
  roomCode = 'ABCD',
  userId = 'uid-1',
): Promise<void> {
  return service.joinRoom(roomCode, userId, {});
}

/** Flush microtask queue so async joinRoom progresses past `await leaveRoom()` to `.subscribe()` */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RealtimeService', () => {
  let service: RealtimeService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockSubscribeCallback = null;
    service = createService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // =========================================================================
  // State Machine
  // =========================================================================

  describe('subscribe → Syncing', () => {
    it('transitions to Syncing on SUBSCRIBED', async () => {
      const statuses: ConnectionStatus[] = [];
      service.addStatusListener((s) => statuses.push(s));

      const joinPromise = joinRoomAndGetSubscribe(service);
      // Simulate SUBSCRIBED
      await flushMicrotasks();
      mockSubscribeCallback!('SUBSCRIBED');
      await joinPromise;

      // Disconnected (initial notify) → Connecting (joinRoom) → Syncing (SUBSCRIBED)
      // Note: leaveRoom inside joinRoom does NOT emit a second Disconnected
      // because #setConnectionStatus deduplicates (status === status → no-op).
      expect(statuses).toEqual([
        ConnectionStatus.Disconnected, // initial addStatusListener immediate notify
        ConnectionStatus.Connecting,
        ConnectionStatus.Syncing,
      ]);
    });
  });

  describe('subscribe → CHANNEL_ERROR on initial connect', () => {
    it('rejects and transitions to Disconnected', async () => {
      const joinPromise = joinRoomAndGetSubscribe(service);
      await flushMicrotasks();
      mockSubscribeCallback!('CHANNEL_ERROR');
      await expect(joinPromise).rejects.toThrow('subscribe failed with status CHANNEL_ERROR');
    });
  });

  describe('subscribe timeout', () => {
    it('retries once then rejects after two timeouts', async () => {
      const joinPromise = joinRoomAndGetSubscribe(service);
      await flushMicrotasks();

      // First timeout → triggers automatic retry
      jest.advanceTimersByTime(8000);
      await flushMicrotasks();

      // Second timeout → final rejection
      jest.advanceTimersByTime(8000);
      await expect(joinPromise).rejects.toThrow('subscribe timeout after 8s');
    });
  });

  describe('CHANNEL_ERROR after SUBSCRIBED → Disconnected', () => {
    it('sets Disconnected on post-subscribe error', async () => {
      const statuses: ConnectionStatus[] = [];

      const joinPromise = joinRoomAndGetSubscribe(service);
      await flushMicrotasks();
      mockSubscribeCallback!('SUBSCRIBED');
      await joinPromise;

      service.addStatusListener((s) => statuses.push(s));
      statuses.length = 0;

      // Simulate post-subscribe error
      mockSubscribeCallback!('CHANNEL_ERROR');
      expect(statuses).toContain(ConnectionStatus.Disconnected);
    });
  });

  describe('SDK reconnect after drop → Live', () => {
    it('sets Live on subsequent SUBSCRIBED after resolved', async () => {
      const statuses: ConnectionStatus[] = [];

      const joinPromise = joinRoomAndGetSubscribe(service);
      await flushMicrotasks();
      mockSubscribeCallback!('SUBSCRIBED');
      await joinPromise;

      service.addStatusListener((s) => statuses.push(s));
      statuses.length = 0;

      // Simulate reconnection SUBSCRIBED after drop
      mockSubscribeCallback!('SUBSCRIBED');
      expect(statuses).toContain(ConnectionStatus.Live);
    });
  });

  // =========================================================================
  // markAsLive
  // =========================================================================

  describe('markAsLive', () => {
    it('transitions Syncing → Live', async () => {
      const joinPromise = joinRoomAndGetSubscribe(service);
      await flushMicrotasks();
      mockSubscribeCallback!('SUBSCRIBED');
      await joinPromise;
      // Service is now in Syncing state

      const statuses: ConnectionStatus[] = [];
      service.addStatusListener((s) => statuses.push(s));
      statuses.length = 0;

      service.markAsLive();
      expect(statuses).toContain(ConnectionStatus.Live);
    });

    it('is no-op when Connecting (prevents false Live)', async () => {
      const statuses: ConnectionStatus[] = [];
      service.addStatusListener((s) => statuses.push(s));

      // Start joinRoom but don't resolve — status is Connecting
      joinRoomAndGetSubscribe(service).catch(() => {});
      await flushMicrotasks();

      statuses.length = 0;
      service.markAsLive();
      // Should NOT transition to Live
      expect(statuses).not.toContain(ConnectionStatus.Live);
    });

    it('is no-op when Disconnected', () => {
      const statuses: ConnectionStatus[] = [];
      service.addStatusListener((s) => statuses.push(s));
      statuses.length = 0;

      service.markAsLive();
      expect(statuses).toHaveLength(0);
    });
  });

  // =========================================================================
  // rejoinCurrentRoom
  // =========================================================================

  describe('rejoinCurrentRoom', () => {
    it('throws when no previous joinRoom params', async () => {
      await expect(service.rejoinCurrentRoom()).rejects.toThrow(
        'cannot rejoin — no cached joinRoom params',
      );
    });

    it('skips when status is Connecting', async () => {
      // Start join but don't complete
      joinRoomAndGetSubscribe(service).catch(() => {});
      await flushMicrotasks();
      // Status is Connecting — rejoin should be no-op
      await service.rejoinCurrentRoom();
      // disconnect should NOT have been called (no teardown)
      expect(mockDisconnect).not.toHaveBeenCalled();
    });

    it('skips when status is Syncing', async () => {
      const joinPromise = joinRoomAndGetSubscribe(service);
      await flushMicrotasks();
      mockSubscribeCallback!('SUBSCRIBED');
      await joinPromise;
      // Status is Syncing

      await service.rejoinCurrentRoom();
      expect(mockDisconnect).not.toHaveBeenCalled();
    });

    it('tears down and rebuilds when Disconnected', async () => {
      // First join
      const joinPromise = joinRoomAndGetSubscribe(service);
      await flushMicrotasks();
      mockSubscribeCallback!('SUBSCRIBED');
      await joinPromise;

      // Simulate disconnect
      mockSubscribeCallback!('CHANNEL_ERROR');

      // Now rejoin — should call disconnect and create a new channel
      const rejoinPromise = service.rejoinCurrentRoom();
      // New subscribe callback is set
      await flushMicrotasks();
      mockSubscribeCallback!('SUBSCRIBED');
      await rejoinPromise;

      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // leaveRoom
  // =========================================================================

  describe('leaveRoom', () => {
    it('sets Disconnected and clears lastJoinParams', async () => {
      const joinPromise = joinRoomAndGetSubscribe(service);
      await flushMicrotasks();
      mockSubscribeCallback!('SUBSCRIBED');
      await joinPromise;

      await service.leaveRoom();

      // rejoinCurrentRoom should fail (params cleared)
      await expect(service.rejoinCurrentRoom()).rejects.toThrow(
        'cannot rejoin — no cached joinRoom params',
      );
    });
  });
});
