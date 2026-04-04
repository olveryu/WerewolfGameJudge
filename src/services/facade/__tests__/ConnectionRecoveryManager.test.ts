/**
 * ConnectionRecoveryManager — L1/L3 恢复逻辑单元测试
 *
 * 覆盖：首次 Live 不 fetch、第二次 Live fetch、reset 后重新计数、
 * L3 online 事件 fetch、dispose 清理 status listener。
 */

import { ConnectionStatus } from '@/services/types/IGameFacade';

import type { ConnectionRecoveryDeps } from '../ConnectionRecoveryManager';
import { ConnectionRecoveryManager } from '../ConnectionRecoveryManager';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../../../utils/logger', () => ({
  facadeLog: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createManager(): {
  manager: ConnectionRecoveryManager;
  deps: ConnectionRecoveryDeps;
  mockFetch: jest.Mock;
  statusListeners: Set<(status: ConnectionStatus) => void>;
  emitStatus: (status: ConnectionStatus) => void;
} {
  const statusListeners = new Set<(status: ConnectionStatus) => void>();
  const mockFetch = jest.fn().mockResolvedValue(true);

  const deps: ConnectionRecoveryDeps = {
    addStatusListener: jest.fn((fn) => {
      statusListeners.add(fn);
      return () => statusListeners.delete(fn);
    }),
    fetchStateFromDB: mockFetch,
  };

  const manager = new ConnectionRecoveryManager(deps);

  const emitStatus = (status: ConnectionStatus) => {
    statusListeners.forEach((fn) => fn(status));
  };

  return { manager, deps, mockFetch, statusListeners, emitStatus };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConnectionRecoveryManager', () => {
  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    jest.clearAllMocks();
    originalWindow = globalThis.window;
  });

  afterEach(() => {
    // Restore window
    Object.defineProperty(globalThis, 'window', { value: originalWindow, writable: true });
  });

  // =========================================================================
  // L1: SDK Reconnect
  // =========================================================================

  describe('L1: SDK reconnect → fetchStateFromDB', () => {
    it('does NOT fetch on first Live (initial connection)', () => {
      const { emitStatus, mockFetch } = createManager();

      emitStatus(ConnectionStatus.Live);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fetches on second Live (SDK reconnect)', () => {
      const { emitStatus, mockFetch } = createManager();

      emitStatus(ConnectionStatus.Live); // first — skip
      emitStatus(ConnectionStatus.Live); // second — fetch
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('fetches on every subsequent Live', () => {
      const { emitStatus, mockFetch } = createManager();

      emitStatus(ConnectionStatus.Live); // first — skip
      emitStatus(ConnectionStatus.Live); // second — fetch
      emitStatus(ConnectionStatus.Live); // third — fetch
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('ignores non-Live statuses', () => {
      const { emitStatus, mockFetch } = createManager();

      emitStatus(ConnectionStatus.Connecting);
      emitStatus(ConnectionStatus.Syncing);
      emitStatus(ConnectionStatus.Disconnected);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('resets hasBeenLive — next Live is treated as first (no fetch)', () => {
      const { manager, emitStatus, mockFetch } = createManager();

      emitStatus(ConnectionStatus.Live); // first — skip
      emitStatus(ConnectionStatus.Live); // second — fetch
      expect(mockFetch).toHaveBeenCalledTimes(1);

      manager.reset();
      mockFetch.mockClear();

      emitStatus(ConnectionStatus.Live); // first after reset — skip
      expect(mockFetch).not.toHaveBeenCalled();

      emitStatus(ConnectionStatus.Live); // second after reset — fetch
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Dispose
  // =========================================================================

  describe('dispose', () => {
    it('unsubscribes L1 status listener', () => {
      const { manager, statusListeners } = createManager();

      // Constructor registers one listener
      expect(statusListeners.size).toBe(1);

      manager.dispose();

      // After dispose, listener should be removed
      expect(statusListeners.size).toBe(0);
    });
  });
});
