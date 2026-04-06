/**
 * confirmContext.test.ts
 *
 * 测试 maybeCreateConfirmStatusAction 纯函数（公共 API）
 * confirmStatus 计算逻辑通过公共 API 间接覆盖
 */

import {
  computeCanShootForSeat,
  maybeCreateConfirmStatusAction,
} from '@werewolf/game-engine/engine/handlers/confirmContext';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import { Team } from '@werewolf/game-engine/models/roles/spec/types';
import type { GameState } from '@werewolf/game-engine/protocol/types';

// =============================================================================
// Test Helper
// =============================================================================

function createOngoingState(overrides: Partial<GameState> = {}): NonNullable<GameState> {
  return {
    roomCode: 'TEST',
    hostUid: 'host',
    status: GameStatus.Ongoing,
    templateRoles: ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch', 'hunter'],
    players: {
      0: { uid: 'p0', seatNumber: 0, hasViewedRole: true, role: 'wolf' },
      1: { uid: 'p1', seatNumber: 1, hasViewedRole: true, role: 'wolf' },
      2: { uid: 'p2', seatNumber: 2, hasViewedRole: true, role: 'villager' },
      3: { uid: 'p3', seatNumber: 3, hasViewedRole: true, role: 'villager' },
      4: { uid: 'p4', seatNumber: 4, hasViewedRole: true, role: 'seer' },
      5: { uid: 'p5', seatNumber: 5, hasViewedRole: true, role: 'witch' },
      6: { uid: 'p6', seatNumber: 6, hasViewedRole: true, role: 'hunter' },
    },
    currentStepIndex: 0,
    currentStepId: 'hunterConfirm',
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    currentNightResults: {},
    ...overrides,
  };
}

// =============================================================================
// maybeCreateConfirmStatusAction — confirm 计算逻辑
// =============================================================================

