/**
 * Night-1 Integration Test: MirrorSeer / DrunkSeer Reveal
 *
 * Board: Mirror Seer (seer variant family)
 * Topics:
 *   - MirrorSeer check result writes to GameState.mirrorSeerReveal (inverted)
 *   - DrunkSeer check result writes to GameState.drunkSeerReveal (random)
 *
 * MirrorSeer fixed seat-role assignment:
 *   seat 0-2: villager
 *   seat 3-5: wolf
 *   seat 6: darkWolfKing
 *   seat 7: seer
 *   seat 8: mirrorSeer
 *   seat 9: witch
 *   seat 10: guard
 *   seat 11: knight
 *
 * DrunkSeer additional seat-role assignment (knight -> drunkSeer) below.
 *
 * Architecture: intents -> handlers -> reducer -> GameState
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { STEP_RESULT_ACK_ACTION_KEY } from '@game-judge/game-engine/platform/steps';

import type { GameContext, TestCommandExecution } from './gameContext';
import { cleanupGame, createGame } from './gameFactory';
import {
  executeRemainingSteps,
  executeStepsUntil,
  submitActionOrThrow,
  submitStep,
} from './stepByStepRunner';

const TEMPLATE_NAME = '灯影预言家';

/**
 * Fixed seat-role assignment
 */
function createRoleAssignment(): Map<number, RoleId> {
  const map = new Map<number, RoleId>();
  map.set(0, 'villager');
  map.set(1, 'villager');
  map.set(2, 'villager');
  map.set(3, 'wolf');
  map.set(4, 'wolf');
  map.set(5, 'wolf');
  map.set(6, 'darkWolfKing');
  map.set(7, 'seer');
  map.set(8, 'mirrorSeer');
  map.set(9, 'witch');
  map.set(10, 'guard');
  map.set(11, 'knight');
  return map;
}

/**
 * DrunkSeer seat-role assignment (reuses MirrorSeer board, knight -> drunkSeer)
 *
 *   seat 0-2: villager
 *   seat 3-5: wolf
 *   seat 6: darkWolfKing
 *   seat 7: seer
 *   seat 8: mirrorSeer
 *   seat 9: witch
 *   seat 10: guard
 *   seat 11: drunkSeer
 */
function createDrunkSeerRoleAssignment(): Map<number, RoleId> {
  const map = new Map<number, RoleId>();
  map.set(0, 'villager');
  map.set(1, 'villager');
  map.set(2, 'villager');
  map.set(3, 'wolf');
  map.set(4, 'wolf');
  map.set(5, 'wolf');
  map.set(6, 'darkWolfKing');
  map.set(7, 'seer');
  map.set(8, 'mirrorSeer');
  map.set(9, 'witch');
  map.set(10, 'guard');
  map.set(11, 'drunkSeer');
  return map;
}

const DRUNK_SEER_ROLES: RoleId[] = [
  'villager',
  'villager',
  'villager',
  'wolf',
  'wolf',
  'wolf',
  'darkWolfKing',
  'seer',
  'mirrorSeer',
  'witch',
  'guard',
  'drunkSeer',
];

const DRUNK_SEER_NORMAL_REVEAL_EXECUTION: TestCommandExecution = { randomSeed: 'seed-1' };
const DRUNK_SEER_INVERTED_REVEAL_EXECUTION: TestCommandExecution = { randomSeed: 'seed-2' };

