/**
 * Night-1 Integration Test: WolfRobot Disguise - Seer Reveal
 *
 * Topic: WolfRobot learns and disguises identity; Seer check returns the disguised faction.
 *
 * Custom template (12 players, includes wolfRobot + seer + magician)
 * Fixed seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-6: wolf
 *   seat 7: wolfRobot
 *   seat 8: seer
 *   seat 9: witch
 *   seat 10: magician
 *   seat 11: guard
 *
 * Core rules (wolfRobot disguise contract — Seer perspective):
 * - After wolfRobot learns a good-faction role, Seer checking wolfRobot returns "好人"
 * - After wolfRobot learns a wolf-faction role, Seer checking wolfRobot returns "狼人"
 * - When not learned, Seer check returns "狼人" (wolfRobot itself is wolf faction)
 * - After magician swap, Seer check still follows resolveRoleForChecks logic
 *
 * Architecture: intents → handlers → resolver(resolveRoleForChecks) → GameState
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';

import { cleanupGame, createGame, type GameContext } from './gameFactory';
import { executeFullNight } from './stepByStepRunner';

/**
 * Custom role list (includes wolfRobot + seer + magician)
 */
const CUSTOM_ROLES: RoleId[] = [
  'villager',
  'villager',
  'villager',
  'villager',
  'wolf',
  'wolf',
  'wolf',
  'wolfRobot',
  'seer',
  'witch',
  'magician',
  'guard',
];

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
  map.set(7, 'wolfRobot');
  map.set(8, 'seer');
  map.set(9, 'witch');
  map.set(10, 'magician');
  map.set(11, 'guard');
  return map;
}

describe('Night-1: WolfRobot Disguise - Seer Reveal (12p)', () => {
  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  it('wolfRobot 学习 villager，seer 查验 wolfRobot 显示 "好人"', () => {
    ctx = createGame(CUSTOM_ROLES, createRoleAssignment());

    const result = executeFullNight(ctx, {
      wolfRobot: 0, // Learn villager (good faction)
      magician: { targets: [] },
      guard: null,
      wolf: 1,
      witch: { save: null, poison: null },
      seer: 7, // Check the seat where wolfRobot sits
    });

    expect(result.completed).toBe(true);

    const state = ctx.getGameState();
    // wolfRobotContext written
    expect(state.wolfRobotContext).toBeDefined();
    expect(state.wolfRobotContext!.learnedSeat).toBe(0);
    expect(state.wolfRobotContext!.disguisedRole).toBe('villager');

    // seerReveal shows "好人" (disguised as villager = good faction)
    expect(state.seerReveal!.targetSeat).toBe(7);
    expect(state.seerReveal!.result).toBe('好人');
  });

  it('wolfRobot 学习 wolf，seer 查验 wolfRobot 显示 "狼人"', () => {
    ctx = createGame(CUSTOM_ROLES, createRoleAssignment());

    const result = executeFullNight(ctx, {
      wolfRobot: 4, // Learn wolf (wolf faction)
      magician: { targets: [] },
      guard: null,
      wolf: 1,
      witch: { save: null, poison: null },
      seer: 7, // Check wolfRobot
    });

    expect(result.completed).toBe(true);

    const state = ctx.getGameState();
    expect(state.wolfRobotContext!.disguisedRole).toBe('wolf');
    expect(state.seerReveal!.result).toBe('狼人');
  });

  it('wolfRobot 空选，seer 查验 wolfRobot 显示 "狼人"（本体）', () => {
    ctx = createGame(CUSTOM_ROLES, createRoleAssignment());

    const result = executeFullNight(ctx, {
      wolfRobot: null, // Do not learn
      magician: { targets: [] },
      guard: null,
      wolf: 1,
      witch: { save: null, poison: null },
      seer: 7, // Check wolfRobot
    });

    expect(result.completed).toBe(true);

    const state = ctx.getGameState();
    // wolfRobotContext not written
    expect(state.wolfRobotContext).toBeUndefined();
    // seerReveal shows "狼人" (wolfRobot itself is wolf faction)
    expect(state.seerReveal!.result).toBe('狼人');
  });

  describe('swap + disguise 边界', () => {
    it('magician swap wolfRobot<->villager，wolfRobot 学习后，seer 查验 villager 原 seat 显示伪装阵营', () => {
      ctx = createGame(CUSTOM_ROLES, createRoleAssignment());

      // magician swaps wolfRobot(7) with villager(0)
      // After swap: seat 7 is villager, seat 0 is wolfRobot
      // wolfRobot learns witch(9) = good faction
      // Seer checks seat 0 (now wolfRobot), should show "好人"
      const result = executeFullNight(ctx, {
        wolfRobot: 9, // Learn witch (good faction)
        magician: { targets: [7, 0] }, // swap wolfRobot <-> villager
        guard: null,
        wolf: 1,
        witch: { save: null, poison: null },
        seer: 0, // Check seat 0 (wolfRobot after swap)
      });

      expect(result.completed).toBe(true);

      const state = ctx.getGameState();
      // wolfRobotContext written (learned witch)
      expect(state.wolfRobotContext!.disguisedRole).toBe('witch');

      // Seer checks seat 0 (wolfRobot after swap), shows "好人"
      expect(state.seerReveal!.targetSeat).toBe(0);
      expect(state.seerReveal!.result).toBe('好人');
    });

    it('magician swap wolfRobot<->wolf，seer 查验 wolfRobot 原 seat 显示 "狼人"（swap 后是 wolf）', () => {
      ctx = createGame(CUSTOM_ROLES, createRoleAssignment());

      // magician swaps wolfRobot(7) with wolf(4)
      // After swap: seat 7 is wolf, seat 4 is wolfRobot
      // wolfRobot learns villager(0) = good faction
      // Seer checks seat 7 (now wolf), should show "狼人"
      const result = executeFullNight(ctx, {
        wolfRobot: 0, // Learn villager
        magician: { targets: [7, 4] }, // swap wolfRobot <-> wolf
        guard: null,
        wolf: 1,
        witch: { save: null, poison: null },
        seer: 7, // Check seat 7 (wolf after swap)
      });

      expect(result.completed).toBe(true);

      const state = ctx.getGameState();
      // Seer checks seat 7 (wolf after swap), shows "狼人"
      expect(state.seerReveal!.targetSeat).toBe(7);
      expect(state.seerReveal!.result).toBe('狼人');
    });
  });
});
