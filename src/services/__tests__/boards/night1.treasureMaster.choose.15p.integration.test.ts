/**
 * Night-1 Integration Test: TreasureMaster Card Selection (15p)
 *
 * Topic: TreasureMaster picks an identity from 3 deck cards. Verifies card selection,
 * identity substitution, auto-skip, and effectiveTeam.
 *
 * Template: 15 roles = 12 players + 3 deck cards
 *   Psychic + Poisoner + Hunter + Dreamcatcher + Crow + WolfKing + Wolf×3 + TreasureMaster + Villager×5
 *
 * Architecture: intents → handlers → reducer → GameState
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import { Team } from '@werewolf/game-engine/models/roles/spec/types';

import { cleanupGame, createGame, type GameContext } from './gameFactory';
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
// Test 1: deck = wolf, crow, villager (contains wolf card → effectiveTeam = Wolf)
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
    expect(state.treasureMasterChosenCard).toBe('crow');
    expect(state.effectiveTeam).toBe(Team.Wolf); // deck contains wolf → Team.Wolf
    expect(state.bottomCardStepRoles).toEqual(expect.arrayContaining(['wolf', 'crow']));

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
    expect(state.treasureMasterChosenCard).toBe('villager');
    expect(state.effectiveTeam).toBe(Team.Wolf); // deck contains wolf → Team.Wolf

    // crowCurse auto-skipped (crow in deck and not picked)
    expect(state.currentNightResults?.cursedSeat).toBeUndefined();

    // wolfKill still runs normally (wolf×2 still players)
    // Poisoner present, no kill on night 1 → no deaths
    expect(result.deaths).toEqual([]);
  });
});

// =============================================================================
// Test 2: deck = poisoner, dreamcatcher, villager (no wolf card → effectiveTeam = Good)
// =============================================================================

describe('Night-1: TreasureMaster (15p) — deck has no wolf', () => {
  /**
   * Fixed seat-role assignment (12 players):
   *   seat 0-3: villager ×4
   *   seat 4-6: wolf ×3
   *   seat 7: darkWolfKing
   *   seat 8: psychic
   *   seat 9: hunter
   *   seat 10: crow
   *   seat 11: treasureMaster
   *
   * Deck cards: poisoner, dreamcatcher, villager
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
    map.set(8, 'psychic');
    map.set(9, 'hunter');
    map.set(10, 'crow');
    map.set(11, 'treasureMaster');
    return map;
  }

  const BOTTOM_CARDS: RoleId[] = ['poisoner', 'dreamcatcher', 'villager'];

  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  it('TreasureMaster picks dreamcatcher (cardIndex=1), proxies dream, poisonerPoison auto-skip', () => {
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
      wolf: null, // Poisoner in template (deck), no kill on night 1
      // poisoner in deck and not picked → poisonerPoison auto-skip
      hunter: { confirmed: true },
      darkWolfKing: { confirmed: true },
      psychic: 4,
    });

    expect(result.completed).toBe(true);

    const state = ctx.getGameState();

    // Core assertion: TreasureMaster card selection
    expect(state.treasureMasterChosenCard).toBe('dreamcatcher');
    expect(state.effectiveTeam).toBe(Team.Good); // deck has no wolf → Team.Good
    expect(state.bottomCardStepRoles).toEqual(expect.arrayContaining(['poisoner', 'dreamcatcher']));

    // dreamcatcherDream proxied by TreasureMaster
    expect(state.currentNightResults?.dreamingSeat).toBe(0);

    // poisonerPoison auto-skipped (poisoner in deck and not picked)
    // Poisoner in template (deck), no kill on night 1 → no kill deaths
    expect(result.deaths).toEqual([]);

    // crowCurse normal (crow is a player)
    expect(state.currentNightResults?.cursedSeat).toBe(3);
  });

  it('TreasureMaster picks poisoner (cardIndex=0), proxies poisoner, dreamcatcherDream auto-skip', () => {
    ctx = createGame(TEMPLATE_ROLES, createRoleAssignment(), {
      bottomCards: BOTTOM_CARDS,
    });

    const result = executeFullNight(ctx, {
      treasureMaster: { cardIndex: 0 }, // pick poisoner (index 0)
      // dreamcatcher in deck and not picked → dreamcatcherDream auto-skip
      crow: 3,
      wolf: null, // Poisoner in template (deck), no kill on night 1
      poisoner: 2, // treasureMaster proxies poisonerPoison, poisons seat 2
      hunter: { confirmed: true },
      darkWolfKing: { confirmed: true },
      psychic: 4,
    });

    expect(result.completed).toBe(true);

    const state = ctx.getGameState();

    expect(state.treasureMasterChosenCard).toBe('poisoner');
    expect(state.effectiveTeam).toBe(Team.Good);

    // dreamcatcherDream auto-skipped
    expect(state.currentNightResults?.dreamingSeat).toBeUndefined();

    // poisonerPoison proxied by TreasureMaster → seat 2 poisoned
    // Wolves cannot kill (poisoner in template) + seat 2 poisoned
    expect(result.deaths).toEqual([2]);
  });
});
