/**
 * WolfVote Integration Tests
 *
 * Tests for wolfVote chain alignment:
 * 1. wolfVotesBySeat single source of truth verification
 * 2. Multi-wolf voting + re-voting (change vote) scenarios
 * 3. Nightmare block edge cases
 * 4. Night flow completion (not stuck after voting)
 *
 * All tests run on harness (createGame)
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { REASON_STEP_STALE } from '@game-judge/game-engine/platform/steps';

import { createGame } from './gameFactory';
import { dispatchStep, executeFullNight, submitActionOrThrow } from './stepByStepRunner';

describe('WolfVote Integration Tests', () => {
  // 12-player board: contains 4 wolf roles
  const TEMPLATE_ROLES: RoleId[] = [
    'villager',
    'villager',
    'villager',
    'villager', // seats 0-3
    'wolf',
    'wolf',
    'wolf',
    'darkWolfKing', // seats 4-7 (4 wolves)
    'seer',
    'witch',
    'hunter',
    'magician', // seats 8-11
  ];

  function createRoleAssignment(): Map<number, RoleId> {
    const map = new Map<number, RoleId>();
    TEMPLATE_ROLES.forEach((role, idx) => map.set(idx, role));
    return map;
  }

  describe('shared wolf vote records', () => {
    it('多狼投票后正确记录所有投票', () => {
      const ctx = createGame(TEMPLATE_ROLES, createRoleAssignment());

      // Run night: all wolves attack seat 0
      executeFullNight(ctx, {
        wolf: 0,
        darkWolfKing: { confirmed: true },
        seer: 0,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
        magician: { targets: [] },
      });

      const state = ctx.getGameState();
      expect(state.nightState?.facts.wolfVotes).toEqual(
        [4, 5, 6, 7].map((actorSeat) => ({ actorSeat, chosenSeat: 0, landingSeat: 0 })),
      );
    });

    it('放弃袭击时每个参狼座位都记录弃票', () => {
      const ctx = createGame(TEMPLATE_ROLES, createRoleAssignment());

      // Run night: wolves abstain from attacking
      executeFullNight(ctx, {
        wolf: null, // abstain from attacking
        darkWolfKing: { confirmed: true },
        seer: 0,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
        magician: { targets: [] },
      });

      const state = ctx.getGameState();
      expect(state.nightState?.facts.wolfVotes).toEqual(
        [4, 5, 6, 7].map((actorSeat) => ({ actorSeat, chosenSeat: null, landingSeat: null })),
      );
    });

    it('投票后 night 正常结束（不会卡住）', () => {
      const ctx = createGame(TEMPLATE_ROLES, createRoleAssignment());

      const result = executeFullNight(ctx, {
        wolf: 2,
        darkWolfKing: { confirmed: true },
        seer: 0,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
        magician: { targets: [] },
      });

      // Night should complete normally
      expect(result.completed).toBe(true);
      // Seat 2 should be dead (attacked)
      expect(result.deaths).toContain(2);
    });
  });

  describe('wolfVote Handler Contract', () => {
    // Minimal template: only wolves + seer/witch/hunter (all after wolfKill)
    // This way wolfKill is the first step
    const SIMPLE_TEMPLATE: RoleId[] = [
      'villager',
      'villager',
      'villager',
      'villager', // seats 0-3
      'wolf',
      'wolf', // seats 4-5
      'seer',
      'witch',
      'hunter', // seats 6-8
      'villager',
      'villager',
      'villager', // seats 9-11
    ];

    function createSimpleRoleAssignment(): Map<number, RoleId> {
      const map = new Map<number, RoleId>();
      SIMPLE_TEMPLATE.forEach((role, idx) => map.set(idx, role));
      return map;
    }

    it('狼人 action command 通过统一 resolver 管线处理', () => {
      const ctx = createGame(SIMPLE_TEMPLATE, createSimpleRoleAssignment());

      // For this template, the first step should be wolfKill (no preceding roles like guard/nightmare/magician)
      ctx.assertStep('wolfKill');

      submitActionOrThrow(ctx, 4, { kind: 'target', target: 1 }, 'first wolf votes');

      const state = ctx.getGameState();
      expect(state.nightState?.facts.wolfVotes).toContainEqual({
        actorSeat: 4,
        chosenSeat: 1,
        landingSeat: 1,
      });
    });

    it('非狼角色在 wolfKill 提交 action 被拒绝', () => {
      const ctx = createGame(SIMPLE_TEMPLATE, createSimpleRoleAssignment());
      ctx.assertStep('wolfKill');

      const result = dispatchStep(ctx, 0, {
        actionKey: 'wolfKill',
        seats: [1],
      });

      if (result.kind !== 'rejected') {
        throw new Error('[FAIL-FAST] A non-wolf vote must reject the command');
      }
      expect(result.reason).toBe(REASON_STEP_STALE);
    });

    it('狼可以改票（覆盖之前的投票）', () => {
      const ctx = createGame(SIMPLE_TEMPLATE, createSimpleRoleAssignment());
      ctx.assertStep('wolfKill');

      // First vote
      submitActionOrThrow(ctx, 4, { kind: 'target', target: 1 }, 'first wolf vote');

      // Verify first vote
      let state = ctx.getGameState();
      expect(state.nightState?.facts.wolfVotes).toEqual([
        { actorSeat: 4, chosenSeat: 1, landingSeat: 1 },
      ]);

      // Change vote
      submitActionOrThrow(ctx, 4, { kind: 'target', target: 2 }, 'changed wolf vote');

      // Verify result after vote change
      state = ctx.getGameState();
      expect(state.nightState?.facts.wolfVotes).toEqual([
        { actorSeat: 4, chosenSeat: 2, landingSeat: 2 },
      ]);
    });

    it('多狼分别投票，正确累积', () => {
      const ctx = createGame(SIMPLE_TEMPLATE, createSimpleRoleAssignment());
      ctx.assertStep('wolfKill');

      // Wolf 1 votes
      submitActionOrThrow(ctx, 4, { kind: 'target', target: 0 }, 'first wolf votes');

      // Wolf 2 votes a different target
      submitActionOrThrow(ctx, 5, { kind: 'target', target: 1 }, 'second wolf votes');

      // Verify all votes are recorded
      const state = ctx.getGameState();
      expect(state.nightState?.facts.wolfVotes).toEqual([
        { actorSeat: 4, chosenSeat: 0, landingSeat: 0 },
        { actorSeat: 5, chosenSeat: 1, landingSeat: 1 },
      ]);
    });
  });

  describe('Nightmare Block Edge Cases', () => {
    // Board with nightmare (simplified: only nightmare + wolf)
    const NIGHTMARE_TEMPLATE: RoleId[] = [
      'nightmare', // seat 0 (nightmare)
      'villager',
      'villager',
      'villager', // seats 1-3
      'wolf',
      'wolf', // seats 4-5
      'seer',
      'witch',
      'hunter',
      'guard', // seats 6-9
      'villager',
      'villager', // seats 10-11
    ];

    function createNightmareRoleAssignment(): Map<number, RoleId> {
      const map = new Map<number, RoleId>();
      NIGHTMARE_TEMPLATE.forEach((role, idx) => map.set(idx, role));
      return map;
    }

    it('nightmare 封锁狼后，狼队袭击被禁用', () => {
      const ctx = createGame(NIGHTMARE_TEMPLATE, createNightmareRoleAssignment());

      // First step should be nightmare
      ctx.assertStep('nightmareBlock');

      // nightmare blocks seat 4 (first wolf)
      submitActionOrThrow(ctx, 0, { kind: 'target', target: 4 }, 'nightmare blocks wolf');

      // Verify block state
      const state = ctx.getGameState();
      expect(state.nightState?.facts.disabledAbilities).toContainEqual({ roleId: '*', seat: 4 });
      expect(state.nightState?.facts.disabledAbilities).toContainEqual({
        roleId: 'wolfKill',
        seat: 5,
      });
    });

    it('nightmare 封锁非狼角色时，不禁用狼队袭击', () => {
      const ctx = createGame(NIGHTMARE_TEMPLATE, createNightmareRoleAssignment());
      ctx.assertStep('nightmareBlock');

      // nightmare blocks seat 1 (villager, not wolf)
      submitActionOrThrow(ctx, 0, { kind: 'target', target: 1 }, 'nightmare blocks villager');

      // Verify wolves are not disabled
      const state = ctx.getGameState();
      expect(state.nightState?.facts.disabledAbilities).toEqual([{ roleId: '*', seat: 1 }]);
    });

    it('nightmare 封锁后通过逐步执行完成夜晚，被封锁狼放弃袭击', () => {
      const ctx = createGame(NIGHTMARE_TEMPLATE, createNightmareRoleAssignment());

      // Run full night: nightmare blocks seat 4 (first wolf)
      // Note: a blocked wolf can only skip (non-skip actions are rejected)
      const result = executeFullNight(ctx, {
        nightmare: 4, // block seat 4
        wolf: null, // wolves abstain (blocked, skip-only)
        seer: 2,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
        guard: 3,
      });

      // Night should complete
      expect(result.completed).toBe(true);

      // Since wolves are blocked, no deaths
      expect(result.deaths).toEqual([]);
    });
  });
});
