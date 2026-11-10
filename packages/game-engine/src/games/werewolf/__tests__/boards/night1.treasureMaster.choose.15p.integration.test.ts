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
  const RANDOM_SEED = 'bottom-fixture-9';

  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  it('TreasureMaster picks crow (cardIndex=1), proxies crowCurse, full night completes', () => {
    ctx = createGame(TEMPLATE_ROLES, undefined, { randomSeed: RANDOM_SEED });

    // Verify initial state
    const initState = ctx.getGameState();
    expect(initState.bottomCards).toEqual(['crow', 'villager', 'wolf']);
    expect(initState.treasureMasterSeat).toBe(ctx.findSeatByRole('treasureMaster'));
    const crowCardIndex = initState.bottomCards!.indexOf('crow');
    const villagerSeat = ctx.findSeatByRole('villager');
    const wolfSeat = ctx.findSeatByRole('wolf');

    // First step = treasureMasterChoose
    ctx.assertStep('treasureMasterChoose');

    const result = executeFullNight(ctx, {
      treasureMaster: { cardIndex: crowCardIndex },
      dreamcatcher: villagerSeat,
      crow: villagerSeat,
      wolf: null, // Poisoner present, no kill on night 1
      poisoner: null, // no poison
      hunter: { confirmed: true },
      darkWolfKing: { confirmed: true },
      psychic: wolfSeat,
    });

    expect(result.completed).toBe(true);

    const state = ctx.getGameState();

    // Core assertion: TreasureMaster card selection result
    expect(state.currentNightResults?.treasureMasterChosenCard).toBe('crow');

    // wolfKill runs normally (deck has wolf but players still have wolf×2, should not auto-skip)
    // Poisoner present, no kill on night 1 → no kill deaths
    expect(result.deaths).toEqual([]);

    // crowCurse proxied by TreasureMaster → cursedSeat is written
    expect(state.currentNightResults?.cursedSeat).toBe(villagerSeat);

    // dreamcatcher acts normally
    expect(state.currentNightResults?.dreamingSeat).toBe(villagerSeat);

    // psychic checks normally
    expect(state.psychicReveal).toBeDefined();
    expect(state.psychicReveal!.targetSeat).toBe(wolfSeat);
  });

  it('TreasureMaster picks villager (cardIndex=2), no step proxy, full night completes', () => {
    ctx = createGame(TEMPLATE_ROLES, undefined, { randomSeed: RANDOM_SEED });
    const stateBeforeNight = ctx.getGameState();
    const villagerCardIndex = stateBeforeNight.bottomCards!.indexOf('villager');
    const villagerSeat = ctx.findSeatByRole('villager');
    const wolfSeat = ctx.findSeatByRole('wolf');

    const result = executeFullNight(ctx, {
      treasureMaster: { cardIndex: villagerCardIndex },
      dreamcatcher: villagerSeat,
      // crow in deck and not picked → crowCurse auto-skip
      wolf: null, // Poisoner present, no kill on night 1
      poisoner: null,
      hunter: { confirmed: true },
      darkWolfKing: { confirmed: true },
      psychic: wolfSeat,
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
  const RANDOM_SEED = 'bottom-fixture-2';

  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  it('TreasureMaster picks dreamcatcher (cardIndex=1) and proxies dream', () => {
    ctx = createGame(TEMPLATE_ROLES, undefined, { randomSeed: RANDOM_SEED });

    // Verify deck cards
    const initState = ctx.getGameState();
    expect(initState.bottomCards).toEqual(['wolf', 'dreamcatcher', 'villager']);
    const dreamcatcherCardIndex = initState.bottomCards!.indexOf('dreamcatcher');
    const villagerSeat = ctx.findSeatByRole('villager');
    const wolfSeat = ctx.findSeatByRole('wolf');
    ctx.assertStep('treasureMasterChoose');

    const result = executeFullNight(ctx, {
      treasureMaster: { cardIndex: dreamcatcherCardIndex },
      dreamcatcher: villagerSeat,
      crow: villagerSeat,
      wolf: null, // Poisoner is present, so wolves cannot kill on night 1.
      poisoner: null,
      hunter: { confirmed: true },
      darkWolfKing: { confirmed: true },
      psychic: wolfSeat,
    });

    expect(result.completed).toBe(true);

    const state = ctx.getGameState();

    // Core assertion: TreasureMaster card selection
    expect(state.currentNightResults?.treasureMasterChosenCard).toBe('dreamcatcher');

    // dreamcatcherDream proxied by TreasureMaster
    expect(state.currentNightResults?.dreamingSeat).toBe(villagerSeat);

    // The seated poisoner skips, so no one dies.
    expect(result.deaths).toEqual([]);

    // crowCurse normal (crow is a player)
    expect(state.currentNightResults?.cursedSeat).toBe(villagerSeat);
  });

  it('TreasureMaster picks villager (cardIndex=2), dreamcatcher auto-skips', () => {
    ctx = createGame(TEMPLATE_ROLES, undefined, { randomSeed: RANDOM_SEED });
    const stateBeforeNight = ctx.getGameState();
    const villagerCardIndex = stateBeforeNight.bottomCards!.indexOf('villager');
    const villagerSeat = ctx.findSeatByRole('villager');
    const wolfSeat = ctx.findSeatByRole('wolf');

    const result = executeFullNight(ctx, {
      treasureMaster: { cardIndex: villagerCardIndex },
      // dreamcatcher in deck and not picked → dreamcatcherDream auto-skip
      crow: villagerSeat,
      wolf: null,
      poisoner: villagerSeat,
      hunter: { confirmed: true },
      darkWolfKing: { confirmed: true },
      psychic: wolfSeat,
    });

    expect(result.completed).toBe(true);

    const state = ctx.getGameState();

    expect(state.currentNightResults?.treasureMasterChosenCard).toBe('villager');

    // dreamcatcherDream auto-skipped
    expect(state.currentNightResults?.dreamingSeat).toBeUndefined();

    // The seated poisoner poisons seat 2 while wolf kill is disabled.
    expect(result.deaths).toEqual([villagerSeat]);
  });
});
