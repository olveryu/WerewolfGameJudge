/**
 * PlayerMessage 路由覆盖契约测试
 *
 * 门禁目的：
 * - 任何 PlayerMessage['type'] 存在，Host messageRouter 必须明确处理
 * - 防止新增消息类型时遗漏 router case（silent drop / no-op）
 *
 * PR9 升级：强门禁
 * - 不允许 silent drop：每个 type 必须有显式分支行为
 * - Legacy types 必须触发 facadeLog.warn
 * - Unimplemented types 必须触发 facadeLog.warn（除非已接入 handler）
 *
 * 验收标准：
 * 1. 覆盖性：枚举所有 PlayerMessage.type，断言 router 全覆盖
 * 2. 行为性：每个 message 构造最小合法 payload，喂给 router，有可观测行为
 * 3. 门禁：新增 PlayerMessage.type 时测试必须 fail，逼迫补 router case
 */

import type { MessageRouterContext } from '@/services/facade/messageRouter';
import { hostHandlePlayerMessage } from '@/services/facade/messageRouter';
import type { PlayerMessage } from '@/services/protocol/types';
import { facadeLog } from '@/utils/logger';

// Mock logger
jest.mock('../../../utils/logger', () => ({
  facadeLog: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

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
  'SNAPSHOT_REQUEST',
  'WOLF_ROBOT_HUNTER_STATUS_VIEWED',
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
    broadcastCurrentState: jest.fn(() => Promise.resolve()),
    handleViewedRole: jest.fn(() => Promise.resolve({ success: true })),
    handleAction: jest.fn(() => Promise.resolve({ success: true })),
    handleWolfVote: jest.fn(() => Promise.resolve({ success: true })),
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
    case 'SNAPSHOT_REQUEST':
      return { type: 'SNAPSHOT_REQUEST', requestId: 'req-1', uid: 'player-uid' };
    case 'WOLF_ROBOT_HUNTER_STATUS_VIEWED':
      return { type: 'WOLF_ROBOT_HUNTER_STATUS_VIEWED', seat: 0 };
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
    beforeEach(() => {
      jest.clearAllMocks();
    });

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

    it('ACTION should call handleAction when wired', () => {
      const ctx = createMockContext();
      const msg = createMinimalPayload('ACTION');

      hostHandlePlayerMessage(ctx, msg, 'sender-uid');

      expect(ctx.handleAction).toHaveBeenCalledWith(0, 'seer', 1, undefined);
    });

    it('WOLF_VOTE should call handleWolfVote when wired', () => {
      const ctx = createMockContext();
      const msg = createMinimalPayload('WOLF_VOTE');

      hostHandlePlayerMessage(ctx, msg, 'sender-uid');

      expect(ctx.handleWolfVote).toHaveBeenCalledWith(0, 1);
    });
  });

  /**
   * 强门禁：Legacy types 必须触发 facadeLog.warn
   *
   * PR9 升级：禁止 silent drop
   * - JOIN/LEAVE 是 legacy，已被 SEAT_ACTION_REQUEST 替代
   * - 必须 warn 提示开发者使用新入口
   */
  describe('Strong Gate: legacy types must trigger warn', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('JOIN should trigger facadeLog.warn with legacy guidance', () => {
      const ctx = createMockContext();
      const msg = createMinimalPayload('JOIN');

      hostHandlePlayerMessage(ctx, msg, 'sender-uid');

      expect(facadeLog.warn).toHaveBeenCalledWith(
        '[messageRouter] Legacy PlayerMessage type received',
        expect.objectContaining({
          type: 'JOIN',
          guidance: expect.stringContaining('HTTP API'),
        }),
      );
    });

    it('LEAVE should trigger facadeLog.warn with legacy guidance', () => {
      const ctx = createMockContext();
      const msg = createMinimalPayload('LEAVE');

      hostHandlePlayerMessage(ctx, msg, 'sender-uid');

      expect(facadeLog.warn).toHaveBeenCalledWith(
        '[messageRouter] Legacy PlayerMessage type received',
        expect.objectContaining({
          type: 'LEAVE',
          guidance: expect.stringContaining('HTTP API'),
        }),
      );
    });
  });

  /**
   * 强门禁：Unimplemented types 必须触发 warn（若无 handler）
   *
   * PR9 升级：禁止 silent drop
   * - 若 handler 未接入，必须 warn
   * - 若 handler 已接入，不应 warn
   */
  describe('Strong Gate: unimplemented types without handler must trigger warn', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('ACTION without handleAction should trigger warn', () => {
      const ctx = createMockContext({ handleAction: undefined });
      const msg = createMinimalPayload('ACTION');

      hostHandlePlayerMessage(ctx, msg, 'sender-uid');

      expect(facadeLog.warn).toHaveBeenCalledWith(
        '[messageRouter] ACTION received but handleAction not wired',
        expect.objectContaining({ type: 'ACTION' }),
      );
    });

    it('WOLF_VOTE without handleWolfVote should trigger warn', () => {
      const ctx = createMockContext({ handleWolfVote: undefined });
      const msg = createMinimalPayload('WOLF_VOTE');

      hostHandlePlayerMessage(ctx, msg, 'sender-uid');

      expect(facadeLog.warn).toHaveBeenCalledWith(
        '[messageRouter] WOLF_VOTE received but handleWolfVote not wired',
        expect.objectContaining({ type: 'WOLF_VOTE' }),
      );
    });

    it('REVEAL_ACK should call handleRevealAck when wired', async () => {
      const mockHandleRevealAck = jest.fn().mockResolvedValue({ success: true });
      // 需要让 store.getRevision() 返回 1，与 createMinimalPayload 中的 revision 匹配
      const mockStore = {
        getState: jest.fn(() => null),
        getRevision: jest.fn(() => 1), // 匹配 createMinimalPayload('REVEAL_ACK').revision
        dispatch: jest.fn(),
        applySnapshot: jest.fn(),
        subscribe: jest.fn(() => jest.fn()),
        destroy: jest.fn(),
      };
      const ctx = createMockContext({
        handleRevealAck: mockHandleRevealAck,
        store: mockStore as unknown as MessageRouterContext['store'],
      });
      const msg = createMinimalPayload('REVEAL_ACK');

      await hostHandlePlayerMessage(ctx, msg, 'sender-uid');

      expect(mockHandleRevealAck).toHaveBeenCalled();
    });

    it('SNAPSHOT_REQUEST should trigger warn (currently unimplemented)', () => {
      const ctx = createMockContext();
      const msg = createMinimalPayload('SNAPSHOT_REQUEST');

      hostHandlePlayerMessage(ctx, msg, 'sender-uid');

      expect(facadeLog.warn).toHaveBeenCalledWith(
        '[messageRouter] Unimplemented PlayerMessage type',
        expect.objectContaining({ type: 'SNAPSHOT_REQUEST' }),
      );
    });
  });

  /**
   * 实现进度追踪
   */
  describe('Implementation Progress Tracking', () => {
    const IMPLEMENTED_TYPES: PlayerMessage['type'][] = [
      'REQUEST_STATE',
      'VIEWED_ROLE',
      'ACTION', // PR9: now wired via handleAction
      'WOLF_VOTE', // PR9: now wired via handleWolfVote
      'REVEAL_ACK', // P0-FIX: now wired via handleRevealAck
      'WOLF_ROBOT_HUNTER_STATUS_VIEWED', // WolfRobot Hunter gate ack
    ];

    const LEGACY_TYPES: PlayerMessage['type'][] = [
      'JOIN', // Legacy: 现在用 HTTP API /api/game/seat
      'LEAVE', // Legacy: 现在用 HTTP API /api/game/seat
    ];

    const UNIMPLEMENTED_TYPES: PlayerMessage['type'][] = [
      'SNAPSHOT_REQUEST', // Tracked: reserved for future differential sync
    ];

    it('should have 6 implemented types', () => {
      expect(IMPLEMENTED_TYPES.length).toBe(6);
    });

    it('should have 2 legacy types', () => {
      expect(LEGACY_TYPES.length).toBe(2);
    });

    it('should have 1 unimplemented types', () => {
      expect(UNIMPLEMENTED_TYPES.length).toBe(1);
    });

    it('all types should be accounted for', () => {
      const allAccountedTypes = [...IMPLEMENTED_TYPES, ...LEGACY_TYPES, ...UNIMPLEMENTED_TYPES];
      const expectedTypes = [...ALL_PLAYER_MESSAGE_TYPES];
      // Sort alphabetically for comparison
      allAccountedTypes.sort((a, b) => a.localeCompare(b));
      expectedTypes.sort((a, b) => a.localeCompare(b));
      expect(allAccountedTypes).toEqual(expectedTypes);
    });
  });

  /**
   * 门禁测试：非 Host 调用应该直接返回
   */
  describe('Guard: non-host should early return', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it.each(ALL_PLAYER_MESSAGE_TYPES)('should not process message %s when isHost=false', (type) => {
      const ctx = createMockContext({ isHost: false });
      const msg = createMinimalPayload(type);

      hostHandlePlayerMessage(ctx, msg, 'sender-uid');

      // 任何 handler 都不应被调用
      expect(ctx.broadcastCurrentState).not.toHaveBeenCalled();
      expect(ctx.handleViewedRole).not.toHaveBeenCalled();
      expect(ctx.handleAction).not.toHaveBeenCalled();
      expect(ctx.handleWolfVote).not.toHaveBeenCalled();
      // warn 也不应被调用（直接 early return）
      expect(facadeLog.warn).not.toHaveBeenCalled();
    });
  });
});

// =============================================================================
// 契约报告
// =============================================================================

describe('PlayerMessage Router Coverage Report', () => {
  it('validates coverage expectations', () => {
    const IMPLEMENTED = [
      'REQUEST_STATE',
      'VIEWED_ROLE',
      'ACTION',
      'WOLF_VOTE',
      'REVEAL_ACK',
      'WOLF_ROBOT_HUNTER_STATUS_VIEWED',
    ];
    const LEGACY = ['JOIN', 'LEAVE'];
    const UNIMPLEMENTED = ['SNAPSHOT_REQUEST'];

    // Validate counts instead of printing
    expect(IMPLEMENTED.length).toBe(6);
    expect(LEGACY.length).toBe(2);
    expect(UNIMPLEMENTED.length).toBe(1);
    expect(ALL_PLAYER_MESSAGE_TYPES.length).toBe(
      IMPLEMENTED.length + LEGACY.length + UNIMPLEMENTED.length,
    );
  });
});
