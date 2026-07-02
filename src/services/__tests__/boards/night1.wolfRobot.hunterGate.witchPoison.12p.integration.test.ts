/**
 * Night-1 Integration Test: WolfRobot learns Hunter + Witch poison scenarios
 *
 * Theme: after Wolf Robot learns Hunter, two outcomes based on whether Witch poisons it
 *
 * Custom template (12 players, with wolfRobot + witch + hunter)
 * Fixed seat-role assignment:
 *   seat 0-2: villager
 *   seat 3: hunter
 *   seat 4-6: wolf
 *   seat 7: wolfRobot
 *   seat 8: seer
 *   seat 9: witch
 *   seat 10: guard
 *   seat 11: psychic
 *
 * Core rules (WolfRobot Hunter Gate):
 * - After wolfRobot learns hunter, wolfRobotReveal.learnedRoleId === 'hunter'
 * - wolfRobotContext.disguisedRole === 'hunter'
 * - wolfRobotHunterStatusViewed starts as false; becomes true after WOLF_ROBOT_HUNTER_STATUS_VIEWED is sent
 * - Night can only advance after the gate is cleared
 *
 * Test style: execute every step in NightPlan order; skip nothing
 * Use the unified runner (stepByStepRunner.ts); no custom runners
 *
 * Architecture: intents -> handlers -> resolver -> WerewolfState
 */

import type { RoleId } from '@werewolf/game-engine/werewolf/models/roles';

import { cleanupGame, createGame, type GameContext } from './gameFactory';
import { executeRemainingSteps, executeStepsUntil, sendMessageOrThrow } from './stepByStepRunner';

/**
 * Custom role list (with wolfRobot + witch + hunter)
 */
const CUSTOM_ROLES: RoleId[] = [
  'villager',
  'villager',
  'villager',
  'hunter',
  'wolf',
  'wolf',
  'wolf',
  'wolfRobot',
  'seer',
  'witch',
  'guard',
  'psychic',
];

/**
 * Fixed seat-role assignment
 */
function createRoleAssignment(): Map<number, RoleId> {
  const map = new Map<number, RoleId>();
  map.set(0, 'villager');
  map.set(1, 'villager');
  map.set(2, 'villager');
  map.set(3, 'hunter');
  map.set(4, 'wolf');
  map.set(5, 'wolf');
  map.set(6, 'wolf');
  map.set(7, 'wolfRobot');
  map.set(8, 'seer');
  map.set(9, 'witch');
  map.set(10, 'guard');
  map.set(11, 'psychic');
  return map;
}

const WOLF_ROBOT_SEAT = 7;
const HUNTER_SEAT = 3;

