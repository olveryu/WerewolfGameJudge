/**
 * Night-1 Integration Test: Thief + Cupid (Thief & Cupid)
 *
 * Theme: Thief picks identity from 2 deck cards, Cupid links lovers; verifies card selection, lover linking, full-night flow.
 *
 * Template: 14 roles = 12 players + 2 deck cards
 *   Seer + Witch + Hunter + Idiot + Wolf x3 + Villager x5 + Thief + Cupid
 *
 * Architecture: intents -> handlers -> reducer -> WerewolfState
 */

import type { RoleId } from '@werewolf/game-engine/werewolf/models/roles';

import { cleanupGame, createGame, type GameContext } from './gameFactory';
import { executeFullNight, executeStepsUntil } from './stepByStepRunner';

// =============================================================================
// Template: 14 roles (12 players + 2 deck cards)
// =============================================================================

const TEMPLATE_NAME = '盗贼丘比特';

const TEMPLATE_ROLES: RoleId[] = [
  'villager',
  'villager',
  'villager',
  'villager',
  'villager',
  'wolf',
  'wolf',
  'wolf',
  'seer',
  'witch',
  'hunter',
  'idiot',
  'thief',
  'cupid',
] as RoleId[];

// =============================================================================
// Test: Thief picks deck card + Cupid links lovers
// =============================================================================

describe(`Night-1: ${TEMPLATE_NAME} — 盗贼选底牌 + 丘比特连线`, () => {
  /**
   * Fixed seat-role assignment (12 players):
   *   seat 0-3: villager x4
   *   seat 4-6: wolf x3
   *   seat 7: seer
   *   seat 8: witch
   *   seat 9: hunter
   *   seat 10: thief
   *   seat 11: cupid
   *
   * Deck cards: villager, idiot
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
    map.set(7, 'seer');
    map.set(8, 'witch');
    map.set(9, 'hunter');
    map.set(10, 'thief');
    map.set(11, 'cupid');
    return map;
  }

  const BOTTOM_CARDS: RoleId[] = ['villager', 'idiot'];

  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  it('盗贼选 idiot（cardIndex=1），丘比特连线 seat 0 和 1，全夜完成', () => {
    ctx = createGame(TEMPLATE_ROLES, createRoleAssignment(), {
      bottomCards: BOTTOM_CARDS,
    });

    // Verify initial state
    const initState = ctx.getGameState();
    expect(initState.bottomCards).toEqual(BOTTOM_CARDS);
    expect(initState.thiefSeat).toBe(10);

    // First step = thiefChoose
    ctx.assertStep('thiefChoose');

    // Run to cupidChooseLovers to verify step progression
    executeStepsUntil(ctx, 'cupidChooseLovers', {
      thief: { cardIndex: 1 },
    });
    ctx.assertStep('cupidChooseLovers');

    // Continue to cupidLoversReveal
    executeStepsUntil(ctx, 'cupidLoversReveal', {
      cupid: { targets: [0, 1] },
    });
    ctx.assertStep('cupidLoversReveal');

    // Execute remaining night
    const result = executeFullNight(ctx, {
      wolf: 7, // Attack seer (seat 7)
      witch: { save: 7, poison: null }, // Witch saves
      seer: 0, // Check seat 0
      hunter: { confirmed: true },
    });

    expect(result.completed).toBe(true);

    const state = ctx.getGameState();

    // Core assertion: Thief card selection result
    expect(state.thiefChosenCard).toBe('idiot');

    // Core assertion: Cupid lover linking result
    expect(state.loverSeats).toEqual([0, 1]);

    // Seer normal check
    expect(state.seerReveal).toBeDefined();
    expect(state.seerReveal!.targetSeat).toBe(0);

    // wolf -> seer saved by witch -> peaceful night
    expect(result.deaths).toEqual([]);
  });

  it('盗贼选 villager（cardIndex=0），丘比特连线 seat 7 和 10（异阵营），全夜完成', () => {
    ctx = createGame(TEMPLATE_ROLES, createRoleAssignment(), {
      bottomCards: BOTTOM_CARDS,
    });

    const result = executeFullNight(ctx, {
      thief: { cardIndex: 0 }, // Pick villager (index 0)
      cupid: { targets: [7, 10] }, // Link seer and thief
      wolf: 0, // Attack villager (seat 0)
      witch: null, // Witch does not save
      seer: 4, // Check seat 4 (wolf)
      hunter: { confirmed: true },
    });

    expect(result.completed).toBe(true);

    const state = ctx.getGameState();

    // Thief picked villager
    expect(state.thiefChosenCard).toBe('villager');

    // Cupid links seer and thief
    expect(state.loverSeats).toEqual([7, 10]);

    // cupidLoversReveal should have passed
    // wolf attacks seat 0 -> dies
    expect(result.deaths).toEqual([0]);
  });
});
