/**
 * Night-1 Integration Test: TreasureMaster Card Selection (15p)
 *
 * Topic: TreasureMaster picks an identity from 3 deck cards. Verifies card selection,
 * identity substitution and auto-skip.
 *
 * Template: 15 roles = 12 players + 3 deck cards
 *   Psychic + Poisoner + Hunter + Dreamcatcher + Crow + WolfKing + Wolf×3 + TreasureMaster + Villager×5
 *
 * Architecture: intents → handlers → reducer → GameState
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';

import type { GameContext } from './gameContext';
import { cleanupGame, createGame } from './gameFactory';
import { executeFullNight } from './stepByStepRunner';

// =============================================================================
// Template: 15 roles (12 players + 3 deck cards)
// =============================================================================

const TEMPLATE_ROLES: RoleId[] = [
  'psychic',
  'poisoner',
  'hunter',
  'dreamcatcher',
  'crow',
  'darkWolfKing',
  'wolf',
  'wolf',
  'wolf',
  'treasureMaster',
  'villager',
  'villager',
  'villager',
  'villager',
  'villager',
] as RoleId[];

// =============================================================================
// Test 1: deck = wolf, crow, villager
// =============================================================================

describe('Night-1: TreasureMaster (15p) — deck contains wolf', () => {
  /**
   * Fixed seat-role assignment (12 players):
   *   seat 0-3: villager ×4
   *   seat 4-5: wolf ×2
   *   seat 6: darkWolfKing
   *   seat 7: psychic
   *   seat 8: poisoner
   *   seat 9: hunter
   *   seat 10: dreamcatcher
   *   seat 11: treasureMaster
   *
   * Deck cards: wolf, crow, villager
   */
  function createRoleAssignment(): Map<number, RoleId> {
    const map = new Map<number, RoleId>();
    map.set(0, 'villager');
    map.set(1, 'villager');
    map.set(2, 'villager');
    map.set(3, 'villager');
    map.set(4, 'wolf');
    map.set(5, 'wolf');
    map.set(6, 'darkWolfKing');
    map.set(7, 'psychic');
    map.set(8, 'poisoner');
    map.set(9, 'hunter');
    map.set(10, 'dreamcatcher');
    map.set(11, 'treasureMaster');
    return map;
  }

  const BOTTOM_CARDS: RoleId[] = ['wolf', 'crow', 'villager'];

  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  it('TreasureMaster picks crow (cardIndex=1), proxies crowCurse, full night completes', () => {
    ctx = createGame(TEMPLATE_ROLES, createRoleAssignment(), {
      bottomCards: BOTTOM_CARDS,
    });

    // Verify initial state
    const initState = ctx.getGameState();
    expect(initState.bottomCards).toEqual(BOTTOM_CARDS);
    expect(initState.treasureMasterSeat).toBe(11);

    // First step = treasureMasterChoose
    ctx.assertStep('treasureMasterChoose');

    const result = executeFullNight(ctx, {
      treasureMaster: { cardIndex: 1 }, // pick crow (index 1)
      dreamcatcher: 0, // dream on seat 0
      crow: 3, // treasureMaster proxies crowCurse, curses seat 3
      wolf: null, // Poisoner present, no kill on night 1
      poisoner: null, // no poison
      hunter: { confirmed: true },
      darkWolfKing: { confirmed: true },
      psychic: 4, // psychic checks seat 4 (wolf)
    });

    expect(result.completed).toBe(true);

    const state = ctx.getGameState();

    // Core assertion: TreasureMaster card selection result
    expect(state.currentNightResults?.treasureMasterChosenCard).toBe('crow');

    // wolfKill runs normally (deck has wolf but players still have wolf×2, should not auto-skip)
    // Poisoner present, no kill on night 1 → no kill deaths
    expect(result.deaths).toEqual([]);

    // crowCurse proxied by TreasureMaster → cursedSeat is written
    expect(state.currentNightResults?.cursedSeat).toBe(3);

    // dreamcatcher acts normally
    expect(state.currentNightResults?.dreamingSeat).toBe(0);

    // psychic checks normally
    expect(state.psychicReveal).toBeDefined();
    expect(state.psychicReveal!.targetSeat).toBe(4);
  });

  it('TreasureMaster picks villager (cardIndex=2), no step proxy, full night completes', () => {
    ctx = createGame(TEMPLATE_ROLES, createRoleAssignment(), {
      bottomCards: BOTTOM_CARDS,
    });

    const result = executeFullNight(ctx, {
      treasureMaster: { cardIndex: 2 }, // pick villager (index 2)
      dreamcatcher: 0,
      // crow in deck and not picked → crowCurse auto-skip
      wolf: null, // Poisoner present, no kill on night 1
      poisoner: null,
      hunter: { confirmed: true },
      darkWolfKing: { confirmed: true },
      psychic: 4,
    });

    expect(result.completed).toBe(true);

    const state = ctx.getGameState();

    // TreasureMaster picked villager
    expect(state.currentNightResults?.treasureMasterChosenCard).toBe('villager');

    // crowCurse auto-skipped (crow in deck and not picked)
    expect(state.currentNightResults?.cursedSeat).toBeUndefined();

    // wolfKill still runs normally (wolf×2 still players)
    // Poisoner present, no kill on night 1 → no deaths
    expect(result.deaths).toEqual([]);
  });
});

