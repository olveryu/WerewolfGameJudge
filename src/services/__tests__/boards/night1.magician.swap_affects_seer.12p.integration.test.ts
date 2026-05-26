/**
 * Night-1 Integration Test: Magician Swap affects Seer Reveal
 *
 * Theme: after Magician swaps identities, the Seer's reveal should be based on the swapped identity.
 *
 * Template: 狼王魔术师
 * Fixed seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-6: wolf
 *   seat 7: darkWolfKing
 *   seat 8: seer
 *   seat 9: witch
 *   seat 10: hunter
 *   seat 11: magician
 *
 * Architecture: intents -> handlers -> reducer -> GameState
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';

import { cleanupGame, createGame, type GameContext } from './gameFactory';
import { executeFullNight } from './stepByStepRunner';

const TEMPLATE_NAME = '狼王魔术师';

/**
 * Fixed seat-role assignment (readable, reproducible)
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
  map.set(7, 'darkWolfKing');
  map.set(8, 'seer');
  map.set(9, 'witch');
  map.set(10, 'hunter');
  map.set(11, 'magician');
  return map;
}

describe('Night-1: Magician Swap affects Seer Reveal (12p)', () => {
  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  describe('Swap 后 Seer 查验应返回交换后身份', () => {
    it('魔术师交换 villager(0) 与 wolf(4)，seer 查 seat 0 应返回"狼人"', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // magician swaps seat 0 (villager) with seat 4 (wolf)
      // After swap: seat 0 = wolf identity, seat 4 = villager identity
      const result = executeFullNight(ctx, {
        magician: { targets: [0, 4] },
        wolf: 1, // attack seat 1
        witch: { save: null, poison: null },
        seer: 0, // seer checks seat 0 (wolf identity after swap)
      });

      expect(result.completed).toBe(true);

      // Core assertion: seerReveal should show seat 0 as "狼人" (wolf identity after swap)
      const state = ctx.getGameState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(0);
      expect(['wolf', '狼人']).toContain(state.seerReveal!.result);

      // swappedSeats recorded in currentNightResults
      expect(state.currentNightResults?.swappedSeats).toEqual([0, 4]);
    });

    it('魔术师交换 villager(0) 与 wolf(4)，seer 查 seat 4 应返回"好人"', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // After swap: seat 4 = villager identity
      const result = executeFullNight(ctx, {
        magician: { targets: [0, 4] },
        wolf: 1,
        witch: { save: null, poison: null },
        seer: 4, // seer checks seat 4 (villager identity after swap)
      });

      expect(result.completed).toBe(true);

      // Core assertion: seerReveal should show seat 4 as "好人"
      const state = ctx.getGameState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(4);
      expect(['good', '好人']).toContain(state.seerReveal!.result);
    });

    it('魔术师不交换时，seer 查 wolf seat 应返回"狼人"', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // No swap: seat 4 is still wolf
      const result = executeFullNight(ctx, {
        magician: null, // no swap
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 4, // seer checks seat 4 (original wolf)
      });

      expect(result.completed).toBe(true);

      const state = ctx.getGameState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(4);
      expect(['wolf', '狼人']).toContain(state.seerReveal!.result);

      // No swap
      expect(state.currentNightResults?.swappedSeats).toBeUndefined();
    });
  });

  describe('Swap exchanges death fate (core rule)', () => {
    it('after swap, attacking seat 0 kills seat 4 (death fate exchanged)', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // Swap seat 0 with seat 4
      // Attack seat 0
      // Per rule: Magician swaps death fate, so seat 4 dies
      const result = executeFullNight(ctx, {
        magician: { targets: [0, 4] },
        wolf: 0, // attack seat 0
        witch: { save: null, poison: null },
        seer: 1,
      });

      expect(result.completed).toBe(true);

      // Core assertion: swap exchanges death fate, seat 0's death transfers to seat 4
      expect(result.deaths).toEqual([4]);
    });

    it('after swap, witch poisons seat 4, seat 0 dies due to swap rule', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        magician: { targets: [0, 4] },
        wolf: null, // skip attack
        witch: { save: null, poison: 4 }, // poison seat 4
        seer: 1,
      });

      expect(result.completed).toBe(true);

      // Core assertion: seat 4's death transfers to seat 0
      expect(result.deaths).toEqual([0]);
    });

    it('when both swap targets are killed, no swap (both die)', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // Attack seat 0, witch poisons seat 4
      const result = executeFullNight(ctx, {
        magician: { targets: [0, 4] },
        wolf: 0, // attack seat 0
        witch: { save: null, poison: 4 }, // poison seat 4
        seer: 1,
      });

      expect(result.completed).toBe(true);

      // Core assertion: both die, no swap
      const sortedDeaths = [...result.deaths].sort((a, b) => a - b);
      expect(sortedDeaths).toEqual([0, 4]);
    });
  });

  describe('Swap targets written to GameState', () => {
    it('swappedSeats should correctly record the two swapped seats', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        magician: { targets: [2, 7] }, // swap villager(2) with darkWolfKing(7)
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 2, // check seat 2 (darkWolfKing identity after swap)
      });

      expect(result.completed).toBe(true);

      // swappedSeats written to currentNightResults
      const state = ctx.getGameState();
      expect(state.currentNightResults?.swappedSeats).toEqual([2, 7]);

      // seer checking seat 2 should return "狼人" (darkWolfKing is wolf faction)
      expect(state.seerReveal).toBeDefined();
      expect(['wolf', '狼人']).toContain(state.seerReveal!.result);
    });
  });
});
