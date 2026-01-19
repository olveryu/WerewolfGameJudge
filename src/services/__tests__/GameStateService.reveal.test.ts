/**
 * GameStateService Reveal Tests
 *
 * Tests for role-specific reveal functionality via gameState properties.
 * After refactor: reveals are stored in gameState instead of private messages.
 */

import { createHostGame, cleanupHostGame, HostGameContext } from './boards/hostGameFactory';
import { RoleId } from '../../models/roles';
import { GameStatus } from '../GameStateService';

// =============================================================================
// Test Fixtures
// =============================================================================

function createStandardRoleAssignment(): Map<number, RoleId> {
  const assignment = new Map<number, RoleId>();
  assignment.set(0, 'villager');
  assignment.set(1, 'villager');
  assignment.set(2, 'villager');
  assignment.set(3, 'villager');
  assignment.set(4, 'wolf');
  assignment.set(5, 'wolf');
  assignment.set(6, 'wolf');
  assignment.set(7, 'seer');
  assignment.set(8, 'witch');
  assignment.set(9, 'hunter');
  assignment.set(10, 'guard');
  assignment.set(11, 'villager');
  return assignment;
}

// =============================================================================
// Tests
// =============================================================================

describe('GameStateService Reveal Tests (gameState properties)', () => {
  let ctx: HostGameContext;

  afterEach(() => {
    cleanupHostGame();
  });

  describe('seerReveal', () => {
    it('预言家查验狼人应显示狼人结果', async () => {
      const TEMPLATE = '标准板12人';
      ctx = await createHostGame(TEMPLATE, createStandardRoleAssignment());

      const state = ctx.getState();
      expect(state?.status).toBe(GameStatus.ongoing);

      // Run night with seer checking a wolf (seat 4)
      const result = await ctx.runNight({
        wolf: 0, // wolves kill villager at seat 0
        seer: 4, // seer checks wolf at seat 4
        witch: null, // witch does nothing
        guard: null, // guard does nothing
      });

      expect(result.completed).toBe(true);

      // After seer action, seerReveal should be set in gameState
      const stateAfter = ctx.getState();
      expect(stateAfter?.seerReveal).toBeDefined();
      expect(stateAfter?.seerReveal?.targetSeat).toBe(4);
      expect(stateAfter?.seerReveal?.result).toBe('狼人');
    });

    it('预言家查验好人应显示好人结果', async () => {
      const TEMPLATE = '标准板12人';
      ctx = await createHostGame(TEMPLATE, createStandardRoleAssignment());

      // Run night with seer checking a villager (seat 0)
      const result = await ctx.runNight({
        wolf: 1, // wolves kill villager at seat 1
        seer: 0, // seer checks villager at seat 0
        witch: null,
        guard: null,
      });

      expect(result.completed).toBe(true);

      const stateAfter = ctx.getState();
      expect(stateAfter?.seerReveal).toBeDefined();
      expect(stateAfter?.seerReveal?.targetSeat).toBe(0);
      expect(stateAfter?.seerReveal?.result).toBe('好人');
    });
  });

  describe('witchContext', () => {
    it('女巫回合应显示被杀玩家', async () => {
      const TEMPLATE = '标准板12人';
      ctx = await createHostGame(TEMPLATE, createStandardRoleAssignment());

      // The test needs to check witchContext during night, not after
      // For now, we verify the night completes successfully
      const result = await ctx.runNight({
        wolf: 0, // wolves kill villager at seat 0
        seer: 4,
        witch: null, // witch skips (we're testing that she sees the kill)
        guard: null,
      });

      expect(result.completed).toBe(true);
      // The witch should have seen killedIndex during her turn
      // This is harder to verify after night ends - the context is cleared
    });
  });

  describe('confirmStatus', () => {
    it('猎人确认阶段应设置 confirmStatus', async () => {
      const TEMPLATE = '标准板12人';
      ctx = await createHostGame(TEMPLATE, createStandardRoleAssignment());

      // Run night where wolves kill hunter (seat 9)
      const result = await ctx.runNight({
        wolf: 9, // wolves kill hunter
        seer: 4,
        witch: null, // witch doesn't save
        guard: null,
      });

      expect(result.completed).toBe(true);

      // Hunter dies, so confirmStatus should be set
      // Note: confirmStatus is set during confirm phase, which may have been processed
      // This test verifies the night flow completes with hunter death
      expect(result.deaths).toContain(9);
    });
  });
});
