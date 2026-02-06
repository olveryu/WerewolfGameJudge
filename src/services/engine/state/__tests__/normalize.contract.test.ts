/**
 * normalize.contract.test.ts - normalizeState 契约测试
 *
 * 确保 normalizeState 正确透传 BroadcastGameState 的所有字段。
 * 当新增字段时，如果忘记在 normalizeState 中透传，此测试会失败。
 */

import { normalizeState } from '../normalize';
import type { BroadcastGameState } from '../../../protocol/types';

/**
 * BroadcastGameState 的所有顶层字段列表（单一真相）
 *
 * 当向 BroadcastGameState 新增字段时：
 * 1. 在此列表添加字段名
 * 2. 在 normalizeState 中添加透传
 * 3. 运行此测试验证
 */
const BROADCAST_GAME_STATE_FIELDS: (keyof BroadcastGameState)[] = [
  // 核心必填字段
  'roomCode',
  'hostUid',
  'status',
  'templateRoles',
  'players',
  'currentActionerIndex',
  'isAudioPlaying',

  // 开牌动画配置
  'roleRevealAnimation',
  'resolvedRoleRevealAnimation',
  'roleRevealRandomNonce',

  // Night flow 状态
  'currentStepId',

  // 执行状态
  'actions',
  'currentNightResults',
  'pendingRevealAcks',
  'lastNightDeaths',

  // 梦魇封锁
  'nightmareBlockedSeat',
  'wolfKillDisabled',

  // 机械狼伪装上下文
  'wolfRobotContext',

  // 角色特定上下文
  'witchContext',
  'seerReveal',
  'psychicReveal',
  'gargoyleReveal',
  'wolfRobotReveal',
  'wolfRobotHunterStatusViewed',
  'confirmStatus',
  'actionRejected',

  // Debug 模式
  'debugMode',

  // UI Hints
  'ui',
];

describe('normalizeState contract', () => {
  /**
   * 创建一个包含所有字段的完整 BroadcastGameState
   */
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const createFullState = (): BroadcastGameState => {
    return {
      // 核心必填字段
      roomCode: 'TEST',
      hostUid: 'host-uid',
      status: 'ongoing',
      templateRoles: ['villager', 'wolf'],
      players: {
        1: { uid: 'p1', seatNumber: 1, hasViewedRole: true },
      },
      currentActionerIndex: 0,
      isAudioPlaying: false,

      // 开牌动画配置
      roleRevealAnimation: 'flip',
      resolvedRoleRevealAnimation: 'flip',
      roleRevealRandomNonce: 'nonce-123',

      // Night flow 状态
      currentStepId: 'wolfKill',

      // 执行状态
      actions: [{ schemaId: 'wolfKill', actorSeat: 1, targetSeat: 2, timestamp: Date.now() }],
      currentNightResults: { wolfVotesBySeat: { '1': 2 } },
      pendingRevealAcks: ['seer-1'],
      lastNightDeaths: [3],

      // 梦魇封锁
      nightmareBlockedSeat: 5,
      wolfKillDisabled: true,

      // 机械狼伪装上下文
      wolfRobotContext: { learnedSeat: 4, disguisedRole: 'seer' },

      // 角色特定上下文
      witchContext: { killedIndex: 2, canSave: true, canPoison: true },
      seerReveal: { targetSeat: 3, result: '好人' },
      psychicReveal: { targetSeat: 4, result: 'seer' },
      gargoyleReveal: { targetSeat: 5, result: '好人阵营' },
      wolfRobotReveal: { targetSeat: 6, result: 'seer', learnedRoleId: 'seer' },
      wolfRobotHunterStatusViewed: true,
      confirmStatus: { role: 'hunter', canShoot: true },
      actionRejected: {
        action: 'witchAction',
        reason: 'already_used',
        targetUid: 'p1',
        rejectionId: 'rej-1',
      },

      // Debug 模式
      debugMode: { botsEnabled: true },
    };
  }

  it('should preserve all BroadcastGameState fields after normalization', () => {
    const fullState = createFullState();
    const normalized = normalizeState(fullState);

    // 检查所有字段都被透传
    for (const field of BROADCAST_GAME_STATE_FIELDS) {
      expect(normalized).toHaveProperty(field);
      // 对于必填字段，值应该相等
      // 对于可选字段，如果原始有值，归一化后也应该有值
      if (fullState[field] !== undefined) {
        expect(normalized[field]).toBeDefined();
      }
    }
  });

  it('should not drop any fields during normalization (snapshot)', () => {
    const fullState = createFullState();
    const normalized = normalizeState(fullState);

    // 获取归一化后的所有字段
    const normalizedFields = Object.keys(normalized) as (keyof BroadcastGameState)[];

    // 确保 BROADCAST_GAME_STATE_FIELDS 覆盖了所有字段
    // 如果归一化后有新字段不在列表中，测试会失败
    for (const field of normalizedFields) {
      expect(BROADCAST_GAME_STATE_FIELDS).toContain(field);
    }

    // 确保列表中的所有字段都在归一化结果中
    for (const field of BROADCAST_GAME_STATE_FIELDS) {
      expect(normalizedFields).toContain(field);
    }
  });

  it('should preserve debugMode.botsEnabled value exactly', () => {
    const stateWithDebugMode = createFullState();
    stateWithDebugMode.debugMode = { botsEnabled: true };

    const normalized = normalizeState(stateWithDebugMode);

    expect(normalized.debugMode).toEqual({ botsEnabled: true });
  });

  it('should preserve undefined optional fields as undefined', () => {
    const minimalState: BroadcastGameState = {
      roomCode: 'TEST',
      hostUid: 'host-uid',
      status: 'unseated',
      templateRoles: ['villager'],
      players: {},
      currentActionerIndex: -1,
      isAudioPlaying: false,
    };

    const normalized = normalizeState(minimalState);

    // 可选字段应该保持 undefined
    expect(normalized.debugMode).toBeUndefined();
    expect(normalized.witchContext).toBeUndefined();
    expect(normalized.seerReveal).toBeUndefined();
  });
});