describe('Night-1: 灯影预言家 - DrunkSeer Random Reveal (12p)', () => {
  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  describe('drunkSeerReveal 随机查验写入', () => {
    it('drunkSeer 查验 villager(0)，server seed 对应值 >=0.5 时 result 为 "好人"', () => {
      ctx = createGame(DRUNK_SEER_ROLES, createDrunkSeerRoleAssignment());

      // Advance to drunkSeerCheck step
      const reached = executeStepsUntil(ctx, 'drunkSeerCheck', {
        wolf: 1,
        seer: null,
        mirrorSeer: null,
      });
      expect(reached).toBe(true);
      expect(ctx.getGameState().nightStep).toEqual({ kind: 'inStep', stepId: 'drunkSeerCheck' });

      // drunkSeer checks seat 0 (villager)
      submitActionOrThrow(
        ctx,
        11,
        { kind: 'target', target: 0 },
        'drunkSeerCheck',
        DRUNK_SEER_NORMAL_REVEAL_EXECUTION,
      );

      const state = ctx.getGameState();
      expect(state.nightState?.slice.records.drunkSeerCheck?.bySeat[11]?.result).toEqual({
        kind: 'factionCheck',
        chosenSeat: 0,
        landingSeat: 0,
        faction: 'good',
      });
    });

    it('drunkSeer 查验 villager(0)，server seed 对应值 <0.5 时 result 为 "狼人"', () => {
      ctx = createGame(DRUNK_SEER_ROLES, createDrunkSeerRoleAssignment());

      const reached = executeStepsUntil(ctx, 'drunkSeerCheck', {
        wolf: 1,
        seer: null,
        mirrorSeer: null,
      });
      expect(reached).toBe(true);

      submitActionOrThrow(
        ctx,
        11,
        { kind: 'target', target: 0 },
        'drunkSeerCheck',
        DRUNK_SEER_INVERTED_REVEAL_EXECUTION,
      );

      const state = ctx.getGameState();
      expect(state.nightState?.slice.records.drunkSeerCheck?.bySeat[11]?.result).toEqual({
        kind: 'factionCheck',
        chosenSeat: 0,
        landingSeat: 0,
        faction: 'wolf',
      });
    });
  });

  describe('完整夜晚流程（含 drunkSeer）', () => {
    it('drunkSeer 板子可以跑完完整夜晚', () => {
      ctx = createGame(DRUNK_SEER_ROLES, createDrunkSeerRoleAssignment());

      const result = executeRemainingSteps(ctx, {
        wolf: 1,
        seer: 0,
        mirrorSeer: 0,
        drunkSeer: 0,
        witch: { save: null, poison: null },
        guard: 0,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toBeDefined();
    });
  });
});

describe('Night-1: 灯影预言家 - MirrorSeer Inverted Reveal (12p)', () => {
  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  describe('mirrorSeerReveal 反转查验写入', () => {
    it('mirrorSeer 查验 villager(0)，mirrorSeerReveal.result 为 "狼人"（反转）', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // Advance to mirrorSeerCheck step
      const reached = executeStepsUntil(ctx, 'mirrorSeerCheck', {
        wolf: 1,
        seer: null,
      });
      expect(reached).toBe(true);
      expect(ctx.getGameState().nightStep).toEqual({ kind: 'inStep', stepId: 'mirrorSeerCheck' });

      // mirrorSeer checks seat 0 (villager)
      submitActionOrThrow(ctx, 8, { kind: 'target', target: 0 }, 'mirrorSeerCheck');

      const state = ctx.getGameState();
      expect(state.nightState?.slice.records.mirrorSeerCheck?.bySeat[8]?.result).toEqual({
        kind: 'factionCheck',
        chosenSeat: 0,
        landingSeat: 0,
        faction: 'wolf',
      });
    });

    it('mirrorSeer 查验 wolf(3)，mirrorSeerReveal.result 为 "好人"（反转）', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const reached = executeStepsUntil(ctx, 'mirrorSeerCheck', {
        wolf: 1,
        seer: null,
      });
      expect(reached).toBe(true);

      // mirrorSeer checks seat 3 (wolf)
      submitActionOrThrow(ctx, 8, { kind: 'target', target: 3 }, 'mirrorSeerCheck');

      const state = ctx.getGameState();
      expect(state.nightState?.slice.records.mirrorSeerCheck?.bySeat[8]?.result).toEqual({
        kind: 'factionCheck',
        chosenSeat: 3,
        landingSeat: 3,
        faction: 'good',
      });
    });
  });

  describe('seerReveal + mirrorSeerReveal 共存', () => {
    it('seer 和 mirrorSeer 各自写入独立 reveal', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // Follow the production seerLabelMap order: mirrorSeerCheck precedes seerCheck for this seed
      const reachedMirror = executeStepsUntil(ctx, 'mirrorSeerCheck', {
        wolf: 1,
      });
      expect(reachedMirror).toBe(true);

      // mirrorSeer checks seat 3 (wolf) -> returns "好人" (inverted)
      submitActionOrThrow(ctx, 8, { kind: 'target', target: 3 }, 'mirrorSeerCheck');

      const stateAfterMirror = ctx.getGameState();
      expect(stateAfterMirror.nightState?.slice.records.mirrorSeerCheck?.bySeat[8]?.result).toEqual(
        {
          kind: 'factionCheck',
          chosenSeat: 3,
          landingSeat: 3,
          faction: 'good',
        },
      );
      submitStep(
        ctx,
        8,
        { actionKey: STEP_RESULT_ACK_ACTION_KEY },
        'acknowledge mirror seer result',
      );
      expect(executeStepsUntil(ctx, 'seerCheck')).toBe(true);

      // seer checks seat 3 (wolf)
      submitActionOrThrow(ctx, 7, { kind: 'target', target: 3 }, 'seerCheck');

      const stateAfterSeer = ctx.getGameState();
      expect(stateAfterSeer.nightState?.slice.records.seerCheck?.bySeat[7]?.result).toEqual({
        kind: 'factionCheck',
        chosenSeat: 3,
        landingSeat: 3,
        faction: 'wolf',
      });
      expect(stateAfterSeer.nightState?.slice.records.mirrorSeerCheck?.bySeat[8]?.result).toEqual({
        kind: 'factionCheck',
        chosenSeat: 3,
        landingSeat: 3,
        faction: 'good',
      });
    });
  });

  describe('完整夜晚流程', () => {
    it('mirrorSeer 板子可以跑完完整夜晚', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeRemainingSteps(ctx, {
        wolf: 1,
        seer: 0,
        mirrorSeer: 0,
        witch: { save: null, poison: null },
        guard: 0,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toBeDefined();
    });
  });
});
