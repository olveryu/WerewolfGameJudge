/**
 * Night-1 Integration Test: Wolf Girl Confess
 *
 * Topic: Wolf Girl sees wolf teammates during the confess step, then must
 * confess to one non-wolf-team player; the confession is revealed last.
 *
 * Template: 狼女孩 (Special)
 * Fixed seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-6: wolf
 *   seat 7: wolfGirl
 *   seat 8: seer
 *   seat 9: poisoner
 *   seat 10: hunter
 *   seat 11: guard
 *
 * Core rules:
 * - wolfGirlConfess: chooseSeat (NotSelf, NotWolfFaction), canSkip: false,
 *   runs before wolfKill; during this step the Wolf Girl viewer sees the
 *   wolf pack on the seat board (pinned in visibility.test.ts)
 * - confession written only to wolfGirlConfessedSeat; the target's role
 *   is never rewritten, so a confessed civilian still checks as good
 * - wolfKill: 4 voters (3 wolves + Wolf Girl), majority vote; poisoner
 *   present -> wolfKillOverride (no Night-1 wolf kill, empty votes only)
 * - wolfGirlConfessReveal: groupConfirm, last step of the night
 *
 * Architecture: intents → handlers → reducer → GameState
 */

import { getWerewolfViewModel, type RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { REASON_STEP_STALE, STEP_SKIP_ACTION_KEY } from '@game-judge/game-engine/platform/steps';

import type { GameContext } from './gameContext';
import { cleanupGame, createGame } from './gameFactory';
import {
  dispatchStep,
  executeFullNight,
  executeRemainingSteps,
  executeStepsUntil,
  submitStep,
} from './stepByStepRunner';

const TEMPLATE_NAME = '狼女孩';

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
  map.set(6, 'wolf');
  map.set(7, 'wolfGirl');
  map.set(8, 'seer');
  map.set(9, 'poisoner');
  map.set(10, 'hunter');
  map.set(11, 'guard');
  return map;
}

describe('Night-1: Wolf Girl Confess (12p)', () => {
  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  describe('狼女孩表白平民', () => {
    it('表白座位 0，步骤顺序在狼刀前、揭示在最后；查验仍为好人', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // Confess, then the wolf meeting; the reveal is the last step.
      expect(executeStepsUntil(ctx, 'wolfGirlConfess', {})).toBe(true);
      ctx.assertStep('wolfGirlConfess');
      expect(executeStepsUntil(ctx, 'wolfKill', { wolfGirl: 0 })).toBe(true);
      ctx.assertStep('wolfKill');
      const wolfStep = getWerewolfViewModel(ctx.getGameState(), { seat: 4, isHost: false }).step;
      expect(wolfStep?.actions.find((action) => action.key === 'wolfKill')?.availability).toEqual({
        kind: 'unavailable',
        reason: '本局有毒师在场，首夜无法袭击',
      });

      // The confession reveal is the last step of the night plan.
      const plan = ctx.getNightPlan();
      expect(plan.steps[plan.steps.length - 1]?.stepId).toBe('wolfGirlConfessReveal');

      const result = executeRemainingSteps(ctx, {
        wolfGirl: 0,
        poisoner: null,
        hunter: { confirmed: true },
        seer: 0,
        guard: 8,
      });
      expect(result.completed).toBe(true);

      const state = ctx.getGameState();
      // Confession record only; the target's role is untouched.
      expect(state.nightState?.facts.wolfGirlConfessions).toEqual([
        { actorSeat: 7, targetSeat: 0 },
      ]);
      expect(state.players[0]?.role).toBe('villager');
      // No wolf kill on this board: poisoner override, no deaths. The
      // wolf vote is the 4 voters (3 wolves + Wolf Girl) all empty; the
      // confessed civilian is not a voter.
      expect(result.deaths).toEqual([]);
      expect(state.nightState?.facts.wolfVotes).toEqual(
        [4, 5, 6, 7].map((actorSeat) => ({ actorSeat, chosenSeat: null, landingSeat: null })),
      );
      // The confessed civilian still checks as good.
      expect(state.nightState?.slice.records.seerCheck?.bySeat[8]?.result).toEqual({
        kind: 'factionCheck',
        chosenSeat: 0,
        landingSeat: 0,
        faction: 'good',
      });
      // Every player acknowledged the final confession reveal.
      expect(
        Object.keys(state.nightState?.slice.records.wolfGirlConfessReveal?.bySeat ?? {}).map(
          Number,
        ),
      ).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    });
  });

  describe('狼女孩表白神牌', () => {
    it('表白守卫座位 11，记录照常写入，守卫身份不变', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        wolfGirl: 11,
        poisoner: null,
        hunter: { confirmed: true },
        seer: 4,
        guard: 8,
      });
      expect(result.completed).toBe(true);

      const state = ctx.getGameState();
      expect(state.nightState?.facts.wolfGirlConfessions).toEqual([
        { actorSeat: 7, targetSeat: 11 },
      ]);
      expect(state.players[11]?.role).toBe('guard');
    });
  });

  describe('狼女孩表白约束校验', () => {
    it('表白狼队玩家应被拒绝 (NotWolfFaction constraint)', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      expect(executeStepsUntil(ctx, 'wolfGirlConfess')).toBe(true);
      ctx.assertStep('wolfGirlConfess');

      const result = dispatchStep(ctx, 7, { actionKey: 'wolfGirlConfess', seats: [4] });
      expect(result).toMatchObject({ kind: 'rejected', reason: REASON_STEP_STALE });
    });

    it('表白自己应被拒绝 (NotSelf constraint)', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      expect(executeStepsUntil(ctx, 'wolfGirlConfess')).toBe(true);
      ctx.assertStep('wolfGirlConfess');

      const result = dispatchStep(ctx, 7, { actionKey: 'wolfGirlConfess', seats: [7] });
      expect(result).toMatchObject({ kind: 'rejected', reason: REASON_STEP_STALE });
    });

    it('不选择目标应被拒绝 (canSkip: false)', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      expect(executeStepsUntil(ctx, 'wolfGirlConfess')).toBe(true);
      ctx.assertStep('wolfGirlConfess');

      const result = dispatchStep(ctx, 7, { actionKey: STEP_SKIP_ACTION_KEY });
      expect(result).toMatchObject({ kind: 'rejected', reason: REASON_STEP_STALE });
    });
  });

  describe('wolfGirlConfessReveal 步骤', () => {
    it('groupConfirm 步骤在最后正常推进，全员确认后首夜结束', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      expect(
        executeStepsUntil(ctx, 'wolfGirlConfessReveal', {
          wolfGirl: 0,
          poisoner: null,
          hunter: { confirmed: true },
          seer: 4,
          guard: 8,
        }),
      ).toBe(true);
      ctx.assertStep('wolfGirlConfessReveal');

      for (const player of Object.values(ctx.getGameState().players)) {
        if (player === null) continue;
        submitStep(
          ctx,
          player.seat,
          { actionKey: 'wolfGirlConfessReveal' },
          `acknowledge confession reveal at seat ${player.seat}`,
        );
      }

      const result = executeRemainingSteps(ctx);
      expect(result.completed).toBe(true);
      expect(ctx.getGameState().nightState?.facts.wolfGirlConfessions).toEqual([
        { actorSeat: 7, targetSeat: 0 },
      ]);
    });
  });
});
