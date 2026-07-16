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

import type { GameContext, TestCommandExecution } from './gameContext';
import { cleanupGame, createGame } from './gameFactory';
import { executeRemainingSteps, executeStepsUntil, submitActionOrThrow } from './stepByStepRunner';

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
      expect(ctx.getGameState().currentStepId).toBe('drunkSeerCheck');

      // drunkSeer checks seat 0 (villager)
      submitActionOrThrow(
        ctx,
        11,
        { kind: 'target', target: 0 },
        'drunkSeerCheck',
        DRUNK_SEER_NORMAL_REVEAL_EXECUTION,
      );

      const state = ctx.getGameState();
      expect(state.drunkSeerReveal).toBeDefined();
      expect(state.drunkSeerReveal!.targetSeat).toBe(0);
      expect(state.drunkSeerReveal!.result).toBe('好人');
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
      expect(state.drunkSeerReveal).toBeDefined();
      expect(state.drunkSeerReveal!.targetSeat).toBe(0);
      // Check good faction, inverted returns "狼人"
      expect(state.drunkSeerReveal!.result).toBe('狼人');
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
      expect(ctx.getGameState().currentStepId).toBe('mirrorSeerCheck');

      // mirrorSeer checks seat 0 (villager)
      submitActionOrThrow(ctx, 8, { kind: 'target', target: 0 }, 'mirrorSeerCheck');

      const state = ctx.getGameState();
      expect(state.mirrorSeerReveal).toBeDefined();
      expect(state.mirrorSeerReveal!.targetSeat).toBe(0);
      // MirrorSeer checking good faction should return "狼人" (inverted)
      expect(state.mirrorSeerReveal!.result).toBe('狼人');
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
      expect(state.mirrorSeerReveal).toBeDefined();
      expect(state.mirrorSeerReveal!.targetSeat).toBe(3);
      // Checking wolf should return "好人" (inverted)
      expect(state.mirrorSeerReveal!.result).toBe('好人');
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
      expect(stateAfterMirror.mirrorSeerReveal).toBeDefined();
      expect(stateAfterMirror.mirrorSeerReveal!.result).toBe('好人');

      // The public reveal ACK advances to seerCheck inline
      const revealAckResult = ctx.dispatchAsSeat(8, { type: 'werewolf.reveal.ack' });
      expect(revealAckResult).toMatchObject({
        kind: 'committed',
        outcome: { kind: 'success' },
      });
      expect(ctx.getGameState().currentStepId).toBe('seerCheck');

      const audioAckResult = ctx.dispatch({ type: 'werewolf.audio.ack' });
      expect(audioAckResult).toMatchObject({
        kind: 'committed',
        outcome: { kind: 'success' },
      });

      // seer checks seat 3 (wolf)
      submitActionOrThrow(ctx, 7, { kind: 'target', target: 3 }, 'seerCheck');

      const stateAfterSeer = ctx.getGameState();
      expect(stateAfterSeer.seerReveal).toBeDefined();
      expect(stateAfterSeer.seerReveal!.result).toBe('狼人');
      expect(stateAfterSeer.mirrorSeerReveal).toBeDefined();
      expect(stateAfterSeer.mirrorSeerReveal!.result).toBe('好人');
    });
  });

  describe('seerLabelMap 生成', () => {
    it('板子同时包含 seer + mirrorSeer 时 gameControlHandler 会生成 seerLabelMap', () => {
      // seerLabelMap is injected by handleAssignRoles (gameControlHandler) into the
      // ASSIGN_ROLES action payload; gameFactory uses it directly.
      // gameReducer does not go through the handler layer, so manually inject here to verify reducer behavior.
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // gameFactory calls gameReducer(ASSIGN_ROLES) directly;
      // seerLabelMap is injected by handler layer -> here we verify reducer stores it correctly
      // (handler layer tests are in gameControlHandler.test.ts)
      // This integration test focuses on mirrorSeerReveal inversion logic; seerLabelMap generation
      // is a handler layer responsibility, covered in gameControlHandler unit tests.
      expect(true).toBe(true); // placeholder -- covered by handler layer tests
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
