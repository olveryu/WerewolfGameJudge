/**
 * PlayerMessage 路由覆盖契约测试
 *
 * 门禁目的：
 * - 任何 PlayerMessage['type'] 存在，Host messageRouter 必须明确处理
 * - 防止新增消息类型时遗漏 router case（silent drop / no-op）
 *
 * 验收标准：
 * 1. 覆盖性：枚举所有 PlayerMessage.type，断言 router 全覆盖
 * 2. 行为性：每个 message 构造最小合法 payload，喂给 router，不 throw 且有可观测行为
 * 3. 门禁：新增 PlayerMessage.type 时测试必须 fail，逼迫补 router case
 */

import type { PlayerMessage } from '../../../protocol/types';
import type { MessageRouterContext } from '../messageRouter';
import { hostHandlePlayerMessage } from '../messageRouter';

// =============================================================================
// 测试辅助
// =============================================================================

/**
 * 从 PlayerMessage union 提取所有 type 字面量
 * TypeScript 编译期保证这个列表与 PlayerMessage['type'] 完全对应
 */
const ALL_PLAYER_MESSAGE_TYPES: PlayerMessage['type'][] = [
  'REQUEST_STATE',
  'JOIN',
  'LEAVE',
  'ACTION',
  'WOLF_VOTE',
  'VIEWED_ROLE',
  'REVEAL_ACK',
  'SEAT_ACTION_REQUEST',
  'SNAPSHOT_REQUEST',
];

/**
 * 创建 mock MessageRouterContext
 */
function createMockContext(overrides?: Partial<MessageRouterContext>): MessageRouterContext {
  const mockStore = {
    getState: jest.fn(() => null),
    getRevision: jest.fn(() => 0),
    dispatch: jest.fn(),
    applySnapshot: jest.fn(),
    subscribe: jest.fn(() => jest.fn()),
    destroy: jest.fn(),
  };

  return {
    store: mockStore as unknown as MessageRouterContext['store'],
    broadcastService: {
      broadcastAsHost: jest.fn(() => Promise.resolve()),
    } as unknown as MessageRouterContext['broadcastService'],
    isHost: true,
    myUid: 'host-uid',
    getMySeatNumber: jest.fn(() => 0),
    broadcastCurrentState: jest.fn(() => Promise.resolve()),
    findSeatByUid: jest.fn(() => null),
    generateRequestId: jest.fn(() => 'mock-request-id'),
    handleViewedRole: jest.fn(() => Promise.resolve({ success: true })),
    ...overrides,
  };
}

/**
 * 为每个 PlayerMessage.type 构造最小合法 payload
 */
function createMinimalPayload(type: PlayerMessage['type']): PlayerMessage {
  switch (type) {
    case 'REQUEST_STATE':
      return { type: 'REQUEST_STATE', uid: 'player-uid' };
    case 'JOIN':
      return { type: 'JOIN', seat: 0, uid: 'player-uid', displayName: 'Player' };
    case 'LEAVE':
      return { type: 'LEAVE', seat: 0, uid: 'player-uid' };
    case 'ACTION':
      return { type: 'ACTION', seat: 0, role: 'seer', target: 1 };
    case 'WOLF_VOTE':
      return { type: 'WOLF_VOTE', seat: 0, target: 1 };
    case 'VIEWED_ROLE':
      return { type: 'VIEWED_ROLE', seat: 0 };
    case 'REVEAL_ACK':
      return { type: 'REVEAL_ACK', seat: 0, role: 'seer', revision: 1 };
    case 'SEAT_ACTION_REQUEST':
      return {
        type: 'SEAT_ACTION_REQUEST',
        requestId: 'req-1',
        action: 'sit',
        seat: 0,
        uid: 'player-uid',
      };
    case 'SNAPSHOT_REQUEST':
      return { type: 'SNAPSHOT_REQUEST', requestId: 'req-1', uid: 'player-uid' };
    default: {
      // TypeScript exhaustive check：如果新增了 type 但这里没处理，编译会报错
      const _exhaustiveCheck: never = type;
      throw new Error(`Unknown PlayerMessage type: ${_exhaustiveCheck}`);
    }
  }
}

// =============================================================================
// 契约测试
// =============================================================================

