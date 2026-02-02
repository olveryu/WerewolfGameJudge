/**
 * Night-1 Integration Test: WolfRobot Disguise - Seer Reveal
 *
 * 主题：机械狼学习后伪装身份，预言家查验显示伪装阵营
 *
 * 自定义模板（12人，含 wolfRobot + seer + magician）
 * 固定 seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-6: wolf
 *   seat 7: wolfRobot
 *   seat 8: seer
 *   seat 9: witch
 *   seat 10: magician
 *   seat 11: guard
 *
 * 核心规则（wolfRobot 伪装契约 - seer 视角）：
 * - wolfRobot 学习好人阵营角色后，seer 查验 wolfRobot 应返回 "好人"
 * - wolfRobot 学习狼人阵营角色后，seer 查验 wolfRobot 应返回 "狼人"
 * - 未学习时，seer 查验返回 "狼人"（wolfRobot 本体是狼阵营）
 * - magician swap 后，seer 查验仍遵循 resolveRoleForChecks 逻辑
 *
 * 架构：intents → handlers → resolver(resolveRoleForChecks) → BroadcastGameState
 */

import { createHostGame, cleanupHostGame, HostGameContext } from './hostGameFactory';
import { executeFullNight } from './stepByStepRunner';
import type { RoleId } from '../../../models/roles';

/**
 * 自定义角色列表（含 wolfRobot + seer + magician）
 */
const CUSTOM_ROLES: RoleId[] = [
  'villager',
  'villager',
  'villager',
  'villager',
  'wolf',
  'wolf',
  'wolf',
  'wolfRobot',
  'seer',
  'witch',
  'magician',
  'guard',
];

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
  map.set(7, 'wolfRobot');
  map.set(8, 'seer');
  map.set(9, 'witch');
  map.set(10, 'magician');
  map.set(11, 'guard');
  return map;
}

describe('Night-1: WolfRobot Disguise - Seer Reveal (12p)', () => {
  let ctx: HostGameContext;

  afterEach(() => {
    cleanupHostGame();
  });

  it('wolfRobot 学习 villager，seer 查验 wolfRobot 显示 "好人"', () => {
    ctx = createHostGame(CUSTOM_ROLES, createRoleAssignment());

    const result = executeFullNight(ctx, {
      wolfRobot: 0, // 学习 villager（好人阵营）
      magician: { targets: [] },
      guard: null,
      wolf: 1,
      witch: { save: null, poison: null },
      seer: 7, // 查验 wolfRobot 所在 seat
    });

    expect(result.completed).toBe(true);

    const state = ctx.getBroadcastState();
    // wolfRobotContext 写入
    expect(state.wolfRobotContext).toBeDefined();
    expect(state.wolfRobotContext!.learnedSeat).toBe(0);
    expect(state.wolfRobotContext!.disguisedRole).toBe('villager');

    // seerReveal 显示 "好人"（伪装为 villager = 好人阵营）
    expect(state.seerReveal!.targetSeat).toBe(7);
    expect(state.seerReveal!.result).toBe('好人');
  });

  it('wolfRobot 学习 wolf，seer 查验 wolfRobot 显示 "狼人"', () => {
    ctx = createHostGame(CUSTOM_ROLES, createRoleAssignment());

    const result = executeFullNight(ctx, {
      wolfRobot: 4, // 学习 wolf（狼阵营）
      magician: { targets: [] },
      guard: null,
      wolf: 1,
      witch: { save: null, poison: null },
      seer: 7, // 查验 wolfRobot
    });

    expect(result.completed).toBe(true);

    const state = ctx.getBroadcastState();
    expect(state.wolfRobotContext!.disguisedRole).toBe('wolf');
    expect(state.seerReveal!.result).toBe('狼人');
  });

  it('wolfRobot 空选，seer 查验 wolfRobot 显示 "狼人"（本体）', () => {
    ctx = createHostGame(CUSTOM_ROLES, createRoleAssignment());

    const result = executeFullNight(ctx, {
      wolfRobot: null, // 不学习
      magician: { targets: [] },
      guard: null,
      wolf: 1,
      witch: { save: null, poison: null },
      seer: 7, // 查验 wolfRobot
    });

    expect(result.completed).toBe(true);

    const state = ctx.getBroadcastState();
    // wolfRobotContext 未写入
    expect(state.wolfRobotContext).toBeUndefined();
    // seerReveal 显示 "狼人"（wolfRobot 本体是狼阵营）
    expect(state.seerReveal!.result).toBe('狼人');
  });

  describe('swap + disguise 边界', () => {
    it('magician swap wolfRobot<->villager，wolfRobot 学习后，seer 查验 villager 原 seat 显示伪装阵营', () => {
      ctx = createHostGame(CUSTOM_ROLES, createRoleAssignment());

      // magician 把 wolfRobot(7) 和 villager(0) 交换
      // 交换后：seat 7 是 villager，seat 0 是 wolfRobot
      // wolfRobot 学习 witch(9) = 好人阵营
      // seer 查验 seat 0（此时是 wolfRobot），应显示 "好人"
      const result = executeFullNight(ctx, {
        wolfRobot: 9, // 学习 witch（好人阵营）
        magician: { targets: [7, 0] }, // swap wolfRobot <-> villager
        guard: null,
        wolf: 1,
        witch: { save: null, poison: null },
        seer: 0, // 查验 seat 0（swap 后是 wolfRobot）
      });

      expect(result.completed).toBe(true);

      const state = ctx.getBroadcastState();
      // wolfRobotContext 写入（学到 witch）
      expect(state.wolfRobotContext!.disguisedRole).toBe('witch');

      // seer 查验 seat 0（swap 后是 wolfRobot）显示 "好人"
      expect(state.seerReveal!.targetSeat).toBe(0);
      expect(state.seerReveal!.result).toBe('好人');
    });

    it('magician swap wolfRobot<->wolf，seer 查验 wolfRobot 原 seat 显示 "狼人"（swap 后是 wolf）', () => {
      ctx = createHostGame(CUSTOM_ROLES, createRoleAssignment());

      // magician 把 wolfRobot(7) 和 wolf(4) 交换
      // 交换后：seat 7 是 wolf，seat 4 是 wolfRobot
      // wolfRobot 学习 villager(0) = 好人阵营
      // seer 查验 seat 7（此时是 wolf），应显示 "狼人"
      const result = executeFullNight(ctx, {
        wolfRobot: 0, // 学习 villager
        magician: { targets: [7, 4] }, // swap wolfRobot <-> wolf
        guard: null,
        wolf: 1,
        witch: { save: null, poison: null },
        seer: 7, // 查验 seat 7（swap 后是 wolf）
      });

      expect(result.completed).toBe(true);

      const state = ctx.getBroadcastState();
      // seer 查验 seat 7（swap 后是 wolf）显示 "狼人"
      expect(state.seerReveal!.targetSeat).toBe(7);
      expect(state.seerReveal!.result).toBe('狼人');
    });
  });
});
