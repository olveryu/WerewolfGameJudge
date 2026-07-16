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
 * - wolfRobotHunterStatusViewed starts as false; becomes true after the hunter-status ACK commits
 * - Inline progression can only advance after the reveal and hunter-status ACKs commit
 *
 * Test style: execute every step in NightPlan order; skip nothing
 * Use the unified runner (stepByStepRunner.ts); no custom runners
 *
 * Architecture: intents -> handlers -> resolver -> GameState
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';

import type { GameContext } from './gameContext';
import { cleanupGame, createGame } from './gameFactory';
import { executeRemainingSteps, executeStepsUntil, submitActionOrThrow } from './stepByStepRunner';

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
    it('wolfRobot 学习 hunter 后，提交公开 ACK 会清除 gate 并触发内联推进', () => {
      ctx = createGame(CUSTOM_ROLES, createRoleAssignment());

      // Step 1: execute in order up to wolfRobotLearn step (using unified runner)
      const reachedWolfRobot = executeStepsUntil(ctx, 'wolfRobotLearn', {
        wolf: 0, // attack villager seat 0
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
      });
      expect(reachedWolfRobot).toBe(true);
      ctx.assertStep('wolfRobotLearn');

      // Step 2: submit wolfRobot's action to learn hunter (seat 3)
      submitActionOrThrow(
        ctx,
        WOLF_ROBOT_SEAT,
        { kind: 'target', target: HUNTER_SEAT },
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

      // Step 3: a production progression request commits but cannot bypass either ACK gate
      const blockedProgressResult = ctx.dispatch({ type: 'werewolf.progress.request' });
      expect(blockedProgressResult).toMatchObject({
        kind: 'committed',
        outcome: { kind: 'success' },
      });
      expect(ctx.getGameState().currentStepId).toBe('wolfRobotLearn');

      // Step 4: only the Wolf Robot seat can acknowledge its hunter status
      const rejectedHunterStatusAck = ctx.dispatchAsSeat(HUNTER_SEAT, {
        type: 'werewolf.wolfRobot.ackHunterStatus',
      });
      expect(rejectedHunterStatusAck).toMatchObject({
        kind: 'rejected',
        reason: 'invalid_seat',
      });

      // Step 5: reveal ACK commits, but the hunter-status gate still blocks inline progression
      const revealAckResult = ctx.dispatchAsSeat(WOLF_ROBOT_SEAT, {
        type: 'werewolf.reveal.ack',
      });
      expect(revealAckResult).toMatchObject({
        kind: 'committed',
        outcome: { kind: 'success' },
      });
      expect(ctx.getGameState().currentStepId).toBe('wolfRobotLearn');
      expect(ctx.getGameState().wolfRobotHunterStatusViewed).toBe(false);

      // Step 6: hunter-status ACK clears the gate and production inline progression advances
      const hunterStatusAckResult = ctx.dispatchAsSeat(WOLF_ROBOT_SEAT, {
        type: 'werewolf.wolfRobot.ackHunterStatus',
      });
      expect(hunterStatusAckResult).toMatchObject({
        kind: 'committed',
        outcome: { kind: 'success' },
      });

      const stateAfterGate = ctx.getGameState();
      expect(stateAfterGate.wolfRobotHunterStatusViewed).toBe(true);
      expect(stateAfterGate.currentStepId).not.toBe('wolfRobotLearn');
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

      // Step 2: wolfRobot learns hunter
      submitActionOrThrow(
        ctx,
        WOLF_ROBOT_SEAT,
        { kind: 'target', target: HUNTER_SEAT },
        'wolfRobot learn hunter',
      );

      // Verify learn result
      let state = ctx.getGameState();
      expect(state.wolfRobotReveal?.learnedRoleId).toBe('hunter');
      expect(state.wolfRobotContext?.disguisedRole).toBe('hunter');
      expect(state.wolfRobotHunterStatusViewed).toBe(false);

      // Step 3: commit both public ACKs; the second ACK advances inline
      const revealAckResult = ctx.dispatchAsSeat(WOLF_ROBOT_SEAT, {
        type: 'werewolf.reveal.ack',
      });
      expect(revealAckResult).toMatchObject({
        kind: 'committed',
        outcome: { kind: 'success' },
      });
      const hunterStatusAckResult = ctx.dispatchAsSeat(WOLF_ROBOT_SEAT, {
        type: 'werewolf.wolfRobot.ackHunterStatus',
      });
      expect(hunterStatusAckResult).toMatchObject({
        kind: 'committed',
        outcome: { kind: 'success' },
      });

      state = ctx.getGameState();
      expect(state.wolfRobotHunterStatusViewed).toBe(true);
      expect(state.currentStepId).not.toBe('wolfRobotLearn');

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

      // Step 2: wolfRobot learns hunter
      submitActionOrThrow(
        ctx,
        WOLF_ROBOT_SEAT,
        { kind: 'target', target: HUNTER_SEAT },
        'wolfRobot learn hunter',
      );

      // Verify learn result and gate state
      let state = ctx.getGameState();
      expect(state.wolfRobotReveal?.learnedRoleId).toBe('hunter');
      expect(state.wolfRobotContext?.disguisedRole).toBe('hunter');
      expect(state.wolfRobotHunterStatusViewed).toBe(false);

      // Step 3: commit both public ACKs; the second ACK advances inline
      const revealAckResult = ctx.dispatchAsSeat(WOLF_ROBOT_SEAT, {
        type: 'werewolf.reveal.ack',
      });
      expect(revealAckResult).toMatchObject({
        kind: 'committed',
        outcome: { kind: 'success' },
      });
      const hunterStatusAckResult = ctx.dispatchAsSeat(WOLF_ROBOT_SEAT, {
        type: 'werewolf.wolfRobot.ackHunterStatus',
      });
      expect(hunterStatusAckResult).toMatchObject({
        kind: 'committed',
        outcome: { kind: 'success' },
      });

      state = ctx.getGameState();
      expect(state.wolfRobotHunterStatusViewed).toBe(true);
      expect(state.currentStepId).not.toBe('wolfRobotLearn');

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

      // wolfRobot learns villager (seat 0)
      submitActionOrThrow(
        ctx,
        WOLF_ROBOT_SEAT,
        { kind: 'target', target: 0 },
        'wolfRobot learn villager',
      );

      const state = ctx.getGameState();

      // Learned villager, not hunter
      expect(state.wolfRobotReveal?.learnedRoleId).toBe('villager');

      // Should not trigger hunter gate (wolfRobotHunterStatusViewed should be absent or not false)
      expect(state.wolfRobotHunterStatusViewed).not.toBe(false);

      // Reveal ACK releases production inline progression without a hunter-status ACK
      const revealAckResult = ctx.dispatchAsSeat(WOLF_ROBOT_SEAT, {
        type: 'werewolf.reveal.ack',
      });
      expect(revealAckResult).toMatchObject({
        kind: 'committed',
        outcome: { kind: 'success' },
      });
      expect(ctx.getGameState().currentStepId).not.toBe('wolfRobotLearn');
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

      // wolfRobot skips learning; the action advances inline because it creates no reveal ACK
      submitActionOrThrow(ctx, WOLF_ROBOT_SEAT, { kind: 'skip' }, 'wolfRobot skip');

      const state = ctx.getGameState();

      // Did not learn; wolfRobotReveal should not have learnedRoleId
      expect(state.wolfRobotReveal?.learnedRoleId).toBeUndefined();

      // Should not trigger hunter gate
      expect(state.wolfRobotHunterStatusViewed).not.toBe(false);

      expect(state.currentStepId).not.toBe('wolfRobotLearn');
    });
  });
});
