/**
 * Night-1 Integration Test: WolfQueen Charm
 *
 * 主题：狼美人魅惑行为及链接死亡。
 *
 * 模板：狼美守卫12人
 * 固定 seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-6: wolf
 *   seat 7: wolfQueen
 *   seat 8: seer
 *   seat 9: witch
 *   seat 10: hunter
 *   seat 11: guard
 *
 * 核心规则：
 * - wolfQueen 魅惑目标通过 action 记录（targetSeat）
 * - 被魅惑者与狼美人连体（链接死亡在 DeathCalculator 处理）
 *
 * 架构：intents → handlers → reducer → GameState
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';

import { cleanupGame, createGame, GameContext } from './gameFactory';
import { executeFullNight } from './stepByStepRunner';

const TEMPLATE_NAME = '狼美守卫12人';

/**
 * 固定 seat-role assignment
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
  map.set(7, 'wolfQueen');
  map.set(8, 'seer');
  map.set(9, 'witch');
  map.set(10, 'hunter');
  map.set(11, 'guard');
  return map;
}

describe('Night-1: WolfQueen Charm (12p)', () => {
  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  describe('WolfQueen 魅惑正常执行', () => {
    it('wolfQueen 魅惑 villager(0)，action 记录正确，流程完成', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        guard: null,
        wolf: 1, // 狼刀 seat 1
        wolfQueen: 0, // 魅惑 seat 0
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // 核心断言：wolfQueenCharm action 写入 state.actions
      const state = ctx.getGameState();
      const charmAction = state.actions?.find((a) => a.schemaId === 'wolfQueenCharm');
      expect(charmAction).toBeDefined();
      expect(charmAction!.actorSeat).toBe(7); // wolfQueen 在 seat 7
      expect(charmAction!.targetSeat).toBe(0); // 魅惑 seat 0

      // 只有被刀的 seat 1 死亡，seat 0 和 wolfQueen 存活
      expect(result.deaths).toEqual([1]);
    });

    it('wolfQueen 魅惑 seer(8)，action 写入 targetSeat=8', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        guard: null,
        wolf: 0,
        wolfQueen: 8, // 魅惑 seer
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // 核心断言：action 记录魅惑目标
      const state = ctx.getGameState();
      const charmAction = state.actions?.find((a) => a.schemaId === 'wolfQueenCharm');
      expect(charmAction).toBeDefined();
      expect(charmAction!.targetSeat).toBe(8);

      expect(result.deaths).toEqual([0]);
    });
  });

  describe('WolfQueen 不魅惑', () => {
    it('wolfQueen 空选，action 中 targetSeat 为 undefined（或无该 action）', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        guard: null,
        wolf: 0,
        wolfQueen: null, // 不魅惑
        witch: { save: null, poison: null },
        seer: 4,
      });

      // 核心断言：空选时 action 存在但 targetSeat 为 undefined，或无该 action
      const state = ctx.getGameState();
      const charmAction = state.actions?.find((a) => a.schemaId === 'wolfQueenCharm');
      // 空选时：要么无 action，要么 targetSeat 为 undefined
      expect(charmAction?.targetSeat).toBeUndefined();

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([0]);
    });
  });

  describe('WolfQueen 链接死亡（Night-1 内）', () => {
    /**
     * 注意：当前实现是**单向链接**
     * - wolfQueen 死 → 被魅惑者也死 ✓
     * - 被魅惑者死 → wolfQueen 不受影响（单向链接）
     *
     * 这反映了 DeathCalculator.ts 的规则：
     * "If queen is dead, charmed target also dies"
     */

    it('被魅惑者被刀时，只有被魅惑者死（单向链接）', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // wolfQueen 魅惑 seat 0，狼刀 seat 0
      // 根据当前规则（单向链接），只有 seat 0 死
      const result = executeFullNight(ctx, {
        guard: null,
        wolf: 0, // 刀被魅惑者
        wolfQueen: 0, // 魅惑 seat 0
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // 核心断言：只有 seat 0 死，wolfQueen(7) 存活（单向链接）
      expect(result.deaths).toEqual([0]);
    });

    it('wolfQueen 死亡时，被魅惑者也死亡', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // wolfQueen 魅惑 seat 0，女巫毒 wolfQueen(7)
      const result = executeFullNight(ctx, {
        guard: null,
        wolf: null, // 空刀
        wolfQueen: 0, // 魅惑 seat 0
        witch: { save: null, poison: 7 }, // 毒 wolfQueen
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // 核心断言：wolfQueen(7) 和被魅惑者(0) 都死亡
      expect([...result.deaths].sort((a, b) => a - b)).toEqual([0, 7]);
    });
  });

  describe('WolfQueen 魅惑不影响狼刀其他目标', () => {
    it('wolfQueen 魅惑 A，狼刀 B，只有 B 死', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        guard: null,
        wolf: 1, // 刀 seat 1
        wolfQueen: 0, // 魅惑 seat 0（不同于狼刀目标）
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // 核心断言：只有 seat 1 死，seat 0 和 wolfQueen 存活
      expect(result.deaths).toEqual([1]);
    });
  });
});
