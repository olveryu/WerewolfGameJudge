/**
 * Swap Integration Tests
 *
 * 验证 swap 协议的完整性：
 * 1. Handler contract: swap 输入 shape
 * 2. 查验对齐: seer/psychic 查验必须按 swap 后身份
 * 3. 死亡结算对齐: 死亡必须按 swap 规则
 *
 * 强制约束（MUST）：
 * - swap 唯一输入方式: extra.targets: [seatA, seatB]
 * - target 必须为 null
 * - swappedSeats 是 BroadcastGameState 的单一真相
 */

import { magicianSwapResolver } from '../magician';
import { seerCheckResolver } from '../seer';
import { psychicCheckResolver } from '../psychic';
import { gargoyleCheckResolver } from '../gargoyle';
import { wolfRobotLearnResolver } from '../wolfRobot';
import { calculateDeaths } from '../../../DeathCalculator';
import type { ResolverContext, ActionInput, CurrentNightResults } from '../types';
import type { RoleId } from '../../../../models/roles/spec/specs';

// =============================================================================
// Test Helpers
// =============================================================================

function createPlayers(
  seats: Array<[number, RoleId]>,
): ReadonlyMap<number, RoleId> {
  return new Map(seats);
}

function createContext(
  actorSeat: number,
  actorRoleId: RoleId,
  players: ReadonlyMap<number, RoleId>,
  currentNightResults: CurrentNightResults = {},
): ResolverContext {
  return {
    actorSeat,
    actorRoleId,
    players,
    currentNightResults,
    gameState: { isNight1: true },
  };
}

// =============================================================================
// 1. Handler Contract: Swap 输入 shape
// =============================================================================

describe('Swap 输入协议 (handler contract)', () => {
  const players = createPlayers([
    [0, 'villager'],
    [1, 'wolf'],
    [2, 'seer'],
    [3, 'magician'],
  ]);

  describe('正确的输入格式', () => {
    it('targets=[seatA, seatB] → 成功写入 swappedSeats', () => {
      const ctx = createContext(3, 'magician', players);
      const input: ActionInput = {
        schemaId: 'magicianSwap',
        targets: [0, 1], // villager ↔ wolf
      };

      const result = magicianSwapResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.updates?.swappedSeats).toEqual([0, 1]);
    });

    it('targets=[] → 跳过（valid, 无 swappedSeats）', () => {
      const ctx = createContext(3, 'magician', players);
      const input: ActionInput = {
        schemaId: 'magicianSwap',
        targets: [],
      };

      const result = magicianSwapResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.updates).toBeUndefined();
    });

    it('targets=undefined → 跳过', () => {
      const ctx = createContext(3, 'magician', players);
      const input: ActionInput = {
        schemaId: 'magicianSwap',
        targets: undefined,
      };

      const result = magicianSwapResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.updates).toBeUndefined();
    });
  });

  describe('错误输入必须 reject', () => {
    it('targets 长度 != 2 → reject', () => {
      const ctx = createContext(3, 'magician', players);

      // 只有 1 个
      const input1: ActionInput = { schemaId: 'magicianSwap', targets: [0] };
      expect(magicianSwapResolver(ctx, input1).valid).toBe(false);

      // 3 个
      const input3: ActionInput = { schemaId: 'magicianSwap', targets: [0, 1, 2] };
      expect(magicianSwapResolver(ctx, input3).valid).toBe(false);
    });

    it('targets 包含不存在的 seat → reject', () => {
      const ctx = createContext(3, 'magician', players);
      const input: ActionInput = {
        schemaId: 'magicianSwap',
        targets: [0, 99], // seat 99 不存在
      };

      const result = magicianSwapResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('不存在');
    });

    it('targets 重复（同一个 seat）→ reject', () => {
      const ctx = createContext(3, 'magician', players);
      const input: ActionInput = {
        schemaId: 'magicianSwap',
        targets: [0, 0],
      };

      const result = magicianSwapResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('同一个');
    });
  });
});

// =============================================================================
// 2. 查验对齐: 查验必须按 swap 后身份
// =============================================================================