// =============================================================================
// Test 2: deck = wolf, dreamcatcher, villager
// =============================================================================

describe('Night-1: TreasureMaster (15p) — deck contains dreamcatcher', () => {
  /**
   * Fixed seat-role assignment (12 players):
   *   seat 0-3: villager ×4
   *   seat 4-5: wolf ×2
   *   seat 6: poisoner
   *   seat 7: darkWolfKing
   *   seat 8: psychic
   *   seat 9: hunter
   *   seat 10: crow
   *   seat 11: treasureMaster
   *
   * Deck cards: wolf, dreamcatcher, villager
   */
  function createRoleAssignment(): Map<number, RoleId> {
    const map = new Map<number, RoleId>();
    map.set(0, 'villager');
    map.set(1, 'villager');
    map.set(2, 'villager');
    map.set(3, 'villager');
    map.set(4, 'wolf');
    map.set(5, 'wolf');
    map.set(6, 'poisoner');
    map.set(7, 'darkWolfKing');
    map.set(8, 'psychic');
    map.set(9, 'hunter');
    map.set(10, 'crow');
    map.set(11, 'treasureMaster');
    return map;
  }

  const BOTTOM_CARDS: RoleId[] = ['wolf', 'dreamcatcher', 'villager'];

  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  it('TreasureMaster picks dreamcatcher (cardIndex=1) and proxies dream', () => {
    ctx = createGame(TEMPLATE_ROLES, createRoleAssignment(), {
      bottomCards: BOTTOM_CARDS,
    });

    // Verify deck cards
    const initState = ctx.getGameState();
    expect(initState.bottomCards).toEqual(BOTTOM_CARDS);
    ctx.assertStep('treasureMasterChoose');

    const result = executeFullNight(ctx, {
      treasureMaster: { cardIndex: 1 }, // pick dreamcatcher (index 1)
      dreamcatcher: 0, // treasureMaster proxies dreamcatcherDream, dream on seat 0
      crow: 3, // crow is a player, normal curse on seat 3
      wolf: null, // Poisoner is present, so wolves cannot kill on night 1.
      poisoner: null,
      hunter: { confirmed: true },
      darkWolfKing: { confirmed: true },
      psychic: 4,
    });

    expect(result.completed).toBe(true);

    const state = ctx.getGameState();

    // Core assertion: TreasureMaster card selection
    expect(state.currentNightResults?.treasureMasterChosenCard).toBe('dreamcatcher');

    // dreamcatcherDream proxied by TreasureMaster
    expect(state.currentNightResults?.dreamingSeat).toBe(0);

    // The seated poisoner skips, so no one dies.
    expect(result.deaths).toEqual([]);

    // crowCurse normal (crow is a player)
    expect(state.currentNightResults?.cursedSeat).toBe(3);
  });

  it('TreasureMaster picks villager (cardIndex=2), dreamcatcher auto-skips', () => {
    ctx = createGame(TEMPLATE_ROLES, createRoleAssignment(), {
      bottomCards: BOTTOM_CARDS,
    });

    const result = executeFullNight(ctx, {
      treasureMaster: { cardIndex: 2 }, // pick villager
      // dreamcatcher in deck and not picked → dreamcatcherDream auto-skip
      crow: 3,
      wolf: null,
      poisoner: 2,
      hunter: { confirmed: true },
      darkWolfKing: { confirmed: true },
      psychic: 4,
    });

    expect(result.completed).toBe(true);

    const state = ctx.getGameState();

    expect(state.currentNightResults?.treasureMasterChosenCard).toBe('villager');

    // dreamcatcherDream auto-skipped
    expect(state.currentNightResults?.dreamingSeat).toBeUndefined();

    // The seated poisoner poisons seat 2 while wolf kill is disabled.
    expect(result.deaths).toEqual([2]);
  });
});
