/**
 * Night-1 Integration Test: Thief + Cupid (盗贼丘比特)
 *
 * 主题：盗贼从 2 张底牌中选择身份，丘比特连线情侣，验证选卡、情侣连线、全夜流程。
 *
 * 模板：14 角色 = 12 玩家 + 2 底牌
 *   预言家 + 女巫 + 猎人 + 白痴 + 狼人×3 + 村民×5 + 盗贼 + 丘比特
 *
 * 架构：intents → handlers → reducer → GameState
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';

import { cleanupGame, createGame, type GameContext } from './gameFactory';
import { executeFullNight, executeStepsUntil } from './stepByStepRunner';

// =============================================================================
// Template: 14 角色（12 玩家 + 2 底牌）
// =============================================================================

const TEMPLATE_NAME = '盗贼丘比特';

const TEMPLATE_ROLES: RoleId[] = [
  'villager',
  'villager',
  'villager',
  'villager',
  'villager',
  'wolf',
  'wolf',
  'wolf',
  'seer',
  'witch',
  'hunter',
  'idiot',
  'thief',
  'cupid',
] as RoleId[];

// =============================================================================
// Test: 盗贼选底牌 + 丘比特连线
// =============================================================================

describe(`Night-1: ${TEMPLATE_NAME} — 盗贼选底牌 + 丘比特连线`, () => {
  /**
   * 固定 seat-role assignment（12 玩家）:
   *   seat 0-3: villager ×4
   *   seat 4-6: wolf ×3
   *   seat 7: seer
   *   seat 8: witch
   *   seat 9: hunter
   *   seat 10: thief
   *   seat 11: cupid
   *
   * 底牌: villager, idiot
   */
  function createRoleAssignment(): Map<number, RoleId> {
    const map = new Map<number, RoleId>();
    map.set(0, 'villager' as RoleId);
    map.set(1, 'villager' as RoleId);
    map.set(2, 'villager' as RoleId);
    map.set(3, 'villager' as RoleId);
    map.set(4, 'wolf' as RoleId);
    map.set(5, 'wolf' as RoleId);
    map.set(6, 'wolf' as RoleId);
    map.set(7, 'seer' as RoleId);
    map.set(8, 'witch' as RoleId);
    map.set(9, 'hunter' as RoleId);
    map.set(10, 'thief' as RoleId);
    map.set(11, 'cupid' as RoleId);
    return map;
  }

  const BOTTOM_CARDS: RoleId[] = ['villager' as RoleId, 'idiot' as RoleId];

  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  it('盗贼选 idiot（cardIndex=1），丘比特连线 seat 0 和 1，全夜完成', () => {
    ctx = createGame(TEMPLATE_ROLES, createRoleAssignment(), {
      bottomCards: BOTTOM_CARDS,
    });

    // 验证初始状态
    const initState = ctx.getGameState();
    expect(initState.bottomCards).toEqual(BOTTOM_CARDS);
    expect(initState.thiefSeat).toBe(10);

    // 首步 = thiefChoose
    ctx.assertStep('thiefChoose');

    // 执行到 cupidChooseLovers 验证步骤推进
    executeStepsUntil(ctx, 'cupidChooseLovers', {
      thief: { cardIndex: 1 },
    });
    ctx.assertStep('cupidChooseLovers');

    // 继续执行到 cupidLoversReveal
    executeStepsUntil(ctx, 'cupidLoversReveal', {
      cupid: { targets: [0, 1] },
    });
    ctx.assertStep('cupidLoversReveal');

    // 执行剩余夜晚
    const result = executeFullNight(ctx, {
      wolf: 7, // 袭击 seer（seat 7）
      witch: { save: 7, poison: null }, // 女巫救人
      seer: 0, // 查验 seat 0
      hunter: { confirmed: true },
    });

    expect(result.completed).toBe(true);

    const state = ctx.getGameState();

    // 核心断言：盗贼选卡结果
    expect(state.thiefChosenCard).toBe('idiot');

    // 核心断言：丘比特连线结果
    expect(state.loverSeats).toEqual([0, 1]);

    // seer 正常查验
    expect(state.seerReveal).toBeDefined();
    expect(state.seerReveal!.targetSeat).toBe(0);

    // wolf → seer saved by witch → 平安夜
    expect(result.deaths).toEqual([]);
  });

  it('盗贼选 villager（cardIndex=0），丘比特连线 seat 7 和 10（异阵营），全夜完成', () => {
    ctx = createGame(TEMPLATE_ROLES, createRoleAssignment(), {
      bottomCards: BOTTOM_CARDS,
    });

    const result = executeFullNight(ctx, {
      thief: { cardIndex: 0 }, // 选 villager（index 0）
      cupid: { targets: [7, 10] }, // 连线 seer 和 thief
      wolf: 0, // 袭击 villager（seat 0）
      witch: null, // 女巫不救
      seer: 4, // 查验 seat 4（wolf）
      hunter: { confirmed: true },
    });

    expect(result.completed).toBe(true);

    const state = ctx.getGameState();

    // 盗贼选了 villager
    expect(state.thiefChosenCard).toBe('villager');

    // 丘比特连线 seer 和 thief
    expect(state.loverSeats).toEqual([7, 10]);

    // cupidLoversReveal 应已通过
    // wolf 袭击 seat 0 → 死亡
    expect(result.deaths).toEqual([0]);
  });
});
