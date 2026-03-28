/**
 * Night-1 Integration Test: TreasureMaster Card Selection (15p)
 *
 * 主题：盗宝大师从 3 张底牌中选择身份，验证选卡、身份替代、auto-skip、effectiveTeam。
 *
 * 模板：15 角色 = 12 玩家 + 3 底牌
 *   通灵师 + 毒师 + 猎人 + 摄梦人 + 乌鸦 + 黑狼王 + 狼人×3 + 盗宝大师 + 村民×5
 *
 * 架构：intents → handlers → reducer → GameState
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import { Team } from '@werewolf/game-engine/models/roles/spec/types';

import { cleanupGame, createGame, type GameContext } from './gameFactory';
import { executeFullNight } from './stepByStepRunner';

// =============================================================================
// Template: 15 角色（12 玩家 + 3 底牌）
// =============================================================================

const TEMPLATE_ROLES: RoleId[] = [
  'psychic',
  'poisoner',
  'hunter',
  'dreamcatcher',
  'crow',
  'darkWolfKing',
  'wolf',
  'wolf',
  'wolf',
  'treasureMaster',
  'villager',
  'villager',
  'villager',
  'villager',
  'villager',
] as RoleId[];

// =============================================================================
// Test 1: 底牌 = wolf, crow, villager（含狼牌 → effectiveTeam = Wolf）
// =============================================================================

describe('Night-1: TreasureMaster (15p) — 底牌含狼', () => {
  /**
   * 固定 seat-role assignment（12 玩家）:
   *   seat 0-3: villager ×4
   *   seat 4-5: wolf ×2
   *   seat 6: darkWolfKing
   *   seat 7: psychic
   *   seat 8: poisoner
   *   seat 9: hunter
   *   seat 10: dreamcatcher
   *   seat 11: treasureMaster
   *
   * 底牌: wolf, crow, villager
   */
  function createRoleAssignment(): Map<number, RoleId> {
    const map = new Map<number, RoleId>();
    map.set(0, 'villager' as RoleId);
    map.set(1, 'villager' as RoleId);
    map.set(2, 'villager' as RoleId);
    map.set(3, 'villager' as RoleId);
    map.set(4, 'wolf' as RoleId);
    map.set(5, 'wolf' as RoleId);
    map.set(6, 'darkWolfKing' as RoleId);
    map.set(7, 'psychic' as RoleId);
    map.set(8, 'poisoner' as RoleId);
    map.set(9, 'hunter' as RoleId);
    map.set(10, 'dreamcatcher' as RoleId);
    map.set(11, 'treasureMaster' as RoleId);
    return map;
  }

  const BOTTOM_CARDS: RoleId[] = ['wolf' as RoleId, 'crow' as RoleId, 'villager' as RoleId];

  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  it('盗宝选 crow（cardIndex=1），代行 crowCurse，全夜完成', () => {
    ctx = createGame(TEMPLATE_ROLES, createRoleAssignment(), {
      bottomCards: BOTTOM_CARDS,
    });

    // 验证初始状态
    const initState = ctx.getGameState();
    expect(initState.bottomCards).toEqual(BOTTOM_CARDS);
    expect(initState.treasureMasterSeat).toBe(11);

    // 首步 = treasureMasterChoose
    ctx.assertStep('treasureMasterChoose');

    const result = executeFullNight(ctx, {
      treasureMaster: { cardIndex: 1 }, // 选 crow（index 1）
      dreamcatcher: 0, // 摄梦 seat 0
      crow: 3, // treasureMaster 代行 crowCurse，诅咒 seat 3
      wolf: null, // 毒师在场，首夜必须空刀
      poisoner: null, // 不毒
      hunter: { confirmed: true },
      darkWolfKing: { confirmed: true },
      psychic: 4, // 通灵查 seat 4（wolf）
    });

    expect(result.completed).toBe(true);

    const state = ctx.getGameState();

    // 核心断言：盗宝大师选卡结果
    expect(state.treasureMasterChosenCard).toBe('crow');
    expect(state.effectiveTeam).toBe(Team.Wolf); // 底牌含 wolf → Team.Wolf
    expect(state.bottomCardStepRoles).toEqual(expect.arrayContaining(['wolf', 'crow']));

    // wolfKill 正常执行（底牌有 wolf 但玩家中仍有 wolf×2，不应被 auto-skip）
    // 毒师在场，首夜必须空刀→无狼刀死亡
    expect(result.deaths).toEqual([]);

    // crowCurse 由盗宝代行 → cursedSeat 已写入
    expect(state.currentNightResults?.cursedSeat).toBe(3);

    // dreamcatcher 正常行动
    expect(state.currentNightResults?.dreamingSeat).toBe(0);

    // psychic 正常查验
    expect(state.psychicReveal).toBeDefined();
    expect(state.psychicReveal!.targetSeat).toBe(4);
  });

  it('盗宝选 villager（cardIndex=2），无步骤代行，全夜完成', () => {
    ctx = createGame(TEMPLATE_ROLES, createRoleAssignment(), {
      bottomCards: BOTTOM_CARDS,
    });

    const result = executeFullNight(ctx, {
      treasureMaster: { cardIndex: 2 }, // 选 villager（index 2）
      dreamcatcher: 0,
      // crow 在底牌且未被选 → crowCurse auto-skip
      wolf: null, // 毒师在场，首夜必须空刀
      poisoner: null,
      hunter: { confirmed: true },
      darkWolfKing: { confirmed: true },
      psychic: 4,
    });

    expect(result.completed).toBe(true);

    const state = ctx.getGameState();

    // 盗宝选了村民
    expect(state.treasureMasterChosenCard).toBe('villager');
    expect(state.effectiveTeam).toBe(Team.Wolf); // 底牌含 wolf → Team.Wolf

    // crowCurse 被 auto-skip（crow 在底牌且未被选）
    expect(state.currentNightResults?.cursedSeat).toBeUndefined();

    // wolfKill 仍正常执行（wolf×2 仍是玩家）
    // 毒师在场，首夜必须空刀→无死亡
    expect(result.deaths).toEqual([]);
  });
});

