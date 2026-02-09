/**
 * confirmContext.test.ts
 *
 * 测试 maybeCreateConfirmStatusAction 纯函数（公共 API）
 * confirmStatus 计算逻辑通过公共 API 间接覆盖
 */

import { maybeCreateConfirmStatusAction } from '@/services/engine/handlers/confirmContext';
import type { BroadcastGameState } from '@/services/protocol/types';

// =============================================================================
// Test Helper
// =============================================================================

function createOngoingState(
  overrides: Partial<BroadcastGameState> = {},
): NonNullable<BroadcastGameState> {
  return {
    roomCode: 'TEST',
    hostUid: 'host',
    status: 'ongoing',
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

  it('黑狼王被毒 → canShoot = false', () => {
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

  it('黑狼王未被毒 → canShoot = true', () => {
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
});
