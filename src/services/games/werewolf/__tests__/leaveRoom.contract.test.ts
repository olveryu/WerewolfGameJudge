/**
 * Contract tests for leaveRoom listener lifecycle
 *
 * Verifies that leaving a room leaves no residual store listeners that could cause memory/logic leaks.
 */

import { WerewolfStore } from '@werewolf/game-engine/werewolf/store';

import type { ConnectionManager } from '@/services/connection/ConnectionManager';
import { WerewolfFacade } from '@/services/games/werewolf/WerewolfFacade';
import type { AudioService } from '@/services/infra/AudioService';
import type { IRoomService } from '@/services/types/IRoomService';

// Mock AudioService
jest.mock('@/services/infra/AudioService', () => ({
  __esModule: true,
  AudioService: jest.fn(() => ({
    playAudio: jest.fn().mockResolvedValue(undefined),
    stopAudio: jest.fn(),
    stop: jest.fn(),
    stopBgm: jest.fn(),
    cleanup: jest.fn(),
    clearPreloaded: jest.fn(),
  })),
}));

const mockAudio = () =>
  ({
    playAudio: jest.fn().mockResolvedValue(undefined),
    stopAudio: jest.fn(),
    stop: jest.fn(),
    stopBgm: jest.fn(),
    cleanup: jest.fn(),
    clearPreloaded: jest.fn(),
  }) as unknown as AudioService;

const mockConnectionManager = () =>
  ({
    connectAndWait: jest.fn().mockResolvedValue(undefined),
    connect: jest.fn(),
    disconnect: jest.fn(),
    dispose: jest.fn(),
    manualReconnect: jest.fn(),
    addStateListener: jest.fn().mockReturnValue(() => {}),
    updateRevision: jest.fn(),
    getState: jest.fn().mockReturnValue('Idle'),
    getContext: jest.fn(),
  }) as unknown as ConnectionManager;

const createTestFacade = () =>
  new WerewolfFacade({
    store: new WerewolfStore(),
    connectionManager: mockConnectionManager(),
    audioService: mockAudio(),
    roomService: {
      getGameState: jest.fn().mockResolvedValue(null),
    } as unknown as IRoomService,
  });

describe('WerewolfFacade.leaveRoom() listener lifecycle contract', () => {
  it('should have zero listeners after leaveRoom when all subscribers have unsubscribed', async () => {
    const facade = createTestFacade();

    // Initial state should have no listeners
    expect(facade.getListenerCount()).toBe(0);

    // Simulate React component subscriptions
    const unsubscribe1 = facade.addListener(() => {});
    const unsubscribe2 = facade.addListener(() => {});
    const unsubscribe3 = facade.addListener(() => {});

    expect(facade.getListenerCount()).toBe(3);

    // Simulate cleanup on component unmount (correct behavior)
    unsubscribe1();
    unsubscribe2();
    unsubscribe3();

    expect(facade.getListenerCount()).toBe(0);

    // Call leaveRoom (listeners already cleaned up at this point)
    await facade.leaveRoom();

    // Verify: listener count is still 0
    expect(facade.getListenerCount()).toBe(0);
  });

  it('should preserve listeners after leaveRoom (store.reset does not clear listeners)', async () => {
    const facade = createTestFacade();

    // Subscribe without unsubscribing (simulates a Web screen that does not unmount)
    facade.addListener(() => {});
    facade.addListener(() => {});

    expect(facade.getListenerCount()).toBe(2);

    // Call leaveRoom
    await facade.leaveRoom();

    // store.reset() does not clear listeners — React component lifecycle (useFocusEffect) manages them
    expect(facade.getListenerCount()).toBe(2);
  });

  it('should allow unsubscribe to be called multiple times safely', async () => {
    const facade = createTestFacade();

    const unsubscribe = facade.addListener(() => {});
    expect(facade.getListenerCount()).toBe(1);

    // First unsubscribe
    unsubscribe();
    expect(facade.getListenerCount()).toBe(0);

    // Repeated calls should be safe (no-op)
    unsubscribe();
    unsubscribe();
    expect(facade.getListenerCount()).toBe(0);
  });

  it('should notify listeners with null state on leaveRoom (store.reset)', async () => {
    const facade = createTestFacade();
    const listener = jest.fn();

    facade.addListener(listener);

    // Clear any previous calls
    listener.mockClear();

    await facade.leaveRoom();

    // store.reset() notifies listeners that state has become null
    expect(listener).toHaveBeenCalledWith(null);
  });
});
