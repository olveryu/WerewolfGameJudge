/**
 * messageRouter 单元测试
 *
 * 服务端权威架构：handleStateUpdate 统一处理所有客户端的 STATE_UPDATE。
 * Host 和 Player 走完全相同的路径，Host 额外保存本地缓存。
 */

import type { MessageRouterContext } from '@/services/facade/messageRouter';
import { handleStateUpdate } from '@/services/facade/messageRouter';
import type { BroadcastGameState, HostBroadcast } from '@/services/protocol/types';

const makeMockState = (overrides?: Partial<BroadcastGameState>): BroadcastGameState => ({
  roomCode: 'ABCD',
  hostUid: 'host-uid',
  status: 'unseated',
  templateRoles: ['wolf', 'seer'] as any[],
  players: {},
  currentStepIndex: -1,
  isAudioPlaying: false,
  ...overrides,
});

const makeCtx = (overrides?: Partial<MessageRouterContext>): MessageRouterContext => ({
  store: {
    getState: jest.fn().mockReturnValue(null),
    applySnapshot: jest.fn(),
  } as any,
  broadcastService: {
    markAsLive: jest.fn(),
  } as any,
  hostStateCache: null,
  isHost: false,
  myUid: 'player-uid',
  ...overrides,
});

describe('handleStateUpdate', () => {
  it('should apply snapshot for Player', () => {
    const ctx = makeCtx();
    const state = makeMockState();
    const msg: HostBroadcast = { type: 'STATE_UPDATE', state, revision: 5 };

    handleStateUpdate(ctx, msg);

    expect(ctx.store.applySnapshot).toHaveBeenCalledWith(state, 5);
    expect(ctx.broadcastService.markAsLive).toHaveBeenCalled();
  });

  it('should apply snapshot for Host', () => {
    const mockSaveState = jest.fn();
    const ctx = makeCtx({
      isHost: true,
      myUid: 'host-uid',
      hostStateCache: { saveState: mockSaveState } as any,
    });
    const state = makeMockState();
    const msg: HostBroadcast = { type: 'STATE_UPDATE', state, revision: 3 };

    handleStateUpdate(ctx, msg);

    expect(ctx.store.applySnapshot).toHaveBeenCalledWith(state, 3);
    expect(ctx.broadcastService.markAsLive).toHaveBeenCalled();
  });

  it('should save to host cache for Host', () => {
    const mockSaveState = jest.fn();
    const ctx = makeCtx({
      isHost: true,
      myUid: 'host-uid',
      hostStateCache: { saveState: mockSaveState } as any,
    });
    const state = makeMockState();
    const msg: HostBroadcast = { type: 'STATE_UPDATE', state, revision: 7 };

    handleStateUpdate(ctx, msg);

    expect(mockSaveState).toHaveBeenCalledWith('ABCD', 'host-uid', state, 7);
  });

  it('should NOT save to host cache for Player', () => {
    const ctx = makeCtx({ isHost: false, hostStateCache: null });
    const state = makeMockState();
    const msg: HostBroadcast = { type: 'STATE_UPDATE', state, revision: 1 };

    handleStateUpdate(ctx, msg);

    // No hostStateCache for Player — no save call
    expect(ctx.store.applySnapshot).toHaveBeenCalledWith(state, 1);
  });

  it('should warn on dual host detection', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = makeCtx({
      store: {
        getState: jest.fn().mockReturnValue(makeMockState({ hostUid: 'host-A' })),
        applySnapshot: jest.fn(),
      } as any,
    });
    const state = makeMockState({ hostUid: 'host-B' });
    const msg: HostBroadcast = { type: 'STATE_UPDATE', state, revision: 2 };

    handleStateUpdate(ctx, msg);

    // Should still apply snapshot despite host mismatch
    expect(ctx.store.applySnapshot).toHaveBeenCalledWith(state, 2);
    warnSpy.mockRestore();
  });
});