describe('maybeCreateConfirmStatusAction', () => {
  // ---- hunter canShoot 正确性 ----

  it('猎人未被毒 → canShoot = true', () => {
    const state = createOngoingState({
      currentNightResults: { poisonedSeat: 3 }, // 毒了 seat 3 (villager)
    });
    const action = maybeCreateConfirmStatusAction('hunterConfirm', state);
    expect(action).toEqual({
      type: 'SET_CONFIRM_STATUS',
      payload: { role: 'hunter', canShoot: true },
    });
  });

  it('猎人被毒 → canShoot = false', () => {
    const state = createOngoingState({
      currentNightResults: { poisonedSeat: 6 }, // 毒了 seat 6 (hunter)
    });
    const action = maybeCreateConfirmStatusAction('hunterConfirm', state);
    expect(action).toEqual({
      type: 'SET_CONFIRM_STATUS',
      payload: { role: 'hunter', canShoot: false },
    });
  });

  it('女巫未使用毒药（poisonedSeat 不存在）→ canShoot = true', () => {
    const state = createOngoingState({
      currentNightResults: {}, // 无 poisonedSeat
    });
    const action = maybeCreateConfirmStatusAction('hunterConfirm', state);
    expect(action).toEqual({
      type: 'SET_CONFIRM_STATUS',
      payload: { role: 'hunter', canShoot: true },
    });
  });

  // ---- darkWolfKing canShoot 正确性 ----

  it('狼王被毒 → canShoot = false', () => {
    const state = createOngoingState({
      templateRoles: ['wolf', 'darkWolfKing', 'villager', 'villager', 'seer', 'witch', 'hunter'],
      players: {
        0: { uid: 'p0', seatNumber: 0, hasViewedRole: true, role: 'wolf' },
        1: { uid: 'p1', seatNumber: 1, hasViewedRole: true, role: 'darkWolfKing' },
        2: { uid: 'p2', seatNumber: 2, hasViewedRole: true, role: 'villager' },
        3: { uid: 'p3', seatNumber: 3, hasViewedRole: true, role: 'villager' },
        4: { uid: 'p4', seatNumber: 4, hasViewedRole: true, role: 'seer' },
        5: { uid: 'p5', seatNumber: 5, hasViewedRole: true, role: 'witch' },
        6: { uid: 'p6', seatNumber: 6, hasViewedRole: true, role: 'hunter' },
      },
      currentNightResults: { poisonedSeat: 1 },
    });
    const action = maybeCreateConfirmStatusAction('darkWolfKingConfirm', state);
    expect(action).toEqual({
      type: 'SET_CONFIRM_STATUS',
      payload: { role: 'darkWolfKing', canShoot: false },
    });
  });

  it('狼王未被毒 → canShoot = true', () => {
    const state = createOngoingState({
      templateRoles: ['wolf', 'darkWolfKing', 'villager', 'villager', 'seer', 'witch', 'hunter'],
      players: {
        0: { uid: 'p0', seatNumber: 0, hasViewedRole: true, role: 'wolf' },
        1: { uid: 'p1', seatNumber: 1, hasViewedRole: true, role: 'darkWolfKing' },
        2: { uid: 'p2', seatNumber: 2, hasViewedRole: true, role: 'villager' },
        3: { uid: 'p3', seatNumber: 3, hasViewedRole: true, role: 'villager' },
        4: { uid: 'p4', seatNumber: 4, hasViewedRole: true, role: 'seer' },
        5: { uid: 'p5', seatNumber: 5, hasViewedRole: true, role: 'witch' },
        6: { uid: 'p6', seatNumber: 6, hasViewedRole: true, role: 'hunter' },
      },
      currentNightResults: { poisonedSeat: 3 },
    });
    const action = maybeCreateConfirmStatusAction('darkWolfKingConfirm', state);
    expect(action).toEqual({
      type: 'SET_CONFIRM_STATUS',
      payload: { role: 'darkWolfKing', canShoot: true },
    });
  });

  // ---- 异常态 ----

  it('角色不在 players 中（异常态）→ canShoot = false（fail-closed）', () => {
    const state = createOngoingState({
      // templateRoles 仍包含 hunter，但 players 里没有
      players: {
        0: { uid: 'p0', seatNumber: 0, hasViewedRole: true, role: 'wolf' },
        1: { uid: 'p1', seatNumber: 1, hasViewedRole: true, role: 'villager' },
      },
      currentNightResults: {},
    });
    const action = maybeCreateConfirmStatusAction('hunterConfirm', state);
    expect(action).toEqual({
      type: 'SET_CONFIRM_STATUS',
      payload: { role: 'hunter', canShoot: false },
    });
  });

  // ---- 门控逻辑 ----

  it('进入非 confirm 步骤 → 返回 null', () => {
    const state = createOngoingState();
    expect(maybeCreateConfirmStatusAction('wolfKill', state)).toBeNull();
    expect(maybeCreateConfirmStatusAction('witchAction', state)).toBeNull();
    expect(maybeCreateConfirmStatusAction('seerCheck', state)).toBeNull();
  });

  it('模板没有该角色 → 返回 null', () => {
    const state = createOngoingState({
      templateRoles: ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch'],
      // 没有 hunter
    });
    expect(maybeCreateConfirmStatusAction('hunterConfirm', state)).toBeNull();
  });

  // ---- 殉情不能开枪 ----

  it('猎人殉情（搭档被狼刀）→ canShoot = false', () => {
    const state = createOngoingState({
      loverSeats: [3, 6] as readonly [number, number],
      witchContext: { killedSeat: 3, canSave: true, canPoison: true },
      currentNightResults: {},
    });
    const action = maybeCreateConfirmStatusAction('hunterConfirm', state);
    expect(action).toEqual({
      type: 'SET_CONFIRM_STATUS',
      payload: { role: 'hunter', canShoot: false },
    });
  });

  it('猎人殉情（搭档被毒杀）→ canShoot = false', () => {
    const state = createOngoingState({
      loverSeats: [3, 6] as readonly [number, number],
      currentNightResults: { poisonedSeat: 3 },
    });
    const action = maybeCreateConfirmStatusAction('hunterConfirm', state);
    expect(action).toEqual({
      type: 'SET_CONFIRM_STATUS',
      payload: { role: 'hunter', canShoot: false },
    });
  });

  it('猎人是情侣但搭档存活 → canShoot = true', () => {
    const state = createOngoingState({
      loverSeats: [3, 6] as readonly [number, number],
      currentNightResults: {},
    });
    const action = maybeCreateConfirmStatusAction('hunterConfirm', state);
    expect(action).toEqual({
      type: 'SET_CONFIRM_STATUS',
      payload: { role: 'hunter', canShoot: true },
    });
  });

  // ---- 摄梦连锁不能开枪 ----

  it('摄梦人摄猎人 + 摄梦人被狼刀 → canShoot = false', () => {
    const state = createOngoingState({
      templateRoles: [
        'wolf',
        'wolf',
        'villager',
        'villager',
        'seer',
        'witch',
        'hunter',
        'dreamcatcher',
      ],
      players: {
        0: { uid: 'p0', seatNumber: 0, hasViewedRole: true, role: 'wolf' },
        1: { uid: 'p1', seatNumber: 1, hasViewedRole: true, role: 'wolf' },
        2: { uid: 'p2', seatNumber: 2, hasViewedRole: true, role: 'villager' },
        3: { uid: 'p3', seatNumber: 3, hasViewedRole: true, role: 'villager' },
        4: { uid: 'p4', seatNumber: 4, hasViewedRole: true, role: 'seer' },
        5: { uid: 'p5', seatNumber: 5, hasViewedRole: true, role: 'witch' },
        6: { uid: 'p6', seatNumber: 6, hasViewedRole: true, role: 'hunter' },
        7: { uid: 'p7', seatNumber: 7, hasViewedRole: true, role: 'dreamcatcher' },
      },
      witchContext: { killedSeat: 7, canSave: true, canPoison: true },
      currentNightResults: { dreamingSeat: 6 },
    });
    const action = maybeCreateConfirmStatusAction('hunterConfirm', state);
    expect(action).toEqual({
      type: 'SET_CONFIRM_STATUS',
      payload: { role: 'hunter', canShoot: false },
    });
  });

  it('摄梦人摄狼王 + 摄梦人被毒杀 → canShoot = false', () => {
    const state = createOngoingState({
      templateRoles: [
        'wolf',
        'darkWolfKing',
        'villager',
        'villager',
        'seer',
        'witch',
        'hunter',
        'dreamcatcher',
      ],
      players: {
        0: { uid: 'p0', seatNumber: 0, hasViewedRole: true, role: 'wolf' },
        1: { uid: 'p1', seatNumber: 1, hasViewedRole: true, role: 'darkWolfKing' },
        2: { uid: 'p2', seatNumber: 2, hasViewedRole: true, role: 'villager' },
        3: { uid: 'p3', seatNumber: 3, hasViewedRole: true, role: 'villager' },
        4: { uid: 'p4', seatNumber: 4, hasViewedRole: true, role: 'seer' },
        5: { uid: 'p5', seatNumber: 5, hasViewedRole: true, role: 'witch' },
        6: { uid: 'p6', seatNumber: 6, hasViewedRole: true, role: 'hunter' },
        7: { uid: 'p7', seatNumber: 7, hasViewedRole: true, role: 'dreamcatcher' },
      },
      currentNightResults: { dreamingSeat: 1, poisonedSeat: 7 },
    });
    const action = maybeCreateConfirmStatusAction('darkWolfKingConfirm', state);
    expect(action).toEqual({
      type: 'SET_CONFIRM_STATUS',
      payload: { role: 'darkWolfKing', canShoot: false },
    });
  });

  it('摄梦人摄猎人 + 摄梦人存活 → canShoot = true', () => {
    const state = createOngoingState({
      templateRoles: [
        'wolf',
        'wolf',
        'villager',
        'villager',
        'seer',
        'witch',
        'hunter',
        'dreamcatcher',
      ],
      players: {
        0: { uid: 'p0', seatNumber: 0, hasViewedRole: true, role: 'wolf' },
        1: { uid: 'p1', seatNumber: 1, hasViewedRole: true, role: 'wolf' },
        2: { uid: 'p2', seatNumber: 2, hasViewedRole: true, role: 'villager' },
        3: { uid: 'p3', seatNumber: 3, hasViewedRole: true, role: 'villager' },
        4: { uid: 'p4', seatNumber: 4, hasViewedRole: true, role: 'seer' },
        5: { uid: 'p5', seatNumber: 5, hasViewedRole: true, role: 'witch' },
        6: { uid: 'p6', seatNumber: 6, hasViewedRole: true, role: 'hunter' },
        7: { uid: 'p7', seatNumber: 7, hasViewedRole: true, role: 'dreamcatcher' },
      },
      currentNightResults: { dreamingSeat: 6 },
    });
    const action = maybeCreateConfirmStatusAction('hunterConfirm', state);
    expect(action).toEqual({
      type: 'SET_CONFIRM_STATUS',
      payload: { role: 'hunter', canShoot: true },
    });
  });

  // ---- 狼美人魅惑连锁不能开枪 ----

  it('狼美人魅惑猎人 + 狼美人被毒杀 → canShoot = false', () => {
    const state = createOngoingState({
      templateRoles: ['wolf', 'wolfQueen', 'villager', 'villager', 'seer', 'witch', 'hunter'],
      players: {
        0: { uid: 'p0', seatNumber: 0, hasViewedRole: true, role: 'wolf' },
        1: { uid: 'p1', seatNumber: 1, hasViewedRole: true, role: 'wolfQueen' },
        2: { uid: 'p2', seatNumber: 2, hasViewedRole: true, role: 'villager' },
        3: { uid: 'p3', seatNumber: 3, hasViewedRole: true, role: 'villager' },
        4: { uid: 'p4', seatNumber: 4, hasViewedRole: true, role: 'seer' },
        5: { uid: 'p5', seatNumber: 5, hasViewedRole: true, role: 'witch' },
        6: { uid: 'p6', seatNumber: 6, hasViewedRole: true, role: 'hunter' },
      },
      currentNightResults: { charmedSeat: 6, poisonedSeat: 1 },
    });
    const action = maybeCreateConfirmStatusAction('hunterConfirm', state);
    expect(action).toEqual({
      type: 'SET_CONFIRM_STATUS',
      payload: { role: 'hunter', canShoot: false },
    });
  });

  it('狼美人魅惑猎人 + 狼美人存活 → canShoot = true', () => {
    const state = createOngoingState({
      templateRoles: ['wolf', 'wolfQueen', 'villager', 'villager', 'seer', 'witch', 'hunter'],
      players: {
        0: { uid: 'p0', seatNumber: 0, hasViewedRole: true, role: 'wolf' },
        1: { uid: 'p1', seatNumber: 1, hasViewedRole: true, role: 'wolfQueen' },
        2: { uid: 'p2', seatNumber: 2, hasViewedRole: true, role: 'villager' },
        3: { uid: 'p3', seatNumber: 3, hasViewedRole: true, role: 'villager' },
        4: { uid: 'p4', seatNumber: 4, hasViewedRole: true, role: 'seer' },
        5: { uid: 'p5', seatNumber: 5, hasViewedRole: true, role: 'witch' },
        6: { uid: 'p6', seatNumber: 6, hasViewedRole: true, role: 'hunter' },
      },
      currentNightResults: { charmedSeat: 6 },
    });
    const action = maybeCreateConfirmStatusAction('hunterConfirm', state);
    expect(action).toEqual({
      type: 'SET_CONFIRM_STATUS',
      payload: { role: 'hunter', canShoot: true },
    });
  });

  // ---- avenger 阵营计算 ----

  it('影子模仿好人 → 复仇者为狼人阵营 (faction = wolf)', () => {
    const state = createOngoingState({
      templateRoles: [
        'wolf',
        'wolf',
        'wolf',
        'villager',
        'villager',
        'villager',
        'seer',
        'witch',
        'guard',
        'shadow',
        'avenger',
      ],
      players: {
        0: { uid: 'p0', seatNumber: 0, hasViewedRole: true, role: 'wolf' },
        1: { uid: 'p1', seatNumber: 1, hasViewedRole: true, role: 'wolf' },
        2: { uid: 'p2', seatNumber: 2, hasViewedRole: true, role: 'wolf' },
        3: { uid: 'p3', seatNumber: 3, hasViewedRole: true, role: 'villager' },
        4: { uid: 'p4', seatNumber: 4, hasViewedRole: true, role: 'villager' },
        5: { uid: 'p5', seatNumber: 5, hasViewedRole: true, role: 'villager' },
        6: { uid: 'p6', seatNumber: 6, hasViewedRole: true, role: 'seer' },
        7: { uid: 'p7', seatNumber: 7, hasViewedRole: true, role: 'witch' },
        8: { uid: 'p8', seatNumber: 8, hasViewedRole: true, role: 'guard' },
        9: { uid: 'p9', seatNumber: 9, hasViewedRole: true, role: 'shadow' },
        10: { uid: 'p10', seatNumber: 10, hasViewedRole: true, role: 'avenger' },
      },
      currentNightResults: { shadowMimicTarget: 3, avengerFaction: Team.Wolf }, // shadow mimics villager (Good team)
    });
    const action = maybeCreateConfirmStatusAction('avengerConfirm', state);
    expect(action).toEqual({
      type: 'SET_CONFIRM_STATUS',
      payload: { role: 'avenger', faction: Team.Wolf },
    });
  });

  it('影子模仿狼人 → 复仇者为好人阵营 (faction = good)', () => {
    const state = createOngoingState({
      templateRoles: [
        'wolf',
        'wolf',
        'wolf',
        'villager',
        'villager',
        'villager',
        'seer',
        'witch',
        'guard',
        'shadow',
        'avenger',
      ],
      players: {
        0: { uid: 'p0', seatNumber: 0, hasViewedRole: true, role: 'wolf' },
        1: { uid: 'p1', seatNumber: 1, hasViewedRole: true, role: 'wolf' },
        2: { uid: 'p2', seatNumber: 2, hasViewedRole: true, role: 'wolf' },
        3: { uid: 'p3', seatNumber: 3, hasViewedRole: true, role: 'villager' },
        4: { uid: 'p4', seatNumber: 4, hasViewedRole: true, role: 'villager' },
        5: { uid: 'p5', seatNumber: 5, hasViewedRole: true, role: 'villager' },
        6: { uid: 'p6', seatNumber: 6, hasViewedRole: true, role: 'seer' },
        7: { uid: 'p7', seatNumber: 7, hasViewedRole: true, role: 'witch' },
        8: { uid: 'p8', seatNumber: 8, hasViewedRole: true, role: 'guard' },
        9: { uid: 'p9', seatNumber: 9, hasViewedRole: true, role: 'shadow' },
        10: { uid: 'p10', seatNumber: 10, hasViewedRole: true, role: 'avenger' },
      },
      currentNightResults: { shadowMimicTarget: 0, avengerFaction: Team.Good }, // shadow mimics wolf (Wolf team)
    });
    const action = maybeCreateConfirmStatusAction('avengerConfirm', state);
    expect(action).toEqual({
      type: 'SET_CONFIRM_STATUS',
      payload: { role: 'avenger', faction: Team.Good },
    });
  });

  it('影子未选人（被封锁）→ 复仇者兗底好人阵营 (faction = good)', () => {
    const state = createOngoingState({
      templateRoles: [
        'wolf',
        'wolf',
        'wolf',
        'villager',
        'villager',
        'villager',
        'seer',
        'witch',
        'guard',
        'shadow',
        'avenger',
      ],
      players: {
        0: { uid: 'p0', seatNumber: 0, hasViewedRole: true, role: 'wolf' },
        1: { uid: 'p1', seatNumber: 1, hasViewedRole: true, role: 'wolf' },
        2: { uid: 'p2', seatNumber: 2, hasViewedRole: true, role: 'wolf' },
        3: { uid: 'p3', seatNumber: 3, hasViewedRole: true, role: 'villager' },
        4: { uid: 'p4', seatNumber: 4, hasViewedRole: true, role: 'villager' },
        5: { uid: 'p5', seatNumber: 5, hasViewedRole: true, role: 'villager' },
        6: { uid: 'p6', seatNumber: 6, hasViewedRole: true, role: 'seer' },
        7: { uid: 'p7', seatNumber: 7, hasViewedRole: true, role: 'witch' },
        8: { uid: 'p8', seatNumber: 8, hasViewedRole: true, role: 'guard' },
        9: { uid: 'p9', seatNumber: 9, hasViewedRole: true, role: 'shadow' },
        10: { uid: 'p10', seatNumber: 10, hasViewedRole: true, role: 'avenger' },
      },
      currentNightResults: {}, // no shadowMimicTarget
    });
    const action = maybeCreateConfirmStatusAction('avengerConfirm', state);
    expect(action).toEqual({
      type: 'SET_CONFIRM_STATUS',
      payload: { role: 'avenger', faction: Team.Good },
    });
  });

  it('影子模仿复仇者 → 绑定 (faction = Team.Third)', () => {
    const state = createOngoingState({
      templateRoles: [
        'wolf',
        'wolf',
        'wolf',
        'villager',
        'villager',
        'villager',
        'seer',
        'witch',
        'guard',
        'shadow',
        'avenger',
      ],
      players: {
        0: { uid: 'p0', seatNumber: 0, hasViewedRole: true, role: 'wolf' },
        1: { uid: 'p1', seatNumber: 1, hasViewedRole: true, role: 'wolf' },
        2: { uid: 'p2', seatNumber: 2, hasViewedRole: true, role: 'wolf' },
        3: { uid: 'p3', seatNumber: 3, hasViewedRole: true, role: 'villager' },
        4: { uid: 'p4', seatNumber: 4, hasViewedRole: true, role: 'villager' },
        5: { uid: 'p5', seatNumber: 5, hasViewedRole: true, role: 'villager' },
        6: { uid: 'p6', seatNumber: 6, hasViewedRole: true, role: 'seer' },
        7: { uid: 'p7', seatNumber: 7, hasViewedRole: true, role: 'witch' },
        8: { uid: 'p8', seatNumber: 8, hasViewedRole: true, role: 'guard' },
        9: { uid: 'p9', seatNumber: 9, hasViewedRole: true, role: 'shadow' },
        10: { uid: 'p10', seatNumber: 10, hasViewedRole: true, role: 'avenger' },
      },
      currentNightResults: { shadowMimicTarget: 10, avengerFaction: Team.Third },
    });
    const action = maybeCreateConfirmStatusAction('avengerConfirm', state);
    expect(action).toEqual({
      type: 'SET_CONFIRM_STATUS',
      payload: { role: 'avenger', faction: Team.Third },
    });
  });
});

