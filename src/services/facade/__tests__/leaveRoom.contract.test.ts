/**
 * Contract tests for leaveRoom listener lifecycle
 *
 * 验证离开房间后不会有残留的 store listeners 导致内存/逻辑泄漏
 */

import { GameStore } from '@/services/engine/store';
import { GameFacade } from '@/services/facade/GameFacade';

// Mock BroadcastService
jest.mock('../../transport/BroadcastService', () => ({
  BroadcastService: jest.fn().mockImplementation(() => ({
    joinRoom: jest.fn().mockResolvedValue(undefined),
    leaveRoom: jest.fn().mockResolvedValue(undefined),
    broadcastAsHost: jest.fn(),
    sendToHost: jest.fn().mockResolvedValue(undefined),
    markAsLive: jest.fn(),
    addStatusListener: jest.fn().mockReturnValue(() => {}),
  })),
}));

// Mock AudioService
jest.mock('../../infra/AudioService', () => ({
  __esModule: true,
  AudioService: jest.fn(() => ({
    playAudio: jest.fn().mockResolvedValue(undefined),
    stopAudio: jest.fn(),
    cleanup: jest.fn(),
  })),
}));

// Mock HostStateCache
jest.mock('../../infra/HostStateCache', () => ({
  HostStateCache: jest.fn(() => ({
    saveState: jest.fn(),
    loadState: jest.fn().mockResolvedValue(null),
    getState: jest.fn().mockReturnValue(null),
    clearState: jest.fn(),
  })),
}));

const mockHostStateCache = () =>
  ({
    saveState: jest.fn(),
    loadState: jest.fn().mockResolvedValue(null),
    getState: jest.fn().mockReturnValue(null),
    clearState: jest.fn(),
  }) as any;

const mockAudio = () =>
  ({
    playAudio: jest.fn().mockResolvedValue(undefined),
    stopAudio: jest.fn(),
    cleanup: jest.fn(),
  }) as any;

const createTestFacade = () =>
  new GameFacade({
    store: new GameStore(),
    broadcastService: new (jest.requireMock('../../transport/BroadcastService').BroadcastService)(),
    audioService: mockAudio(),
    hostStateCache: mockHostStateCache(),
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

  it('should preserve listeners after leaveRoom (reset does not clear listeners)', async () => {
    const facade = createTestFacade();

    // 订阅但不取消（模拟组件未正确 cleanup）
    facade.addListener(() => {});
    facade.addListener(() => {});

    expect(facade.getListenerCount()).toBe(2);

    // 调用 leaveRoom
    await facade.leaveRoom();

    // 当前设计：reset() 不清除 listeners，这是预期行为
    // 因为 React useEffect 的 listener 生命周期独立于 store
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

  it('should notify listeners with null state on leaveRoom', async () => {
    const facade = createTestFacade();
    const listener = jest.fn();

    facade.addListener(listener);

    // 清除之前的调用（如果有）
    listener.mockClear();

    await facade.leaveRoom();

    // reset() 会通知 listeners state 变为 null
    expect(listener).toHaveBeenCalledWith(null);
  });
});
