/**
 * messageRouter 单元测试
 *
 * 服务端权威架构：handleStateUpdate 统一处理所有客户端的 STATE_UPDATE。
 * Host 和 Player 走完全相同的路径，无分叉。
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
    const ctx = makeCtx({ myUid: 'host-uid' });
    const state = makeMockState();
    const msg: HostBroadcast = { type: 'STATE_UPDATE', state, revision: 3 };

    handleStateUpdate(ctx, msg);

    expect(ctx.store.applySnapshot).toHaveBeenCalledWith(state, 3);
    expect(ctx.broadcastService.markAsLive).toHaveBeenCalled();
  });

  it('should warn on dual host detection', () => {
    const { facadeLog } = jest.requireMock('../../../utils/logger') as {
      facadeLog: { warn: jest.Mock };
    };
    facadeLog.warn.mockClear();
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
    // Should warn via facadeLog
    expect(facadeLog.warn).toHaveBeenCalledWith(
      expect.stringContaining('DUAL_HOST_DETECTED'),
      expect.objectContaining({
        knownHostUid: 'host-A',
        receivedHostUid: 'host-B',
      }),
    );
  });
});
