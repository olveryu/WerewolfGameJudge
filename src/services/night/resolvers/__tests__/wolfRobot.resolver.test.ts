/**
 * WolfRobot Learn Resolver Unit Tests
 *
 * Tests for wolfRobotLearnResolver validation and canShootAsHunter logic.
 *
 * Key Contract:
 * - canShootAsHunter is computed from currentNightResults.poisonedSeat
 * - poisonedSeat is written by witch resolver (single source of truth)
 * - canShootAsHunter = true if learned hunter AND NOT poisoned by witch
 * - canShootAsHunter = false if learned hunter AND poisoned by witch
 */

import { wolfRobotLearnResolver } from '@/services/night/resolvers/wolfRobot';
import type { ResolverContext, ActionInput } from '@/services/night/resolvers/types';
import type { RoleId } from '@/models/roles';

// =============================================================================
// Test Helpers
// =============================================================================

function createContext(overrides: Partial<ResolverContext> = {}): ResolverContext {
  const defaultPlayers = new Map<number, RoleId>([
    [0, 'wolfRobot'], // wolfRobot at seat 0
    [1, 'hunter'], // hunter at seat 1
    [2, 'villager'],
    [3, 'seer'],
    [4, 'witch'],
    [5, 'wolf'],
  ]);

  return {
    actorSeat: 0, // wolfRobot
    actorRoleId: 'wolfRobot',
    players: defaultPlayers,
    currentNightResults: {},
    gameState: {
      isNight1: true,
    },
    ...overrides,
  };
}

