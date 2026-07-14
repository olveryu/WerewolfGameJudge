/**
 * WerewolfAudioOrchestrator — unit tests for ack retry + online retry limit
 *
 * Covers: L2 status listener ack retry, stopping when online retry limit is reached, dispose cleanup.
 */

import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import { createRoomSnapshot } from '@werewolf/game-engine/platform/protocol/roomSnapshot';
import type { GameState } from '@werewolf/game-engine/protocol/types';

import type { RoomConnectionStatus } from '@/features/room/model/RoomConnection';
import type { RoomCommandDispatchOutcome } from '@/features/room/session/types';

import type { WerewolfAudioOrchestratorDeps } from '../WerewolfAudioOrchestrator';
import { WerewolfAudioOrchestrator } from '../WerewolfAudioOrchestrator';
import type { PreparedAudioAck } from '../werewolfGameActions';
import { buildApiTestState } from './apiTestState';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrepareAudioAck = jest.fn<PreparedAudioAck, unknown[]>();
const mockDispatchPreparedAudioAck = jest.fn<
  Promise<RoomCommandDispatchOutcome<GameState>>,
  unknown[]
>();
let mockApplyCommittedSnapshot: ((state: GameState) => void) | null = null;

const mockPreparedAudioAckA: PreparedAudioAck = Object.freeze({
  sessionEpoch: 1,
  roomCode: 'ROOM',
  roomId: 'room-id-room',
  commandId: 'audio-ack-a',
  command: Object.freeze({ type: 'werewolf.audio.ack' }),
  controlledSeat: null,
});

const mockPreparedAudioAckB: PreparedAudioAck = Object.freeze({
  sessionEpoch: 1,
  roomCode: 'ROOM',
  roomId: 'room-id-room',
  commandId: 'audio-ack-b',
  command: Object.freeze({ type: 'werewolf.audio.ack' }),
  controlledSeat: null,
});

jest.mock('../werewolfGameActions', () => ({
  ...jest.requireActual<typeof import('../werewolfGameActions')>('../werewolfGameActions'),
  prepareAudioAck: (...args: unknown[]) => mockPrepareAudioAck(...args),
  dispatchPreparedAudioAck: async (...args: unknown[]) => {
    const outcome = await mockDispatchPreparedAudioAck(...args);
    if (outcome.kind === 'decided' && outcome.decision.kind === 'committed') {
      if (mockApplyCommittedSnapshot === null) {
        throw new Error('Committed audio command has no fake room source');
      }
      mockApplyCommittedSnapshot(outcome.decision.snapshot.state);
    }
    return outcome;
  },
}));

