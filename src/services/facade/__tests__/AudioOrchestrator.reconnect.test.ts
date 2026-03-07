/**
 * AudioOrchestrator — ack 重试 + online retry 上限单元测试
 *
 * 覆盖：L2 status listener ack 重试、online retry 达上限停止、dispose 清理。
 */

import type { GameStore } from '@werewolf/game-engine/engine/store';

import { ConnectionStatus } from '@/services/types/IGameFacade';

import type { AudioOrchestratorDeps } from '../AudioOrchestrator';
import { AudioOrchestrator } from '../AudioOrchestrator';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPostAudioAck = jest.fn().mockResolvedValue({ success: true });

jest.mock('../gameActions', () => ({
  postAudioAck: (...args: unknown[]) => mockPostAudioAck(...args),
}));

jest.mock('../../../utils/logger', () => ({
  facadeLog: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createOrchestrator(overrides?: Partial<AudioOrchestratorDeps>): {
  orchestrator: AudioOrchestrator;
  statusListeners: Set<(status: ConnectionStatus) => void>;
  emitStatus: (status: ConnectionStatus) => void;
  mockStore: { subscribe: jest.Mock; getState: jest.Mock };
  triggerStoreSubscriber: (state: unknown) => void;
} {
  const statusListeners = new Set<(status: ConnectionStatus) => void>();
  let storeSubscriber: ((state: unknown) => void) | null = null;

  const mockStore = {
    subscribe: jest.fn((fn: (state: unknown) => void) => {
      storeSubscriber = fn;
      return () => {};
    }),
    getState: jest.fn().mockReturnValue(null),
  };

  const deps: AudioOrchestratorDeps = {
    store: mockStore as unknown as GameStore,
    audioService: {
      playNightAudio: jest.fn().mockResolvedValue(undefined),
      playNightEndAudio: jest.fn().mockResolvedValue(undefined),
      playRoleBeginningAudio: jest.fn().mockResolvedValue(undefined),
      playRoleEndingAudio: jest.fn().mockResolvedValue(undefined),
      stopBgm: jest.fn(),
    } as any,
    addStatusListener: jest.fn((fn) => {
      statusListeners.add(fn);
      return () => statusListeners.delete(fn);
    }),
    getActionsContext: jest.fn().mockReturnValue({}),
    isHost: jest.fn().mockReturnValue(true),
    isAborted: jest.fn().mockReturnValue(false),
    ...overrides,
  };

  const orchestrator = new AudioOrchestrator(deps);

  const emitStatus = (status: ConnectionStatus) => {
    statusListeners.forEach((fn) => fn(status));
  };

  const triggerStoreSubscriber = (state: unknown) => {
    storeSubscriber?.(state);
  };

  return { orchestrator, statusListeners, emitStatus, mockStore, triggerStoreSubscriber };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AudioOrchestrator reconnect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // =========================================================================
  // L2: Status listener ack retry
  // =========================================================================

  describe('L2: ack retry on Live', () => {
    it('retries postAudioAck when pendingAudioAckRetry and status transitions to Live', async () => {
      const { emitStatus, mockStore, triggerStoreSubscriber } = createOrchestrator();

      // Step 1: Make postAudioAck fail → sets pendingAudioAckRetry = true internally
      mockPostAudioAck.mockResolvedValueOnce({ success: false, reason: 'network' });
      mockStore.getState.mockReturnValue({
        pendingAudioEffects: [{ audioKey: 'wolf', isEndAudio: false }],
      });

      // Trigger the store subscriber with effects (simulates state change with pendingAudioEffects)
      triggerStoreSubscriber({
        pendingAudioEffects: [{ audioKey: 'wolf', isEndAudio: false }],
      });

      // Wait for async playback + ack to complete
      await jest.advanceTimersByTimeAsync(100);

      // Step 2: Emit Live — should trigger L2 retry since ack failed
      mockPostAudioAck.mockResolvedValue({ success: true });
      mockStore.getState.mockReturnValue({ pendingAudioEffects: null });
      emitStatus(ConnectionStatus.Live);

      // Let pending promises resolve
      await jest.advanceTimersByTimeAsync(100);

      // postAudioAck should have been called: once for initial (failed) + once for retry
      expect(mockPostAudioAck).toHaveBeenCalledTimes(2);
    });

    it('does not retry when not host', () => {
      const { emitStatus } = createOrchestrator({
        isHost: jest.fn().mockReturnValue(false),
      });

      emitStatus(ConnectionStatus.Live);
      // No ack retry since not host (and pendingAudioAckRetry would be false anyway)
      expect(mockPostAudioAck).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Online retry max retries
  // =========================================================================

  describe('online retry exhaustion', () => {
    it('stops after maxOnlineRetries (5)', async () => {
      // Set up window mock
      const listeners: Record<string, (() => void)[]> = {};
      const originalWindow = globalThis.window;

      Object.defineProperty(globalThis, 'window', {
        value: {
          addEventListener: jest.fn((event: string, fn: () => void) => {
            listeners[event] = listeners[event] ?? [];
            listeners[event]!.push(fn);
          }),
          removeEventListener: jest.fn((event: string, fn: () => void) => {
            if (listeners[event]) {
              listeners[event] = listeners[event]!.filter((l) => l !== fn);
            }
          }),
        },
        writable: true,
        configurable: true,
      });

      // Mock navigator.onLine = true so the "check" path fires immediately
      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: true },
        writable: true,
        configurable: true,
      });

      const { mockStore, triggerStoreSubscriber } = createOrchestrator();

      // Make ack keep failing → triggers registerOnlineRetry
      mockPostAudioAck.mockResolvedValue({ success: false, reason: 'network' });
      mockStore.getState.mockReturnValue({
        pendingAudioEffects: [{ audioKey: 'wolf', isEndAudio: false }],
      });

      // Trigger store subscriber → playPendingAudioEffects → ack fails → registerOnlineRetry
      triggerStoreSubscriber({
        pendingAudioEffects: [{ audioKey: 'wolf', isEndAudio: false }],
      });

      // Each online retry cycle: timer fires → ack fails → re-registers → timer fires...
      // Advance through all 5 maximum retries + extra time
      for (let i = 0; i < 7; i++) {
        await jest.advanceTimersByTimeAsync(20_000);
      }

      const { facadeLog } = jest.requireMock('../../../utils/logger') as {
        facadeLog: { warn: jest.Mock; info: jest.Mock };
      };

      // Should see exhaustion warning
      const exhaustionLog = facadeLog.warn.mock.calls.find(
        (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('exhausted'),
      );
      expect(exhaustionLog).toBeDefined();

      // Restore window
      Object.defineProperty(globalThis, 'window', {
        value: originalWindow,
        writable: true,
        configurable: true,
      });
    });
  });

  // =========================================================================
  // Dispose
  // =========================================================================

  describe('dispose', () => {
    it('cleans up without errors', () => {
      const { orchestrator } = createOrchestrator();
      expect(() => orchestrator.dispose()).not.toThrow();
    });
  });

  // =========================================================================
  // Reset
  // =========================================================================

  describe('reset', () => {
    it('resets all retry state', () => {
      const { orchestrator } = createOrchestrator();
      // Should not throw
      orchestrator.reset();
      expect(orchestrator.wasAudioInterrupted).toBe(false);
    });
  });
});