function createInput(target: number): ActionInput {
  return {
    schemaId: 'wolfRobotLearn',
    target,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('wolfRobotLearnResolver', () => {
  describe('基础校验', () => {
    it('应该拒绝无效目标', () => {
      const ctx = createContext();
      const input = createInput(99); // seat 99 doesn't exist

      const result = wolfRobotLearnResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('不存在');
    });

    it('应该成功学习村民身份', () => {
      const ctx = createContext();
      const input = createInput(2); // villager

      const result = wolfRobotLearnResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.learnedRoleId).toBe('villager');
      expect(result.result?.canShootAsHunter).toBeUndefined(); // only set for hunter
    });

    it('应该成功学习预言家身份', () => {
      const ctx = createContext();
      const input = createInput(3); // seer

      const result = wolfRobotLearnResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.learnedRoleId).toBe('seer');
      expect(result.result?.canShootAsHunter).toBeUndefined();
    });
  });

  describe('learnedRoleId REQUIRED 合约', () => {
    /**
     * Contract: learnedRoleId 是 REQUIRED 字段，永不缺失
     *
     * 当 wolfRobotLearn resolver 返回 valid=true 时：
     * - result.learnedRoleId 必须是有效的 RoleId
     * - result.identityResult 必须与 learnedRoleId 相等
     *
     * 这确保 actionHandler.buildRevealPayload 可以安全地构建 wolfRobotReveal
     * 而不会出现 "identityResult 有但 learnedRoleId 缺失" 的 bug
     */

    it('成功学习时 learnedRoleId 必须存在且为有效 RoleId', () => {
      const ctx = createContext();
      const input = createInput(1); // hunter

      const result = wolfRobotLearnResolver(ctx, input);

      expect(result.valid).toBe(true);
      // REQUIRED: learnedRoleId must be defined
      expect(result.result?.learnedRoleId).toBeDefined();
      expect(typeof result.result?.learnedRoleId).toBe('string');
      expect(result.result?.learnedRoleId).toBe('hunter');
    });

    it('learnedRoleId 与 identityResult 必须一致', () => {
      const roles: Array<{ seat: number; expectedRole: string }> = [
        { seat: 1, expectedRole: 'hunter' },
        { seat: 2, expectedRole: 'villager' },
        { seat: 3, expectedRole: 'seer' },
        { seat: 4, expectedRole: 'witch' },
        { seat: 5, expectedRole: 'wolf' },
      ];

      for (const { seat, expectedRole } of roles) {
        const ctx = createContext();
        const input = createInput(seat);

        const result = wolfRobotLearnResolver(ctx, input);

        expect(result.valid).toBe(true);
        // Both must be the same and non-undefined
        expect(result.result?.learnedRoleId).toBe(expectedRole);
        expect(result.result?.identityResult).toBe(expectedRole);
      }
    });
  });

  describe('canShootAsHunter 单一真相合约', () => {
    /**
     * Contract: poisonedSeat 是女巫毒人的单一真相字段
     *
     * 写入路径: witch resolver → updates.poisonedSeat
     * 读取路径: wolfRobot resolver → currentNightResults.poisonedSeat
     *
     * 时序保证: NIGHT_STEPS 中 witchAction (index ~8) 在 wolfRobotLearn (index ~11) 之前
     */

    it('学到猎人 + 未被毒 → canShootAsHunter === true', () => {
      // GIVEN: poisonedSeat 不是 wolfRobot 的座位
      const ctx = createContext({
        currentNightResults: {
          poisonedSeat: 2, // 毒了村民，不是 wolfRobot (seat 0)
        },
      });
      const input = createInput(1); // learn hunter

      // WHEN: wolfRobotLearn 学到 hunter
      const result = wolfRobotLearnResolver(ctx, input);

      // THEN: canShootAsHunter === true
      expect(result.valid).toBe(true);
      expect(result.result?.learnedRoleId).toBe('hunter');
      expect(result.result?.canShootAsHunter).toBe(true);
    });

    it('学到猎人 + 被毒 → canShootAsHunter === false', () => {
      // GIVEN: poisonedSeat === wolfRobot 的座位 (seat 0)
      const ctx = createContext({
        currentNightResults: {
          poisonedSeat: 0, // wolfRobot 被女巫毒了
        },
      });
      const input = createInput(1); // learn hunter

      // WHEN: wolfRobotLearn 学到 hunter
      const result = wolfRobotLearnResolver(ctx, input);

      // THEN: canShootAsHunter === false (被毒不能开枪)
      expect(result.valid).toBe(true);
      expect(result.result?.learnedRoleId).toBe('hunter');
      expect(result.result?.canShootAsHunter).toBe(false);
    });

    it('学到猎人 + 女巫未毒人 → canShootAsHunter === true', () => {
      // GIVEN: poisonedSeat === undefined (女巫没有毒人)
      const ctx = createContext({
        currentNightResults: {
          // poisonedSeat 未设置
        },
      });
      const input = createInput(1); // learn hunter

      // WHEN: wolfRobotLearn 学到 hunter
      const result = wolfRobotLearnResolver(ctx, input);

      // THEN: canShootAsHunter === true (未被毒)
      expect(result.valid).toBe(true);
      expect(result.result?.learnedRoleId).toBe('hunter');
      expect(result.result?.canShootAsHunter).toBe(true);
    });

    it('学到非猎人角色 → canShootAsHunter === undefined', () => {
      const ctx = createContext({
        currentNightResults: {
          poisonedSeat: 0, // wolfRobot 被毒
        },
      });
      const input = createInput(3); // learn seer (not hunter)

      const result = wolfRobotLearnResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.learnedRoleId).toBe('seer');
      // canShootAsHunter 只在学到猎人时设置
      expect(result.result?.canShootAsHunter).toBeUndefined();
    });
  });

  describe('魔术师交换后的身份学习', () => {
    it('学到被交换的座位，应该获取交换后的身份', () => {
      // 座位 1 (hunter) 和座位 3 (seer) 被魔术师交换
      const ctx = createContext({
        currentNightResults: {
          swappedSeats: [1, 3] as const, // hunter ↔ seer
        },
      });
      const input = createInput(1); // target seat 1 (原本是 hunter)

      const result = wolfRobotLearnResolver(ctx, input);

      expect(result.valid).toBe(true);
      // 交换后 seat 1 是 seer 的身份
      expect(result.result?.learnedRoleId).toBe('seer');
      expect(result.result?.canShootAsHunter).toBeUndefined();
    });

    it('学到交换后成为猎人的座位 + 未被毒 → canShootAsHunter === true', () => {
      // 座位 1 (hunter) 和座位 3 (seer) 被魔术师交换
      // 交换后 seat 3 变成 hunter
      const ctx = createContext({
        currentNightResults: {
          swappedSeats: [1, 3] as const,
        },
      });
      const input = createInput(3); // target seat 3 (交换后是 hunter)

      const result = wolfRobotLearnResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.learnedRoleId).toBe('hunter');
      expect(result.result?.canShootAsHunter).toBe(true);
    });
  });
});