jest.mock('@/utils/logger', () => ({
  werewolfRuntimeLog: {
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

function createOrchestrator(overrides?: Partial<WerewolfAudioOrchestratorDeps>): {
  orchestrator: WerewolfAudioOrchestrator;
  emitStatus: (status: RoomConnectionStatus) => void;
  mockStore: { getState: jest.Mock };
  triggerStoreSubscriber: (state: unknown) => void;
} {
  let roomSubscriber:
    | ((snapshot: { state: GameState; connection: RoomConnectionStatus } | null) => void)
    | null = null;
  let currentStatus: RoomConnectionStatus = 'disconnected';

  const mockStore = {
    getState: jest.fn().mockReturnValue(null),
  };
  mockApplyCommittedSnapshot = (state) => mockStore.getState.mockReturnValue(state);

  const deps: WerewolfAudioOrchestratorDeps = {
    roomSource: {
      getSnapshot: () => {
        const state = mockStore.getState() as GameState | null;
        return state === null ? null : { state, connection: currentStatus };
      },
      subscribe: jest.fn((fn) => {
        roomSubscriber = fn;
        return () => {
          roomSubscriber = null;
        };
      }),
    },
    audio: {
      playNight: jest.fn().mockResolvedValue(undefined),
      playNightEnd: jest.fn().mockResolvedValue(undefined),
      playBeginning: jest.fn().mockResolvedValue(undefined),
      playEnding: jest.fn().mockResolvedValue(undefined),
      preloadRoles: jest.fn().mockResolvedValue(undefined),
      stopNarration: jest.fn(),
      stopBgm: jest.fn(),
      clearPreloaded: jest.fn(),
    },
    getActionsContext: jest.fn().mockReturnValue({}),
    isHost: jest.fn().mockReturnValue(true),
    isAborted: jest.fn().mockReturnValue(false),
    ...overrides,
  };

  const orchestrator = new WerewolfAudioOrchestrator(deps);

  const emitStatus = (status: RoomConnectionStatus) => {
    currentStatus = status;
    const state = mockStore.getState() as GameState | null;
    roomSubscriber?.(state === null ? null : { state, connection: status });
  };

  const triggerStoreSubscriber = (state: unknown) => {
    mockStore.getState.mockReturnValue(state);
    roomSubscriber?.({ state: state as GameState, connection: currentStatus });
  };

  return { orchestrator, emitStatus, mockStore, triggerStoreSubscriber };
}

function decidedSuccess(): RoomCommandDispatchOutcome<GameState> {
  const state = buildApiTestState({ status: GameStatus.Seated });
  return {
    kind: 'decided',
    decision: {
      kind: 'committed',
      commandId: 'audio-command',
      snapshot: createRoomSnapshot(state, 1),
      outcome: { kind: 'success' },
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WerewolfAudioOrchestrator reconnect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrepareAudioAck.mockReturnValue(mockPreparedAudioAckA);
    mockDispatchPreparedAudioAck.mockResolvedValue(decidedSuccess());
    jest.useFakeTimers();
  });

  afterEach(() => {
    mockApplyCommittedSnapshot = null;
    jest.useRealTimers();
  });

  // =========================================================================
  // L2: Status listener ack retry
  // =========================================================================

  describe('L2: ack retry on Live', () => {
    it('reuses the exact prepared command when status transitions to Live', async () => {
      const { emitStatus, mockStore, triggerStoreSubscriber } = createOrchestrator();

      mockDispatchPreparedAudioAck.mockResolvedValueOnce({
        kind: 'deliveryUnknown',
        commandId: 'audio-command',
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
      mockDispatchPreparedAudioAck.mockResolvedValue(decidedSuccess());
      mockStore.getState.mockReturnValue({ pendingAudioEffects: null });
      emitStatus('live');

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

    it('retains the prepared command when dispatch throws a protocol error', async () => {
      const { emitStatus, mockStore, triggerStoreSubscriber } = createOrchestrator();
      mockDispatchPreparedAudioAck.mockRejectedValueOnce(new Error('protocol corruption'));
      mockStore.getState.mockReturnValue({
        pendingAudioEffects: [{ audioKey: 'wolf', isEndAudio: false }],
      });

      triggerStoreSubscriber({
        pendingAudioEffects: [{ audioKey: 'wolf', isEndAudio: false }],
      });
      await jest.advanceTimersByTimeAsync(100);

      mockDispatchPreparedAudioAck.mockResolvedValue(decidedSuccess());
      mockStore.getState.mockReturnValue({ pendingAudioEffects: null });
      emitStatus('live');
      await jest.advanceTimersByTimeAsync(100);

      expect(mockPrepareAudioAck).toHaveBeenCalledTimes(1);
      expect(mockDispatchPreparedAudioAck).toHaveBeenCalledTimes(2);
      expect(mockDispatchPreparedAudioAck.mock.calls[0]?.[1]).toBe(mockPreparedAudioAckA);
      expect(mockDispatchPreparedAudioAck.mock.calls[1]?.[1]).toBe(mockPreparedAudioAckA);
    });

    it('does not retry when not host', () => {
      const { emitStatus } = createOrchestrator({
        isHost: jest.fn().mockReturnValue(false),
      });

      emitStatus('live');
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
        kind: 'deliveryUnknown',
        commandId: 'audio-command',
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

      const { werewolfRuntimeLog } = jest.requireMock<{
        werewolfRuntimeLog: { warn: jest.Mock };
      }>('@/utils/logger');

      // Should see exhaustion warning
      const exhaustionLog = (werewolfRuntimeLog.warn.mock.calls as unknown[][]).find(
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
