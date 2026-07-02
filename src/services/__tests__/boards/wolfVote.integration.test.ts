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

import type { RoleId } from '@werewolf/game-engine/werewolf/models/roles';

import { createGame } from './gameFactory';
import { executeFullNight } from './stepByStepRunner';

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

  describe('wolfVotesBySeat Single Source of Truth', () => {
    it('多狼投票后 wolfVotesBySeat 正确记录所有投票', () => {
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

      // Verify wolfVotesBySeat single source of truth
      const state = ctx.getGameState();
      const wolfVotesBySeat = state.currentNightResults?.wolfVotesBySeat;

      expect(wolfVotesBySeat).toBeDefined();

      // All 4 wolves (seats 4, 5, 6, 7) should have vote records
      expect(wolfVotesBySeat!['4']).toBe(0);
      expect(wolfVotesBySeat!['5']).toBe(0);
      expect(wolfVotesBySeat!['6']).toBe(0);
      expect(wolfVotesBySeat!['7']).toBe(0);
    });

    it('放弃袭击时 wolfVotesBySeat 记录 -1', () => {
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

      // Verify abstain attack record
      const state = ctx.getGameState();
      const wolfVotesBySeat = state.currentNightResults?.wolfVotesBySeat;

      // When abstaining, the lead wolf's vote should be recorded as -1
      // Note: in the current implementation, when abstaining, only the lead wolf sends ACTION; other wolves don't send WOLF_VOTE
      // So only the lead wolf may have a record
      expect(wolfVotesBySeat).toBeDefined();
      // At least the lead wolf should have a record
      const wolfSeats = ['4', '5', '6', '7'];
      const hasEmptyAttackRecord = wolfSeats.some((seat) => wolfVotesBySeat![seat] === -1);
      expect(hasEmptyAttackRecord).toBe(true);
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

    it('WOLF_VOTE 消息通过统一 resolver 管线处理', () => {
      const ctx = createGame(SIMPLE_TEMPLATE, createSimpleRoleAssignment());

      // For this template, the first step should be wolfKill (no preceding roles like guard/nightmare/magician)
      ctx.assertStep('wolfKill');

      // Manually send WOLF_VOTE message
      const sendResult = ctx.sendPlayerMessage({
        type: 'WOLF_VOTE',
        seat: 4, // first wolf
        target: 1,
      });

      expect(sendResult.success).toBe(true);

      // Verify wolfVotesBySeat is updated
      const state = ctx.getGameState();
      expect(state.currentNightResults?.wolfVotesBySeat?.['4']).toBe(1);
    });

    it('非狼角色发送 WOLF_VOTE 被拒绝', () => {
      const ctx = createGame(SIMPLE_TEMPLATE, createSimpleRoleAssignment());
      ctx.assertStep('wolfKill');

      // Non-wolf role attempts to send WOLF_VOTE
      const sendResult = ctx.sendPlayerMessage({
        type: 'WOLF_VOTE',
        seat: 0, // villager
        target: 1,
      });

      expect(sendResult.success).toBe(false);
      // When villager sends WOLF_VOTE:
      // - First goes through validateActionPreconditions step check
      // - villager doesn't satisfy doesRoleParticipateInWolfVote, so step_mismatch
      // - Or falls through to not_wolf_participant
      // As long as it's rejected, the behavior is correct
      expect(['step_mismatch', 'not_wolf_participant']).toContain(sendResult.reason);
    });

    it('狼可以改票（覆盖之前的投票）', () => {
      const ctx = createGame(SIMPLE_TEMPLATE, createSimpleRoleAssignment());
      ctx.assertStep('wolfKill');

      // First vote
      ctx.sendPlayerMessage({
        type: 'WOLF_VOTE',
        seat: 4,
        target: 1,
      });

      // Verify first vote
      let state = ctx.getGameState();
      expect(state.currentNightResults?.wolfVotesBySeat?.['4']).toBe(1);

      // Change vote
      ctx.sendPlayerMessage({
        type: 'WOLF_VOTE',
        seat: 4,
        target: 2,
      });

      // Verify result after vote change
      state = ctx.getGameState();
      expect(state.currentNightResults?.wolfVotesBySeat?.['4']).toBe(2);
    });

    it('多狼分别投票，wolfVotesBySeat 正确累积', () => {
      const ctx = createGame(SIMPLE_TEMPLATE, createSimpleRoleAssignment());
      ctx.assertStep('wolfKill');

      // Wolf 1 votes
      ctx.sendPlayerMessage({
        type: 'WOLF_VOTE',
        seat: 4,
        target: 0,
      });

      // Wolf 2 votes a different target
      ctx.sendPlayerMessage({
        type: 'WOLF_VOTE',
        seat: 5,
        target: 1,
      });

      // Verify all votes are recorded
      const state = ctx.getGameState();
      const wolfVotesBySeat = state.currentNightResults?.wolfVotesBySeat;

      expect(wolfVotesBySeat).toBeDefined();
      expect(wolfVotesBySeat!['4']).toBe(0);
      expect(wolfVotesBySeat!['5']).toBe(1);
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

    it('nightmare 封锁狼后，wolfKillOverride set', () => {
      const ctx = createGame(NIGHTMARE_TEMPLATE, createNightmareRoleAssignment());

      // First step should be nightmare
      ctx.assertStep('nightmareBlock');

      // nightmare blocks seat 4 (first wolf)
      const blockResult = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 0,
        role: 'nightmare',
        target: 4,
      });
      expect(blockResult.success).toBe(true);

      // Verify block state
      const state = ctx.getGameState();
      expect(state.currentNightResults?.blockedSeat).toBe(4);
      expect(state.currentNightResults?.wolfKillOverride).toBeDefined();
      expect(state.currentNightResults?.wolfKillOverride?.source).toBe('nightmare');
    });

    it('nightmare 封锁非狼角色时，wolfKillOverride 不设置', () => {
      const ctx = createGame(NIGHTMARE_TEMPLATE, createNightmareRoleAssignment());
      ctx.assertStep('nightmareBlock');

      // nightmare blocks seat 1 (villager, not wolf)
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 0,
        role: 'nightmare',
        target: 1,
      });

      // Verify wolves are not disabled
      const state = ctx.getGameState();
      expect(state.currentNightResults?.blockedSeat).toBe(1);
      expect(state.currentNightResults?.wolfKillOverride).toBeUndefined();
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