describe('查验对齐 (swap 后身份)', () => {
  /**
   * 场景: A=villager, B=wolf, magician swap [A, B]
   * 预期: 查验 A 应看到 B 的身份（wolf）
   */

  const players = createPlayers([
    [0, 'villager'], // A
    [1, 'wolf'], // B
    [2, 'seer'],
    [3, 'psychic'],
    [4, 'gargoyle'],
    [5, 'wolfRobot'],
    [6, 'magician'],
  ]);

  const swappedSeats: readonly [number, number] = [0, 1]; // A ↔ B

  describe('seer 查验', () => {
    it('swap 后查验 A(原 villager) → 应返回 wolf 阵营', () => {
      const ctx = createContext(2, 'seer', players, { swappedSeats });
      const input: ActionInput = {
        schemaId: 'seerCheck',
        target: 0, // 查验 A
      };

      const result = seerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      // A 原本是 villager，但 swap 后查验应看到 B 的身份（wolf）→ '狼人'
      expect(result.result?.checkResult).toBe('狼人');
    });

    it('swap 后查验 B(原 wolf) → 应返回好人阵营', () => {
      const ctx = createContext(2, 'seer', players, { swappedSeats });
      const input: ActionInput = {
        schemaId: 'seerCheck',
        target: 1, // 查验 B
      };

      const result = seerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      // B 原本是 wolf，但 swap 后查验应看到 A 的身份（villager）→ '好人'
      expect(result.result?.checkResult).toBe('好人');
    });

    it('查验未被 swap 的座位 → 返回原身份', () => {
      const ctx = createContext(2, 'seer', players, { swappedSeats });
      const input: ActionInput = {
        schemaId: 'seerCheck',
        target: 3, // psychic, 未被 swap
      };

      const result = seerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.checkResult).toBe('好人');
    });
  });

  describe('psychic 通灵', () => {
    it('swap 后通灵 A(原 villager) → 应返回 wolf', () => {
      const ctx = createContext(3, 'psychic', players, { swappedSeats });
      const input: ActionInput = {
        schemaId: 'psychicCheck',
        target: 0,
      };

      const result = psychicCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      // swap 后应看到 wolf
      expect(result.result?.identityResult).toBe('wolf');
    });
  });

  describe('gargoyle 查验', () => {
    it('swap 后查验 A(原 villager) → 应返回 wolf', () => {
      const ctx = createContext(4, 'gargoyle', players, { swappedSeats });
      const input: ActionInput = {
        schemaId: 'gargoyleCheck',
        target: 0,
      };

      const result = gargoyleCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.identityResult).toBe('wolf');
    });
  });

  describe('wolfRobot 学习', () => {
    it('swap 后学习 A(原 villager) → 应返回 wolf', () => {
      const ctx = createContext(5, 'wolfRobot', players, { swappedSeats });
      const input: ActionInput = {
        schemaId: 'wolfRobotLearn',
        target: 0,
      };

      const result = wolfRobotLearnResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.identityResult).toBe('wolf');
    });
  });
});

// =============================================================================
// 3. 死亡结算对齐: 死亡必须按 swap 规则
// =============================================================================

describe('死亡结算对齐 (swap 规则)', () => {
  /**
   * 场景: 狼刀杀 A，magician swap [A, B]
   * 预期: 死亡落在 B（交换死亡状态）
   */

  it('狼刀杀 A, swap [A,B] → B 死亡', () => {
    const deaths = calculateDeaths(
      {
        wolfKill: 0, // 杀 A
        magicianSwap: { first: 0, second: 1 }, // swap A ↔ B
      },
      {
        witcher: -1,
        wolfQueen: -1,
        dreamcatcher: -1,
        spiritKnight: -1,
        seer: -1,
        witch: -1,
        guard: -1,
      },
    );

    // A 原本会死，swap 后死亡转移到 B
    expect(deaths).not.toContain(0);
    expect(deaths).toContain(1);
  });

  it('狼刀杀 B, swap [A,B] → A 死亡', () => {
    const deaths = calculateDeaths(
      {
        wolfKill: 1, // 杀 B
        magicianSwap: { first: 0, second: 1 }, // swap A ↔ B
      },
      {
        witcher: -1,
        wolfQueen: -1,
        dreamcatcher: -1,
        spiritKnight: -1,
        seer: -1,
        witch: -1,
        guard: -1,
      },
    );

    // B 原本会死，swap 后死亡转移到 A
    expect(deaths).toContain(0);
    expect(deaths).not.toContain(1);
  });

  it('狼刀杀 C (未被 swap) → C 死亡，A/B 不受影响', () => {
    const deaths = calculateDeaths(
      {
        wolfKill: 2, // 杀 C
        magicianSwap: { first: 0, second: 1 }, // swap A ↔ B
      },
      {
        witcher: -1,
        wolfQueen: -1,
        dreamcatcher: -1,
        spiritKnight: -1,
        seer: -1,
        witch: -1,
        guard: -1,
      },
    );

    expect(deaths).toContain(2);
    expect(deaths).not.toContain(0);
    expect(deaths).not.toContain(1);
  });

  it('两者都不死 → swap 无效果', () => {
    const deaths = calculateDeaths(
      {
        wolfKill: 2, // 杀 C (不是 A 或 B)
        magicianSwap: { first: 0, second: 1 },
      },
      {
        witcher: -1,
        wolfQueen: -1,
        dreamcatcher: -1,
        spiritKnight: -1,
        seer: -1,
        witch: -1,
        guard: -1,
      },
    );

    // A, B 都不死
    expect(deaths).not.toContain(0);
    expect(deaths).not.toContain(1);
  });

  it('两者都死（例如毒和刀）→ swap 无效果', () => {
    const deaths = calculateDeaths(
      {
        wolfKill: 0, // A 被刀
        witchAction: { kind: 'poison', targetSeat: 1 }, // B 被毒
        magicianSwap: { first: 0, second: 1 },
      },
      {
        witcher: -1,
        wolfQueen: -1,
        dreamcatcher: -1,
        spiritKnight: -1,
        seer: -1,
        witch: -1,
        guard: -1,
      },
    );

    // 两者都死，swap 不交换
    expect(deaths).toContain(0);
    expect(deaths).toContain(1);
  });
});