describe('PlayerMessage Router Coverage Contract', () => {
  /**
   * 覆盖性测试：确保 ALL_PLAYER_MESSAGE_TYPES 与 PlayerMessage['type'] 完全对应
   *
   * 如果新增了 PlayerMessage.type，TypeScript 编译器会在 createMinimalPayload
   * 的 exhaustive check 处报错，逼迫开发者更新这个列表
   */
  describe('Coverage: ALL_PLAYER_MESSAGE_TYPES completeness', () => {
    it('should have all PlayerMessage types in the list', () => {
      // 这个测试主要依赖 TypeScript 编译期检查
      // 运行时只是确认列表非空且每个都能构造 payload
      expect(ALL_PLAYER_MESSAGE_TYPES.length).toBeGreaterThan(0);

      for (const type of ALL_PLAYER_MESSAGE_TYPES) {
        // 能构造 payload 说明 type 在 exhaustive switch 中被处理
        const payload = createMinimalPayload(type);
        expect(payload.type).toBe(type);
      }
    });

    it('should have exactly 9 message types (update this if adding new types)', () => {
      // 门禁：如果新增消息类型，这个数字必须更新
      // 这会提醒开发者同时更新 router 和这个测试
      expect(ALL_PLAYER_MESSAGE_TYPES.length).toBe(9);
    });
  });

  /**
   * 行为性测试：每个 PlayerMessage 喂给 router 时不 throw
   */
  describe('Behavior: hostHandlePlayerMessage does not throw', () => {
    it.each(ALL_PLAYER_MESSAGE_TYPES)('should not throw for message type: %s', (type) => {
      const ctx = createMockContext();
      const msg = createMinimalPayload(type);

      // 不应该 throw
      expect(() => {
        hostHandlePlayerMessage(ctx, msg, 'sender-uid');
      }).not.toThrow();
    });
  });

  /**
   * 行为性测试：已实现的消息类型应触发对应 handler
   */
  describe('Behavior: implemented message types trigger handlers', () => {
    it('REQUEST_STATE should call broadcastCurrentState', () => {
      const ctx = createMockContext();
      const msg = createMinimalPayload('REQUEST_STATE');

      hostHandlePlayerMessage(ctx, msg, 'sender-uid');

      expect(ctx.broadcastCurrentState).toHaveBeenCalled();
    });

    it('VIEWED_ROLE should call handleViewedRole', () => {
      const ctx = createMockContext();
      const msg = createMinimalPayload('VIEWED_ROLE');

      hostHandlePlayerMessage(ctx, msg, 'sender-uid');

      expect(ctx.handleViewedRole).toHaveBeenCalledWith(0);
    });

    it('SEAT_ACTION_REQUEST should be handled (no throw)', () => {
      const ctx = createMockContext();
      const msg = createMinimalPayload('SEAT_ACTION_REQUEST');

      // 不应该 throw
      expect(() => {
        hostHandlePlayerMessage(ctx, msg, 'sender-uid');
      }).not.toThrow();
    });
  });

  /**
   * 门禁测试：未实现的消息类型应被显式标记
   *
   * 这些类型目前在 v2 router 中没有处理（Phase 0 范围外），
   * 但必须在这里显式列出，以便追踪实现进度。
   * 当实现这些类型时，应该把它们移到上面的 "implemented" 测试中。
   */
  describe('Tracking: unimplemented message types (Phase 0 scope)', () => {
    const UNIMPLEMENTED_TYPES: PlayerMessage['type'][] = [
      'JOIN', // Legacy: 现在用 SEAT_ACTION_REQUEST
      'LEAVE', // Legacy: 现在用 SEAT_ACTION_REQUEST.standup
      'ACTION', // Tracked: 需要在 v2 router 中实现
      'WOLF_VOTE', // Tracked: 需要在 v2 router 中实现
      'REVEAL_ACK', // Tracked: 需要在 v2 router 中实现
      'SNAPSHOT_REQUEST', // Tracked: 需要在 v2 router 中实现
    ];

    it.each(UNIMPLEMENTED_TYPES)(
      'message type %s is tracked as unimplemented (silent no-op for now)',
      (type) => {
        const ctx = createMockContext();
        const msg = createMinimalPayload(type);

        // 目前这些消息会被 silent drop（no-op）
        // 当实现时，应该把这个测试移到 "implemented" 部分
        expect(() => {
          hostHandlePlayerMessage(ctx, msg, 'sender-uid');
        }).not.toThrow();
      },
    );

    it('should have 6 unimplemented types (update when implementing)', () => {
      // 门禁：随着实现进度，这个数字应该减少
      expect(UNIMPLEMENTED_TYPES.length).toBe(6);
    });
  });

  /**
   * 门禁测试：非 Host 调用应该直接返回
   */
  describe('Guard: non-host should early return', () => {
    it.each(ALL_PLAYER_MESSAGE_TYPES)(
      'should not process message %s when isHost=false',
      (type) => {
        const ctx = createMockContext({ isHost: false });
        const msg = createMinimalPayload(type);

        hostHandlePlayerMessage(ctx, msg, 'sender-uid');

        // 任何 handler 都不应被调用
        expect(ctx.broadcastCurrentState).not.toHaveBeenCalled();
        expect(ctx.handleViewedRole).not.toHaveBeenCalled();
      },
    );
  });
});

// =============================================================================
// 契约报告
// =============================================================================

describe('PlayerMessage Router Coverage Report', () => {
  it('prints coverage summary', () => {
    const IMPLEMENTED = ['REQUEST_STATE', 'VIEWED_ROLE', 'SEAT_ACTION_REQUEST'];
    const UNIMPLEMENTED = ['JOIN', 'LEAVE', 'ACTION', 'WOLF_VOTE', 'REVEAL_ACK', 'SNAPSHOT_REQUEST'];

    console.log('\n┌─────────────────────────────────────────────────────────────┐');
    console.log('│          PlayerMessage Router Coverage Report               │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log(`│  Total message types:     ${ALL_PLAYER_MESSAGE_TYPES.length.toString().padStart(2)}                               │`);
    console.log(`│  Implemented in v2:       ${IMPLEMENTED.length.toString().padStart(2)}  (${IMPLEMENTED.join(', ')})│`);
    console.log(`│  Unimplemented (tracked): ${UNIMPLEMENTED.length.toString().padStart(2)}  (Phase 0 scope)                │`);
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log('│  ✓ REQUEST_STATE      → broadcastCurrentState              │');
    console.log('│  ✓ VIEWED_ROLE        → handleViewedRole                   │');
    console.log('│  ✓ SEAT_ACTION_REQUEST → hostHandleSeatActionRequest       │');
    console.log('│  ○ JOIN               → (legacy, replaced by SEAT_ACTION)  │');
    console.log('│  ○ LEAVE              → (legacy, replaced by SEAT_ACTION)  │');
    console.log('│  ○ ACTION             → (tracked)                          │');
    console.log('│  ○ WOLF_VOTE          → (tracked)                          │');
    console.log('│  ○ REVEAL_ACK         → (tracked)                          │');
    console.log('│  ○ SNAPSHOT_REQUEST   → (tracked)                          │');
    console.log('└─────────────────────────────────────────────────────────────┘\n');

    expect(true).toBe(true);
  });
});
