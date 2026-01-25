/**
 * Night-1 Integration Test: Magician Swap affects Seer Reveal
 *
 * 主题：魔术师交换身份后，预言家查验结果应基于交换后的身份。
 *
 * 模板：狼王魔术师12人
 * 固定 seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-6: wolf
 *   seat 7: darkWolfKing
 *   seat 8: seer
 *   seat 9: witch
 *   seat 10: hunter
 *   seat 11: magician
 *
 * 架构：intents → handlers → reducer → BroadcastGameState
 */

import {
  createHostGame,
  cleanupHostGame,
  HostGameContext,
} from './hostGameFactory';
import { executeFullNight } from './stepByStepRunner';
import type { RoleId } from '../../../models/roles';

const TEMPLATE_NAME = '狼王魔术师12人';

/**
 * 固定 seat-role assignment（可读、可复现）
 */
function createRoleAssignment(): Map<number, RoleId> {
  const map = new Map<number, RoleId>();
  map.set(0, 'villager');
  map.set(1, 'villager');
  map.set(2, 'villager');
  map.set(3, 'villager');
  map.set(4, 'wolf');
  map.set(5, 'wolf');
  map.set(6, 'wolf');
  map.set(7, 'darkWolfKing');
  map.set(8, 'seer');
  map.set(9, 'witch');
  map.set(10, 'hunter');
  map.set(11, 'magician');
  return map;
}

describe('Night-1: Magician Swap affects Seer Reveal (12p)', () => {
  let ctx: HostGameContext;

  afterEach(() => {
    cleanupHostGame();
  });

  describe('Swap 后 Seer 查验应返回交换后身份', () => {
    it('魔术师交换 villager(0) 与 wolf(4)，seer 查 seat 0 应返回"狼人"', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // magician 交换 seat 0 (villager) 与 seat 4 (wolf)
      // 交换后：seat 0 = wolf 身份, seat 4 = villager 身份
      const result = executeFullNight(ctx, {
        magician: { targets: [0, 4] },
        wolf: 1, // 狼刀 seat 1
        witch: { save: null, poison: null },
        seer: 0, // seer 查 seat 0（交换后是 wolf 身份）
      });

      expect(result.completed).toBe(true);

      // 核心断言：seerReveal 应显示 seat 0 是"狼人"（因为交换后身份是 wolf）
      const state = ctx.getBroadcastState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(0);
      expect(['wolf', '狼人']).toContain(state.seerReveal!.result);

      // swappedSeats 记录在 currentNightResults
      expect(state.currentNightResults?.swappedSeats).toEqual([0, 4]);
    });

    it('魔术师交换 villager(0) 与 wolf(4)，seer 查 seat 4 应返回"好人"', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // 交换后：seat 4 = villager 身份
      const result = executeFullNight(ctx, {
        magician: { targets: [0, 4] },
        wolf: 1,
        witch: { save: null, poison: null },
        seer: 4, // seer 查 seat 4（交换后是 villager 身份）
      });

      expect(result.completed).toBe(true);

      // 核心断言：seerReveal 应显示 seat 4 是"好人"
      const state = ctx.getBroadcastState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(4);
      expect(['good', '好人']).toContain(state.seerReveal!.result);
    });

    it('魔术师不交换时，seer 查 wolf seat 应返回"狼人"', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // 不交换：seat 4 仍是 wolf
      const result = executeFullNight(ctx, {
        magician: null, // 不交换
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 4, // seer 查 seat 4（原始 wolf）
      });

      expect(result.completed).toBe(true);

      const state = ctx.getBroadcastState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(4);
      expect(['wolf', '狼人']).toContain(state.seerReveal!.result);

      // 无交换
      expect(state.currentNightResults?.swappedSeats).toBeUndefined();
    });
  });

  describe('Swap 交换死亡命运（核心规则）', () => {
    it('交换后狼刀 seat 0，因 swap 规则 seat 4 死（死亡命运交换）', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // 交换 seat 0 与 seat 4
      // 狼刀 seat 0
      // 根据规则：魔术师交换死亡命运，所以 seat 4 死
      const result = executeFullNight(ctx, {
        magician: { targets: [0, 4] },
        wolf: 0, // 狼刀 seat 0
        witch: { save: null, poison: null },
        seer: 1,
      });

      expect(result.completed).toBe(true);

      // 核心断言：因为 swap 交换死亡命运，seat 0 的死亡转移到 seat 4
      expect(result.deaths).toEqual([4]);
    });

    it('交换后女巫毒 seat 4，因 swap 规则 seat 0 死', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        magician: { targets: [0, 4] },
        wolf: null, // 空刀
        witch: { save: null, poison: 4 }, // 毒 seat 4
        seer: 1,
      });

      expect(result.completed).toBe(true);

      // 核心断言：seat 4 的死亡转移到 seat 0
      expect(result.deaths).toEqual([0]);
    });

    it('swap 双方都被杀死时，不交换（都死）', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // 狼刀 seat 0，女巫毒 seat 4
      const result = executeFullNight(ctx, {
        magician: { targets: [0, 4] },
        wolf: 0, // 刀 seat 0
        witch: { save: null, poison: 4 }, // 毒 seat 4
        seer: 1,
      });

      expect(result.completed).toBe(true);

      // 核心断言：两个都死，不交换
      const sortedDeaths = [...result.deaths].sort((a, b) => a - b);
      expect(sortedDeaths).toEqual([0, 4]);
    });
  });

  describe('Swap targets 写入 BroadcastGameState', () => {
    it('swappedSeats 应正确记录交换的两个座位', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        magician: { targets: [2, 7] }, // 交换 villager(2) 与 darkWolfKing(7)
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 2, // 查 seat 2（交换后是 darkWolfKing 身份）
      });

      expect(result.completed).toBe(true);

      // swappedSeats 写入 currentNightResults
      const state = ctx.getBroadcastState();
      expect(state.currentNightResults?.swappedSeats).toEqual([2, 7]);

      // seer 查 seat 2 应返回"狼人"（darkWolfKing 是狼阵营）
      expect(state.seerReveal).toBeDefined();
      expect(['wolf', '狼人']).toContain(state.seerReveal!.result);
    });
  });
});