describe('Night-1: WolfRobot learns Hunter + Witch poison scenarios (12p)', () => {
  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  describe('Hunter Gate 行为验证', () => {
    it('wolfRobot 学习 hunter 后，wolfRobotHunterStatusViewed 初始为 false，发送 WOLF_ROBOT_HUNTER_STATUS_VIEWED 后变为 true', () => {
      ctx = createGame(CUSTOM_ROLES, createRoleAssignment());

      // Step 1: execute in order up to wolfRobotLearn step (using unified runner)
      const reachedWolfRobot = executeStepsUntil(ctx, 'wolfRobotLearn', {
        wolf: 0, // attack villager seat 0
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
      });
      expect(reachedWolfRobot).toBe(true);
      ctx.assertStep('wolfRobotLearn');

      // Step 2: submit wolfRobot's action to learn hunter (seat 3) (explicit send, fail-fast)
      sendMessageOrThrow(
        ctx,
        {
          type: 'ACTION',
          seat: WOLF_ROBOT_SEAT,
          role: 'wolfRobot',
          target: HUNTER_SEAT,
          extra: undefined,
        },
        'wolfRobot learn hunter',
      );

      // Assertion 1: learn fact recorded
      const stateAfterLearn = ctx.getGameState();
      expect(stateAfterLearn.wolfRobotReveal).toBeDefined();
      expect(stateAfterLearn.wolfRobotReveal?.learnedRoleId).toBe('hunter');
      expect(stateAfterLearn.wolfRobotReveal?.targetSeat).toBe(HUNTER_SEAT);

      // Assertion 2: disguise context written
      expect(stateAfterLearn.wolfRobotContext).toBeDefined();
      expect(stateAfterLearn.wolfRobotContext?.disguisedRole).toBe('hunter');

      // Assertion 3: Hunter gate starts as false
      expect(stateAfterLearn.wolfRobotHunterStatusViewed).toBe(false);

      // Assertion 4: current step is still wolfRobotLearn (blocked by gate)
      expect(stateAfterLearn.currentStepId).toBe('wolfRobotLearn');

      // Step 3: attempt advance (should be blocked by gate)
      const advResultBlocked = ctx.advanceNight();
      expect(advResultBlocked.success).toBe(false);
      expect(advResultBlocked.reason).toContain('wolfrobot_hunter_status_not_viewed');

      // Step 4: send WOLF_ROBOT_HUNTER_STATUS_VIEWED to clear gate (explicit send, real protocol)
      sendMessageOrThrow(
        ctx,
        {
          type: 'WOLF_ROBOT_HUNTER_STATUS_VIEWED',
          seat: WOLF_ROBOT_SEAT,
        },
        'wolf robot hunter gate',
      );

      // Assertion 5: gate cleared
      const stateAfterGate = ctx.getGameState();
      expect(stateAfterGate.wolfRobotHunterStatusViewed).toBe(true);

      // Assertion 6: advance no longer rejected (can move to next step)
      ctx.advanceNightOrThrow('after gate cleared');

      // Assertion 7: advanced to next step (no longer wolfRobotLearn)
      const stateAfterAdvance = ctx.getGameState();
      expect(stateAfterAdvance.currentStepId).not.toBe('wolfRobotLearn');
    });
  });

  describe('Case A: 学到猎人 + 女巫毒他', () => {
    it('女巫毒杀学到猎人的机械狼人，机械狼人死亡但 wolfRobotReveal/wolfRobotContext 仍存在', () => {
      ctx = createGame(CUSTOM_ROLES, createRoleAssignment());

      // Step 1: execute in order up to wolfRobotLearn step
      // Witch poisons wolfRobot earlier
      const reachedWolfRobot = executeStepsUntil(ctx, 'wolfRobotLearn', {
        wolf: 0, // attack villager seat 0
        witch: { save: null, poison: WOLF_ROBOT_SEAT }, // witch poisons wolfRobot
        hunter: { confirmed: true },
      });
      expect(reachedWolfRobot).toBe(true);
      ctx.assertStep('wolfRobotLearn');

      // Step 2: wolfRobot learns hunter (explicit send)
      sendMessageOrThrow(
        ctx,
        {
          type: 'ACTION',
          seat: WOLF_ROBOT_SEAT,
          role: 'wolfRobot',
          target: HUNTER_SEAT,
          extra: undefined,
        },
        'wolfRobot learn hunter',
      );

      // Verify learn result
      let state = ctx.getGameState();
      expect(state.wolfRobotReveal?.learnedRoleId).toBe('hunter');
      expect(state.wolfRobotContext?.disguisedRole).toBe('hunter');
      expect(state.wolfRobotHunterStatusViewed).toBe(false);

      // Step 3: send WOLF_ROBOT_HUNTER_STATUS_VIEWED to clear gate (explicit send)
      sendMessageOrThrow(
        ctx,
        {
          type: 'WOLF_ROBOT_HUNTER_STATUS_VIEWED',
          seat: WOLF_ROBOT_SEAT,
        },
        'wolf robot hunter gate',
      );

      state = ctx.getGameState();
      expect(state.wolfRobotHunterStatusViewed).toBe(true);

      // Advance to next step
      ctx.advanceNightOrThrow('after wolfRobot gate cleared');

      // Step 4: complete remaining steps (using unified runner)
      const { deaths } = executeRemainingSteps(ctx, {
        seer: 4, // Seer checks wolf
        psychic: 5, // Psychic checks wolf
      });

      // Core assertion: wolfRobot seat is poisoned
      expect(deaths).toContain(WOLF_ROBOT_SEAT);

      // Attacked villager seat 0 also dies
      expect(deaths).toContain(0);

      // Regression: poison should not affect existence of wolfRobotReveal / wolfRobotContext
      const finalState = ctx.getGameState();
      expect(finalState.wolfRobotReveal).toBeDefined();
      expect(finalState.wolfRobotReveal?.learnedRoleId).toBe('hunter');
      expect(finalState.wolfRobotContext).toBeDefined();
      expect(finalState.wolfRobotContext?.disguisedRole).toBe('hunter');
    });
  });

  describe('Case B: 学到猎人 + 女巫不毒他', () => {
    it('女巫不毒机械狼人，机械狼人存活且 wolfRobotReveal 仍存在', () => {
      ctx = createGame(CUSTOM_ROLES, createRoleAssignment());

      // Step 1: execute in order up to wolfRobotLearn step
      // Witch does not poison
      const reachedWolfRobot = executeStepsUntil(ctx, 'wolfRobotLearn', {
        wolf: 0, // attack villager seat 0
        witch: { save: null, poison: null }, // witch does not poison
        hunter: { confirmed: true },
      });
      expect(reachedWolfRobot).toBe(true);
      ctx.assertStep('wolfRobotLearn');

      // Step 2: wolfRobot learns hunter (explicit send)
      sendMessageOrThrow(
        ctx,
        {
          type: 'ACTION',
          seat: WOLF_ROBOT_SEAT,
          role: 'wolfRobot',
          target: HUNTER_SEAT,
          extra: undefined,
        },
        'wolfRobot learn hunter',
      );

      // Verify learn result and gate state
      let state = ctx.getGameState();
      expect(state.wolfRobotReveal?.learnedRoleId).toBe('hunter');
      expect(state.wolfRobotContext?.disguisedRole).toBe('hunter');
      expect(state.wolfRobotHunterStatusViewed).toBe(false);

      // Step 3: send WOLF_ROBOT_HUNTER_STATUS_VIEWED to clear gate (explicit send)
      sendMessageOrThrow(
        ctx,
        {
          type: 'WOLF_ROBOT_HUNTER_STATUS_VIEWED',
          seat: WOLF_ROBOT_SEAT,
        },
        'wolf robot hunter gate',
      );

      state = ctx.getGameState();
      expect(state.wolfRobotHunterStatusViewed).toBe(true);

      // Advance to next step
      ctx.advanceNightOrThrow('after wolfRobot gate cleared');

      // Step 4: complete remaining steps (using unified runner)
      const { deaths } = executeRemainingSteps(ctx, {
        seer: 4,
        psychic: 5,
      });

      // Core assertion: wolfRobot seat not in death list (still alive)
      expect(deaths).not.toContain(WOLF_ROBOT_SEAT);

      // Attacked villager seat 0 dies
      expect(deaths).toContain(0);

      // wolfRobotReveal still exists
      const finalState = ctx.getGameState();
      expect(finalState.wolfRobotReveal).toBeDefined();
      expect(finalState.wolfRobotReveal?.learnedRoleId).toBe('hunter');
      expect(finalState.wolfRobotContext).toBeDefined();
      expect(finalState.wolfRobotContext?.disguisedRole).toBe('hunter');
    });
  });

  describe('Edge cases', () => {
    it('wolfRobot 学习非 hunter 角色时，不触发 hunter gate', () => {
      ctx = createGame(CUSTOM_ROLES, createRoleAssignment());

      // Execute in order up to wolfRobotLearn step (using unified runner)
      const reachedWolfRobot = executeStepsUntil(ctx, 'wolfRobotLearn', {
        wolf: 0,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
      });
      expect(reachedWolfRobot).toBe(true);

      // wolfRobot learns villager (seat 0) (explicit send)
      sendMessageOrThrow(
        ctx,
        {
          type: 'ACTION',
          seat: WOLF_ROBOT_SEAT,
          role: 'wolfRobot',
          target: 0, // villager
          extra: undefined,
        },
        'wolfRobot learn villager',
      );

      const state = ctx.getGameState();

      // Learned villager, not hunter
      expect(state.wolfRobotReveal?.learnedRoleId).toBe('villager');

      // Should not trigger hunter gate (wolfRobotHunterStatusViewed should be absent or not false)
      expect(state.wolfRobotHunterStatusViewed).not.toBe(false);

      // Can advance directly (not blocked by gate)
      ctx.advanceNightOrThrow('after learning non-hunter');
    });

    it('wolfRobot 跳过学习时，不触发 hunter gate', () => {
      ctx = createGame(CUSTOM_ROLES, createRoleAssignment());

      // Execute in order up to wolfRobotLearn step (using unified runner)
      const reachedWolfRobot = executeStepsUntil(ctx, 'wolfRobotLearn', {
        wolf: 0,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
      });
      expect(reachedWolfRobot).toBe(true);

      // wolfRobot skips learning (explicit send)
      sendMessageOrThrow(
        ctx,
        {
          type: 'ACTION',
          seat: WOLF_ROBOT_SEAT,
          role: 'wolfRobot',
          target: null, // skip
          extra: undefined,
        },
        'wolfRobot skip',
      );

      const state = ctx.getGameState();

      // Did not learn; wolfRobotReveal should not have learnedRoleId
      expect(state.wolfRobotReveal?.learnedRoleId).toBeUndefined();

      // Should not trigger hunter gate
      expect(state.wolfRobotHunterStatusViewed).not.toBe(false);

      // Can advance directly
      ctx.advanceNightOrThrow('after skip');
    });
  });
});