// =============================================================================
// Test 2: 底牌 = poisoner, dreamcatcher, villager（无狼牌 → effectiveTeam = Good）
// =============================================================================

describe('Night-1: TreasureMaster (15p) — 底牌无狼', () => {
  /**
   * 固定 seat-role assignment（12 玩家）:
   *   seat 0-3: villager ×4
   *   seat 4-6: wolf ×3
   *   seat 7: darkWolfKing
   *   seat 8: psychic
   *   seat 9: hunter
   *   seat 10: crow
   *   seat 11: treasureMaster
   *
   * 底牌: poisoner, dreamcatcher, villager
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
    map.set(7, 'darkWolfKing' as RoleId);
    map.set(8, 'psychic' as RoleId);
    map.set(9, 'hunter' as RoleId);
    map.set(10, 'crow' as RoleId);
    map.set(11, 'treasureMaster' as RoleId);
    return map;
  }

  const BOTTOM_CARDS: RoleId[] = [
    'poisoner' as RoleId,
    'dreamcatcher' as RoleId,
    'villager' as RoleId,
  ];

  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  it('盗宝选 dreamcatcher（cardIndex=1），代行摄梦，poisonerPoison auto-skip', () => {
    ctx = createGame(TEMPLATE_ROLES, createRoleAssignment(), {
      bottomCards: BOTTOM_CARDS,
    });

    // 验证底牌
    const initState = ctx.getGameState();
    expect(initState.bottomCards).toEqual(BOTTOM_CARDS);
    ctx.assertStep('treasureMasterChoose');

    const result = executeFullNight(ctx, {
      treasureMaster: { cardIndex: 1 }, // 选 dreamcatcher（index 1）
      dreamcatcher: 0, // treasureMaster 代行 dreamcatcherDream，摄梦 seat 0
      crow: 3, // crow 是玩家，正常诅咒 seat 3
      wolf: null, // 毒师在模板中（底牌），首夜必须空刀
      // poisoner 在底牌且未被选 → poisonerPoison auto-skip
      hunter: { confirmed: true },
      darkWolfKing: { confirmed: true },
      psychic: 4,
    });

    expect(result.completed).toBe(true);

    const state = ctx.getGameState();

    // 核心断言：盗宝大师选卡
    expect(state.treasureMasterChosenCard).toBe('dreamcatcher');
    expect(state.effectiveTeam).toBe(Team.Good); // 底牌无 wolf → Team.Good
    expect(state.bottomCardStepRoles).toEqual(expect.arrayContaining(['poisoner', 'dreamcatcher']));

    // dreamcatcherDream 由盗宝代行
    expect(state.currentNightResults?.dreamingSeat).toBe(0);

    // poisonerPoison 被 auto-skip（poisoner 在底牌且未被选）
    // 毒师在模板中（底牌），首夜必须空刀→无狼刀死亡
    expect(result.deaths).toEqual([]);

    // crowCurse 正常（crow 是玩家）
    expect(state.currentNightResults?.cursedSeat).toBe(3);
  });

  it('盗宝选 poisoner（cardIndex=0），代行毒师，dreamcatcherDream auto-skip', () => {
    ctx = createGame(TEMPLATE_ROLES, createRoleAssignment(), {
      bottomCards: BOTTOM_CARDS,
    });

    const result = executeFullNight(ctx, {
      treasureMaster: { cardIndex: 0 }, // 选 poisoner（index 0）
      // dreamcatcher 在底牌且未被选 → dreamcatcherDream auto-skip
      crow: 3,
      wolf: null, // 毒师在模板中（底牌），首夜必须空刀
      poisoner: 2, // treasureMaster 代行 poisonerPoison，毒杀 seat 2
      hunter: { confirmed: true },
      darkWolfKing: { confirmed: true },
      psychic: 4,
    });

    expect(result.completed).toBe(true);

    const state = ctx.getGameState();

    expect(state.treasureMasterChosenCard).toBe('poisoner');
    expect(state.effectiveTeam).toBe(Team.Good);

    // dreamcatcherDream 被 auto-skip
    expect(state.currentNightResults?.dreamingSeat).toBeUndefined();

    // poisonerPoison 由盗宝代行 → seat 2 被毒
    // 狼空刀（毒师在模板）+ seat 2 被毒
    expect(result.deaths).toEqual([2]);
  });
});
