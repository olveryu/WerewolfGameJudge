/**
 * Night-1 Integration Test: WolfRobot Disguise - Psychic Reveal
 *
 * 主题：机械狼学习后伪装身份，通灵师查验显示伪装角色
 *
 * 模板：机械狼通灵师12人
 * 固定 seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-6: wolf
 *   seat 7: wolfRobot
 *   seat 8: psychic
 *   seat 9: witch
 *   seat 10: hunter
 *   seat 11: guard
 *
 * 核心规则（wolfRobot 伪装契约 - psychic 视角）：
 * - wolfRobot 学习某角色后，psychic 查验 wolfRobot 显示 disguisedRole
 * - 未学习时，psychic 查验返回 wolfRobot 本体
 *
 * 架构：intents → handlers → resolver(resolveRoleForChecks) → BroadcastGameState
 */

import {
  createHostGame,
  cleanupHostGame,
  HostGameContext,
} from './hostGameFactory';
import type { RoleId } from '../../../models/roles';

const TEMPLATE_NAME = '机械狼通灵师12人';

/**
 * 固定 seat-role assignment（按模板顺序）
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
  map.set(8, 'psychic');
  map.set(9, 'witch');
  map.set(10, 'hunter');
  map.set(11, 'guard');
  return map;
}

describe('Night-1: WolfRobot Disguise - Psychic Reveal (12p)', () => {
  let ctx: HostGameContext;

  afterEach(() => {
    cleanupHostGame();
  });

  it('wolfRobot 学习 villager，psychic 查验 wolfRobot 显示 villager', () => {
    ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

    const result = ctx.runNight({
      wolfRobot: 0, // 学习 villager
      guard: null,
      wolf: 1,
      witch: { stepResults: { save: null, poison: null } },
      psychic: 7, // 查验 wolfRobot
      hunter: { confirmed: false },
    });

    expect(result.completed).toBe(true);

    // wolfRobotContext 写入
    expect(result.state.wolfRobotContext).toBeDefined();
    expect(result.state.wolfRobotContext!.learnedSeat).toBe(0);
    expect(result.state.wolfRobotContext!.disguisedRole).toBe('villager');

    // psychicReveal 显示伪装角色 villager
    expect(result.state.psychicReveal!.targetSeat).toBe(7);
    expect(result.state.psychicReveal!.result).toBe('villager');

    // wolfRobotReveal 也写入
    expect(result.state.wolfRobotReveal!.result).toBe('villager');
  });

  it('wolfRobot 学习 wolf，psychic 查验 wolfRobot 显示 wolf', () => {
    ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

    const result = ctx.runNight({
      wolfRobot: 4, // 学习 wolf
      guard: null,
      wolf: 1,
      witch: { stepResults: { save: null, poison: null } },
      psychic: 7, // 查验 wolfRobot
      hunter: { confirmed: false },
    });

    expect(result.completed).toBe(true);

    expect(result.state.wolfRobotContext!.disguisedRole).toBe('wolf');
    expect(result.state.psychicReveal!.result).toBe('wolf');
  });

  it('wolfRobot 空选，psychic 查验 wolfRobot 显示 wolfRobot（本体）', () => {
    ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

    const result = ctx.runNight({
      wolfRobot: null, // 不学习
      guard: null,
      wolf: 1,
      witch: { stepResults: { save: null, poison: null } },
      psychic: 7, // 查验 wolfRobot
      hunter: { confirmed: false },
    });

    expect(result.completed).toBe(true);

    // wolfRobotContext 未写入
    expect(result.state.wolfRobotContext).toBeUndefined();
    // psychicReveal 显示真实角色 wolfRobot
    expect(result.state.psychicReveal!.result).toBe('wolfRobot');
  });
});
