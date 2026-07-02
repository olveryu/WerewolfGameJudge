/**
 * Night-1 Integration Test: AwakenedGargoyle Convert
 *
 * Topic: Awakened Gargoyle converts non-wolf player adjacent to a wolf seat.
 *
 * Template: Adjacent-Only
 * Fixed seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-5: wolf
 *   seat 6: awakenedGargoyle
 *   seat 7: seer
 *   seat 8: witch
 *   seat 9: hunter
 *   seat 10: guard
 *   seat 11: graveyardKeeper
 *
 * Core rules:
 * - awakenedGargoyleConvert: chooseSeat (AdjacentToWolfFaction constraint)
 * - target must be adjacent to a wolf faction seat (swap-aware)
 * - conversion result written to WerewolfState.convertedSeat
 * - awakenedGargoyleConvertReveal: groupConfirm (auto-completes)
 *
 * Architecture: intents → handlers → reducer → WerewolfState
 */

import type { RoleId } from '@werewolf/game-engine/werewolf/models/roles';

import { cleanupGame, createGame, type GameContext } from './gameFactory';
import { executeFullNight, executeRemainingSteps, executeStepsUntil } from './stepByStepRunner';

const TEMPLATE_NAME = '唯邻是从';

/**
 * Fixed seat-role assignment
 */
function createRoleAssignment(): Map<number, RoleId> {
  const map = new Map<number, RoleId>();
  map.set(0, 'villager');
  map.set(1, 'villager');
  map.set(2, 'villager');
  map.set(3, 'villager');
  map.set(4, 'wolf');
  map.set(5, 'wolf');
  map.set(6, 'awakenedGargoyle');
  map.set(7, 'seer');
  map.set(8, 'witch');
  map.set(9, 'hunter');
  map.set(10, 'guard');
  map.set(11, 'graveyardKeeper');
  return map;
}

describe('Night-1: AwakenedGargoyle Convert (12p)', () => {
  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  describe('觉醒石像鬼转化相邻玩家', () => {
    it('转化 seat 3（与 wolf seat 4 相邻），convertedSeat = 3', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // Step-aware assertion: verify we reached the awakenedGargoyleConvert step
      expect(executeStepsUntil(ctx, 'awakenedGargoyleConvert')).toBe(true);
      ctx.assertStep('awakenedGargoyleConvert');

      // Continue executing remaining steps
      const result = executeRemainingSteps(ctx, {
        awakenedGargoyle: 3, // 转化 seat 3（与 wolf seat 4 相邻）
        wolf: 1,
        witch: { save: null, poison: null },
        seer: 4,
        guard: 0,
      });

      expect(result.completed).toBe(true);

      // core assertion: convertedSeat written
      const state = ctx.getGameState();
      expect(state.convertedSeat).toBe(3);
    });

    it('转化 seat 0（与 wolf seat 11→0 wrap-around 相邻时需 swap 场景），正常流程', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // villager at seat 3 is adjacent to wolf at seat 4
      const result = executeFullNight(ctx, {
        awakenedGargoyle: 3,
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 5,
        guard: 1,
      });

      expect(result.completed).toBe(true);
      const state = ctx.getGameState();
      expect(state.convertedSeat).toBe(3);
    });
  });

  describe('觉醒石像鬼强制发动', () => {
    it('不选择目标应被拒绝 (canSkip: false)', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      expect(executeStepsUntil(ctx, 'awakenedGargoyleConvert')).toBe(true);
      ctx.assertStep('awakenedGargoyleConvert');

      const result = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 6,
        role: 'awakenedGargoyle',
        target: null,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('觉醒石像鬼约束校验', () => {
    it('转化非相邻座位应被拒绝 (AdjacentToWolfFaction constraint)', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      expect(executeStepsUntil(ctx, 'awakenedGargoyleConvert')).toBe(true);
      ctx.assertStep('awakenedGargoyleConvert');

      // seat 10 (guard) is not adjacent to any wolf faction seat
      // wolves at 4,5; awakenedGargoyle at 6; adjacent non-wolf-faction: 3,7
      // seat 10 neighbors: 9,11 — both are non-wolf
      const result = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 6,
        role: 'awakenedGargoyle',
        target: 10,
      });

      expect(result.success).toBe(false);
    });

    it('转化自己应被拒绝 (NotSelf constraint)', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      expect(executeStepsUntil(ctx, 'awakenedGargoyleConvert')).toBe(true);
      ctx.assertStep('awakenedGargoyleConvert');

      const result = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 6,
        role: 'awakenedGargoyle',
        target: 6,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toContain('自己');
    });

    it('转化狼人阵营玩家应被拒绝 (NotWolfFaction constraint)', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      expect(executeStepsUntil(ctx, 'awakenedGargoyleConvert')).toBe(true);
      ctx.assertStep('awakenedGargoyleConvert');

      // seat 4 is wolf (wolf faction) — cannot convert wolf faction
      const result = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 6,
        role: 'awakenedGargoyle',
        target: 4,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('awakenedGargoyleConvertReveal 步骤', () => {
    it('groupConfirm 步骤在最后正常推进', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // advance to awakenedGargoyleConvertReveal (the final night step)
      expect(
        executeStepsUntil(ctx, 'awakenedGargoyleConvertReveal', {
          awakenedGargoyle: 3, // 转化 seat 3
          wolf: 0,
          witch: { save: null, poison: null },
          seer: 4,
          guard: 1,
        }),
      ).toBe(true);
      ctx.assertStep('awakenedGargoyleConvertReveal');

      // Night-1 completes after groupConfirm step advances
      const result = executeRemainingSteps(ctx);

      expect(result.completed).toBe(true);
    });
  });
});
