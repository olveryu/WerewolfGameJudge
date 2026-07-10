/**
 * AudioOrchestrator — unit tests for ack retry + online retry limit
 *
 * Covers: L2 status listener ack retry, stopping when online retry limit is reached, dispose cleanup.
 */

import type { GameStore } from '@werewolf/game-engine/engine/store';
import type { ActionResult } from '@werewolf/game-engine/protocol/ActionResult';

import { ConnectionStatus } from '@/services/types/IGameFacade';

import type { AudioOrchestratorDeps } from '../AudioOrchestrator';
import { AudioOrchestrator } from '../AudioOrchestrator';
import type { PreparedAudioAck } from '../gameActions';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrepareAudioAck = jest.fn<PreparedAudioAck | null, unknown[]>();
const mockDispatchPreparedAudioAck = jest.fn<Promise<ActionResult>, unknown[]>();

const mockPreparedAudioAckA: PreparedAudioAck = Object.freeze({
  roomCode: 'ROOM',
  commandId: 'audio-ack-a',
  command: Object.freeze({ type: 'werewolf.audio.ack' }),
  controlledSeat: null,
});

const mockPreparedAudioAckB: PreparedAudioAck = Object.freeze({
  roomCode: 'ROOM',
  commandId: 'audio-ack-b',
  command: Object.freeze({ type: 'werewolf.audio.ack' }),
  controlledSeat: null,
});

jest.mock('../gameActions', () => ({
  prepareAudioAck: (...args: unknown[]) => mockPrepareAudioAck(...args),
  dispatchPreparedAudioAck: (...args: unknown[]) => mockDispatchPreparedAudioAck(...args),
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
    } as unknown as AudioOrchestratorDeps['audioService'],
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
    mockPrepareAudioAck.mockReturnValue(mockPreparedAudioAckA);
    mockDispatchPreparedAudioAck.mockResolvedValue({ success: true });
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // =========================================================================
  // L2: Status listener ack retry
  // =========================================================================

  describe('L2: ack retry on Live', () => {
    it('reuses the exact prepared command when status transitions to Live', async () => {
      const { emitStatus, mockStore, triggerStoreSubscriber } = createOrchestrator();

      mockDispatchPreparedAudioAck.mockResolvedValueOnce({
        success: false,
        reason: 'NETWORK_ERROR',
      });
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
      mockDispatchPreparedAudioAck.mockResolvedValue({ success: true });
      mockStore.getState.mockReturnValue({ pendingAudioEffects: null });
      emitStatus(ConnectionStatus.Live);

      // Let pending promises resolve
      await jest.advanceTimersByTimeAsync(100);

      expect(mockPrepareAudioAck).toHaveBeenCalledTimes(1);
      expect(mockDispatchPreparedAudioAck).toHaveBeenCalledTimes(2);
      expect(mockDispatchPreparedAudioAck.mock.calls[0]?.[1]).toBe(mockPreparedAudioAckA);
      expect(mockDispatchPreparedAudioAck.mock.calls[1]?.[1]).toBe(mockPreparedAudioAckA);
    });

    it('mints a new prepared command only after the prior ack is confirmed', async () => {
      const { mockStore, triggerStoreSubscriber } = createOrchestrator();
      mockPrepareAudioAck
        .mockReturnValueOnce(mockPreparedAudioAckA)
        .mockReturnValueOnce(mockPreparedAudioAckB);
      mockStore.getState.mockReturnValue({ pendingAudioEffects: null });

      triggerStoreSubscriber({
        pendingAudioEffects: [{ audioKey: 'wolf', isEndAudio: false }],
      });
      await jest.advanceTimersByTimeAsync(100);

      triggerStoreSubscriber({
        pendingAudioEffects: [{ audioKey: 'seer', isEndAudio: false }],
      });
      await jest.advanceTimersByTimeAsync(100);

      expect(mockPrepareAudioAck).toHaveBeenCalledTimes(2);
      expect(mockDispatchPreparedAudioAck.mock.calls[0]?.[1]).toBe(mockPreparedAudioAckA);
      expect(mockDispatchPreparedAudioAck.mock.calls[1]?.[1]).toBe(mockPreparedAudioAckB);
    });

    it('does not retry when not host', () => {
      const { emitStatus } = createOrchestrator({
        isHost: jest.fn().mockReturnValue(false),
      });

      emitStatus(ConnectionStatus.Live);
      // No ack retry since not host (and pendingAudioAckRetry would be false anyway)
      expect(mockPrepareAudioAck).not.toHaveBeenCalled();
      expect(mockDispatchPreparedAudioAck).not.toHaveBeenCalled();
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
            listeners[event].push(fn);
          }),
          removeEventListener: jest.fn((event: string, fn: () => void) => {
            if (listeners[event]) {
              listeners[event] = listeners[event].filter((l) => l !== fn);
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
      mockDispatchPreparedAudioAck.mockResolvedValue({
        success: false,
        reason: 'NETWORK_ERROR',
      });
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

      const { facadeLog } = jest.requireMock<{
        facadeLog: { warn: jest.Mock };
      }>('../../../utils/logger');

      // Should see exhaustion warning
      const exhaustionLog = (facadeLog.warn.mock.calls as unknown[][]).find(
        (call) => typeof call[0] === 'string' && call[0].includes('exhausted'),
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