// =============================================================================
// computeCanShootForSeat — 供 wolfRobot handler 层复用
// =============================================================================

describe('computeCanShootForSeat', () => {
  it('无死因 → true', () => {
    const state = createOngoingState({ currentNightResults: {} });
    expect(computeCanShootForSeat(6, state)).toBe(true);
  });

  it('被毒杀 → false', () => {
    const state = createOngoingState({ currentNightResults: { poisonedSeat: 6 } });
    expect(computeCanShootForSeat(6, state)).toBe(false);
  });

  it('殉情（搭档被狼刀）→ false', () => {
    const state = createOngoingState({
      loverSeats: [3, 6] as readonly [number, number],
      witchContext: { killedSeat: 3, canSave: true, canPoison: true },
      currentNightResults: {},
    });
    expect(computeCanShootForSeat(6, state)).toBe(false);
  });

  it('摄梦连锁（摄梦人被狼刀）→ false', () => {
    const state = createOngoingState({
      templateRoles: [
        'wolf',
        'wolf',
        'villager',
        'villager',
        'seer',
        'witch',
        'hunter',
        'dreamcatcher',
      ],
      players: {
        0: { uid: 'p0', seatNumber: 0, hasViewedRole: true, role: 'wolf' },
        1: { uid: 'p1', seatNumber: 1, hasViewedRole: true, role: 'wolf' },
        2: { uid: 'p2', seatNumber: 2, hasViewedRole: true, role: 'villager' },
        3: { uid: 'p3', seatNumber: 3, hasViewedRole: true, role: 'villager' },
        4: { uid: 'p4', seatNumber: 4, hasViewedRole: true, role: 'seer' },
        5: { uid: 'p5', seatNumber: 5, hasViewedRole: true, role: 'witch' },
        6: { uid: 'p6', seatNumber: 6, hasViewedRole: true, role: 'hunter' },
        7: { uid: 'p7', seatNumber: 7, hasViewedRole: true, role: 'dreamcatcher' },
      },
      witchContext: { killedSeat: 7, canSave: true, canPoison: true },
      currentNightResults: { dreamingSeat: 6 },
    });
    expect(computeCanShootForSeat(6, state)).toBe(false);
  });

  it('魅惑连锁（狼美人被毒杀）→ false', () => {
    const state = createOngoingState({
      templateRoles: ['wolf', 'wolfQueen', 'villager', 'villager', 'seer', 'witch', 'hunter'],
      players: {
        0: { uid: 'p0', seatNumber: 0, hasViewedRole: true, role: 'wolf' },
        1: { uid: 'p1', seatNumber: 1, hasViewedRole: true, role: 'wolfQueen' },
        2: { uid: 'p2', seatNumber: 2, hasViewedRole: true, role: 'villager' },
        3: { uid: 'p3', seatNumber: 3, hasViewedRole: true, role: 'villager' },
        4: { uid: 'p4', seatNumber: 4, hasViewedRole: true, role: 'seer' },
        5: { uid: 'p5', seatNumber: 5, hasViewedRole: true, role: 'witch' },
        6: { uid: 'p6', seatNumber: 6, hasViewedRole: true, role: 'hunter' },
      },
      currentNightResults: { charmedSeat: 6, poisonedSeat: 1 },
    });
    expect(computeCanShootForSeat(6, state)).toBe(false);
  });

  it('他人被毒 → true', () => {
    const state = createOngoingState({ currentNightResults: { poisonedSeat: 3 } });
    expect(computeCanShootForSeat(6, state)).toBe(true);
  });
});
