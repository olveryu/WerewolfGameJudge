/**
 * Night-1 Integration Test: PureWhite + WolfWitch Check
 *
 * 主题：纯白之女 & 狼巫查验结果（返回具体角色身份）。
 *
 * 模板：纯白夜影12人
 * 固定 seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-6: wolf
 *   seat 7: wolfWitch
 *   seat 8: guard
 *   seat 9: witch
 *   seat 10: hunter
 *   seat 11: pureWhite
 *
 * 核心规则：
 * - pureWhite 查验返回具体角色身份
 * - wolfWitch 查验返回具体角色身份，且不能查验狼阵营
 * - 结果写入 GameState.pureWhiteReveal / wolfWitchReveal
 *
 * 架构：intents → handlers → reducer → GameState
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';

import { cleanupGame, createGame, GameContext } from './gameFactory';
import { executeFullNight, executeRemainingSteps, executeStepsUntil } from './stepByStepRunner';

const TEMPLATE_NAME = '纯白夜影12人';

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
  map.set(7, 'wolfWitch');
  map.set(8, 'guard');
  map.set(9, 'witch');
  map.set(10, 'hunter');
  map.set(11, 'pureWhite');
  return map;
}

describe('Night-1: PureWhite + WolfWitch Check (12p)', () => {
  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  // ===========================================================================
  // PureWhite 查验
  // ===========================================================================

  describe('PureWhite 查验返回具体角色', () => {
    it('pureWhite 查验 villager(0)，返回 villager', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      expect(executeStepsUntil(ctx, 'pureWhiteCheck')).toBe(true);
      ctx.assertStep('pureWhiteCheck');

      const result = executeRemainingSteps(ctx, {
        pureWhite: 0,
        wolf: 1,
        witch: { save: null, poison: null },
        guard: 2,
        wolfWitch: 3,
      });

      expect(result.completed).toBe(true);

      const state = ctx.getGameState();
      expect(state.pureWhiteReveal).toBeDefined();
      expect(state.pureWhiteReveal!.targetSeat).toBe(0);
      expect(state.pureWhiteReveal!.result).toBe('villager');
    });

    it('pureWhite 查验 wolf(4)，返回 wolf', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        pureWhite: 4,
        wolf: 0,
        witch: { save: null, poison: null },
        guard: 1,
        wolfWitch: 2,
      });

      expect(result.completed).toBe(true);

      const state = ctx.getGameState();
      expect(state.pureWhiteReveal).toBeDefined();
      expect(state.pureWhiteReveal!.targetSeat).toBe(4);
      expect(state.pureWhiteReveal!.result).toBe('wolf');
    });

    it('pureWhite 查验 wolfWitch(7)，返回 wolfWitch', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        pureWhite: 7,
        wolf: 0,
        witch: { save: null, poison: null },
        guard: 1,
        wolfWitch: 2,
      });

      expect(result.completed).toBe(true);

      const state = ctx.getGameState();
      expect(state.pureWhiteReveal).toBeDefined();
      expect(state.pureWhiteReveal!.targetSeat).toBe(7);
      expect(state.pureWhiteReveal!.result).toBe('wolfWitch');
    });

    it('pureWhite 查验 witch(9)，返回 witch', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        pureWhite: 9,
        wolf: 0,
        witch: { save: null, poison: null },
        guard: 1,
        wolfWitch: 2,
      });

      expect(result.completed).toBe(true);

      const state = ctx.getGameState();
      expect(state.pureWhiteReveal).toBeDefined();
      expect(state.pureWhiteReveal!.targetSeat).toBe(9);
      expect(state.pureWhiteReveal!.result).toBe('witch');
    });
  });

  describe('PureWhite 空选', () => {
    it('pureWhite 不查验时，pureWhiteReveal 不写入', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      expect(executeStepsUntil(ctx, 'pureWhiteCheck')).toBe(true);
      ctx.assertStep('pureWhiteCheck');

      const result = executeRemainingSteps(ctx, {
        pureWhite: null,
        wolf: 0,
        witch: { save: null, poison: null },
        guard: 1,
        wolfWitch: 2,
      });

      expect(result.completed).toBe(true);

      const state = ctx.getGameState();
      expect(state.pureWhiteReveal).toBeUndefined();
    });
  });

  // ===========================================================================
  // WolfWitch 查验
  // ===========================================================================

  describe('WolfWitch 查验返回具体角色（非狼阵营）', () => {
    it('wolfWitch 查验 villager(0)，返回 villager', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      expect(executeStepsUntil(ctx, 'wolfWitchCheck')).toBe(true);
      ctx.assertStep('wolfWitchCheck');

      const result = executeRemainingSteps(ctx, {
        wolfWitch: 0,
        wolf: 1,
        witch: { save: null, poison: null },
        guard: 2,
        pureWhite: 3,
      });

      expect(result.completed).toBe(true);

      const state = ctx.getGameState();
      expect(state.wolfWitchReveal).toBeDefined();
      expect(state.wolfWitchReveal!.targetSeat).toBe(0);
      expect(state.wolfWitchReveal!.result).toBe('villager');
    });

    it('wolfWitch 查验 pureWhite(11)，返回 pureWhite', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        wolfWitch: 11,
        wolf: 0,
        witch: { save: null, poison: null },
        guard: 1,
        pureWhite: 2,
      });

      expect(result.completed).toBe(true);

      const state = ctx.getGameState();
      expect(state.wolfWitchReveal).toBeDefined();
      expect(state.wolfWitchReveal!.targetSeat).toBe(11);
      expect(state.wolfWitchReveal!.result).toBe('pureWhite');
    });

    it('wolfWitch 查验 guard(8)，返回 guard', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        wolfWitch: 8,
        wolf: 0,
        witch: { save: null, poison: null },
        guard: 1,
        pureWhite: 2,
      });

      expect(result.completed).toBe(true);

      const state = ctx.getGameState();
      expect(state.wolfWitchReveal).toBeDefined();
      expect(state.wolfWitchReveal!.targetSeat).toBe(8);
      expect(state.wolfWitchReveal!.result).toBe('guard');
    });
  });

  describe('WolfWitch 空选', () => {
    it('wolfWitch 不查验时，wolfWitchReveal 不写入', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      expect(executeStepsUntil(ctx, 'wolfWitchCheck')).toBe(true);
      ctx.assertStep('wolfWitchCheck');

      const result = executeRemainingSteps(ctx, {
        wolfWitch: null,
        wolf: 0,
        witch: { save: null, poison: null },
        guard: 1,
        pureWhite: 2,
      });

      expect(result.completed).toBe(true);

      const state = ctx.getGameState();
      expect(state.wolfWitchReveal).toBeUndefined();
    });
  });
});