// =============================================================================
// 4. 边界情况
// =============================================================================

describe('Swap 边界情况', () => {
  it('无 swap → 查验返回原身份', () => {
    const players = createPlayers([
      [0, 'villager'],
      [1, 'wolf'],
      [2, 'seer'],
    ]);
    const ctx = createContext(2, 'seer', players, {}); // 无 swappedSeats
    const input: ActionInput = {
      schemaId: 'seerCheck',
      target: 0,
    };

    const result = seerCheckResolver(ctx, input);

    expect(result.valid).toBe(true);
    expect(result.result?.checkResult).toBe('好人'); // villager 是好人
  });

  it('无 swap → 死亡无转移', () => {
    const deaths = calculateDeaths(
      {
        wolfKill: 0,
        // 无 magicianSwap
      },
      {
        witcher: -1,
        wolfQueen: -1,
        dreamcatcher: -1,
        spiritKnight: -1,
        seer: -1,
        witch: -1,
        guard: -1,
      },
    );

    expect(deaths).toContain(0);
  });
});

// =============================================================================
// 4. Handler → Resolver wire protocol contract
// =============================================================================

describe('Handler → Resolver wire protocol (buildActionInput)', () => {
  /**
   * 这些测试验证从 UI 到 Handler 的 wire protocol：
   * - swap 必须使用 extra.targets = [seatA, seatB]
   * - target 必须为 null
   *
   * 注意：这里直接测试 resolver 层对 ActionInput shape 的期望，
   * 因为 buildActionInput 只是简单的字段提取。
   */

  const players = createPlayers([
    [0, 'villager'],
    [1, 'wolf'],
    [2, 'seer'],
    [3, 'magician'],
  ]);

  describe('protocol: extra.targets = [seatA, seatB]', () => {
    it('resolver 读取 input.targets 而非 target', () => {
      const ctx = createContext(3, 'magician', players);

      // 模拟 buildActionInput 的输出（从 extra.targets 构建）
      const input: ActionInput = {
        schemaId: 'magicianSwap',
        target: undefined, // protocol: target 必须为 null/undefined
        targets: [0, 1],   // protocol: extra.targets
      };

      const result = magicianSwapResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.updates?.swappedSeats).toEqual([0, 1]);
    });

    it('target 非 null 不会干扰 resolver（resolver 只读 targets）', () => {
      const ctx = createContext(3, 'magician', players);

      // 假设旧 UI 错误地同时传了 target 和 targets
      // resolver 应该只读 targets
      const input: ActionInput = {
        schemaId: 'magicianSwap',
        target: 999, // 无效值，不应被使用
        targets: [0, 1],
      };

      const result = magicianSwapResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.updates?.swappedSeats).toEqual([0, 1]);
    });
  });

  describe('old mergedTarget encoding is not supported', () => {
    it('mergedTarget encoding (a + b*100) is not parsed by resolver', () => {
      const ctx = createContext(3, 'magician', players);

      // Old mergedTarget encoding: 2 + 4*100 = 402
      // This value in target field will not be parsed
      const input: ActionInput = {
        schemaId: 'magicianSwap',
        target: 402, // old mergedTarget format
        targets: undefined,
      };

      const result = magicianSwapResolver(ctx, input);

      // targets undefined → treated as skip, not error
      expect(result.valid).toBe(true);
      expect(result.updates).toBeUndefined(); // no swap
    });
  });
});
