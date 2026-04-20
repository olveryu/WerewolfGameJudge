/**
 * Contract tests for leaveRoom listener lifecycle
 *
 * 验证离开房间后不会有残留的 store listeners 导致内存/逻辑泄漏
 */

import { GameStore } from '@werewolf/game-engine/engine/store';

import { GameFacade } from '@/services/facade/GameFacade';

// Mock AudioService
jest.mock('../../infra/AudioService', () => ({
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
  }) as any;

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
  }) as any;

const createTestFacade = () =>
  new GameFacade({
    store: new GameStore(),
    connectionManager: mockConnectionManager(),
    audioService: mockAudio(),
    roomService: {
      getGameState: jest.fn().mockResolvedValue(null),
    } as any,
  });

describe('GameFacade.leaveRoom() listener lifecycle contract', () => {
  it('should have zero listeners after leaveRoom when all subscribers have unsubscribed', async () => {
    const facade = createTestFacade();

    // 初始状态应该没有 listeners
    expect(facade.getListenerCount()).toBe(0);

    // 模拟 React 组件订阅
    const unsubscribe1 = facade.addListener(() => {});
    const unsubscribe2 = facade.addListener(() => {});
    const unsubscribe3 = facade.addListener(() => {});

    expect(facade.getListenerCount()).toBe(3);

    // 模拟组件 unmount 时的 cleanup（正确行为）
    unsubscribe1();
    unsubscribe2();
    unsubscribe3();

    expect(facade.getListenerCount()).toBe(0);

    // 调用 leaveRoom（此时 listeners 已清理）
    await facade.leaveRoom();

    // 验证：listener 数量仍为 0
    expect(facade.getListenerCount()).toBe(0);
  });

  it('should preserve listeners after leaveRoom (store.reset does not clear listeners)', async () => {
    const facade = createTestFacade();

    // 订阅但不取消（模拟 Web 上 screen 不 unmount 的场景）
    facade.addListener(() => {});
    facade.addListener(() => {});

    expect(facade.getListenerCount()).toBe(2);

    // 调用 leaveRoom
    await facade.leaveRoom();

    // store.reset() 不清除 listeners — React 组件生命周期（useFocusEffect）自行管理
    expect(facade.getListenerCount()).toBe(2);
  });

  it('should allow unsubscribe to be called multiple times safely', async () => {
    const facade = createTestFacade();

    const unsubscribe = facade.addListener(() => {});
    expect(facade.getListenerCount()).toBe(1);

    // 第一次取消订阅
    unsubscribe();
    expect(facade.getListenerCount()).toBe(0);

    // 重复调用应该是安全的（no-op）
    unsubscribe();
    unsubscribe();
    expect(facade.getListenerCount()).toBe(0);
  });

  it('should notify listeners with null state on leaveRoom (store.reset)', async () => {
    const facade = createTestFacade();
    const listener = jest.fn();

    facade.addListener(listener);

    // 清除之前的调用（如果有）
    listener.mockClear();

    await facade.leaveRoom();

    // store.reset() 通知 listeners state 变为 null
    expect(listener).toHaveBeenCalledWith(null);
  });
});
