/**
 * GameStateService Action Submit Tests
 *
 * Tests for player action submission flow through handlePlayerAction.
 */

import { createHostGame, cleanupHostGame, HostGameContext } from './boards/hostGameFactory';
import { RoleId } from '../../models/roles';

// =============================================================================
// Test Fixtures
// =============================================================================

const TEMPLATE_NAME = '梦魇守卫12人';

function createRoleAssignment(): Map<number, RoleId> {
  const assignment = new Map<number, RoleId>();
  assignment.set(0, 'villager');
  assignment.set(1, 'villager');
  assignment.set(2, 'villager');
  assignment.set(3, 'villager');
  assignment.set(4, 'wolf');
  assignment.set(5, 'wolf');
  assignment.set(6, 'wolf');
  assignment.set(7, 'nightmare');
  assignment.set(8, 'seer');
  assignment.set(9, 'witch');
  assignment.set(10, 'hunter');
  assignment.set(11, 'guard');
  return assignment;
}

// =============================================================================
// Tests
// =============================================================================

describe('GameStateService Action Submit', () => {
  let ctx: HostGameContext;

  afterEach(() => {
    cleanupHostGame();
  });

  describe('行动记录', () => {
    it('狼人行动后应该记录到 actions map', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      await ctx.runNight({
        nightmare: 0,
        guard: 1,
        wolf: 2, // wolf targets seat 2
        witch: null,
        seer: 4,
        hunter: null,
      });

      const state = ctx.getState();
      expect(state).not.toBeNull();

      const wolfAction = state!.actions.get('wolf');
      expect(wolfAction).toBeDefined();
    });

    it('女巫救人行动应该记录', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      await ctx.runNight({
        nightmare: 0,
        guard: 1,
        wolf: 2,
        witch: 2, // save seat 2
        seer: 4,
        hunter: null,
      });

      const state = ctx.getState();
      const witchAction = state!.actions.get('witch');
      expect(witchAction).toBeDefined();
    });

    it('女巫毒人行动应该记录', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      await ctx.runNight({
        nightmare: 0,
        guard: 1,
        wolf: 2,
        witch: null,
        witchPoison: 3, // poison seat 3
        seer: 4,
        hunter: null,
      });

      const state = ctx.getState();
      const witchAction = state!.actions.get('witch');
      expect(witchAction).toBeDefined();
    });
  });

  describe('夜晚流程推进', () => {
    it('所有行动完成后夜晚应该结束', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        nightmare: 0,
        guard: 1,
        wolf: 2,
        witch: null,
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
    });

    it('夜晚结束后应该计算死亡', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        nightmare: 0,
        guard: 1,
        wolf: 2, // wolf kills seat 2
        witch: null,
        seer: 4,
        hunter: null,
      });

      expect(result.deaths).toEqual([2]);
    });

    it('女巫救人后目标不死', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        nightmare: 0,
        guard: 1,
        wolf: 2,
        witch: 2, // save seat 2
        seer: 4,
        hunter: null,
      });

      expect(result.deaths).toEqual([]);
    });

    it('女巫毒人后目标死亡', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        nightmare: 0,
        guard: 1,
        wolf: 2,
        witch: null,
        witchPoison: 3, // poison seat 3
        seer: 4,
        hunter: null,
      });

      // Both wolf target (2) and poison target (3) die
      expect(result.deaths).toContain(2);
      expect(result.deaths).toContain(3);
    });
  });

  describe('梦魇封锁', () => {
    it('梦魇封锁守卫后守卫技能无效', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        nightmare: 11, // block guard at seat 11
        guard: 2, // guard tries to protect seat 2
        wolf: 2, // wolf kills seat 2
        witch: null,
        seer: 4,
        hunter: null,
      });

      // Guard was blocked, so wolf kill succeeds
      expect(result.deaths).toEqual([2]);
    });

    it('梦魇封锁女巫后女巫技能无效', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        nightmare: 9, // block witch at seat 9
        guard: 1,
        wolf: 2,
        witch: 2, // witch tries to save (blocked)
        seer: 4,
        hunter: null,
      });

      // Witch was blocked, so save fails
      expect(result.deaths).toEqual([2]);
    });
  });

  describe('空刀', () => {
    it('狼人空刀应该无人死亡', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        nightmare: 0,
        guard: 1,
        wolf: null, // empty knife
        witch: null,
        seer: 4,
        hunter: null,
      });

      expect(result.deaths).toEqual([]);
      expect(result.info).toContain('平安夜');
    });
  });
});
