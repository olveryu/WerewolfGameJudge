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
    const treasureSeat = ctx.findSeatByRole('treasureMaster');
    const villagerSeat = ctx.findSeatByRole('villager');
    const wolfSeat = ctx.findSeatByRole('wolf');
    const psychicSeat = ctx.findSeatByRole('psychic');

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

    expect(state.nightState?.roles.identities[treasureSeat]?.borrowedAbilityRole).toBe('crow');
    expect(
      state.nightState?.slice.records.treasureMasterChoose?.bySeat[treasureSeat]?.result,
    ).toEqual({
      kind: 'cardSelection',
      roleId: 'crow',
    });

    // wolfKill runs normally (deck has wolf but players still have wolf×2, should not auto-skip)
    // Poisoner present, no kill on night 1 → no kill deaths
    expect(result.deaths).toEqual([]);

    expect(state.nightState?.facts.selections).toContainEqual({
      roleId: 'crow',
      actorSeat: treasureSeat,
      chosenSeat: villagerSeat,
      landingSeat: villagerSeat,
    });
    expect(state.nightState?.facts.selections).toContainEqual({
      roleId: 'dreamcatcher',
      actorSeat: ctx.findSeatByRole('dreamcatcher'),
      chosenSeat: villagerSeat,
      landingSeat: villagerSeat,
    });
    expect(state.nightState?.slice.records.psychicCheck?.bySeat[psychicSeat]?.result).toMatchObject(
      {
        kind: 'identityCheck',
        chosenSeat: wolfSeat,
      },
    );
  });

  it('TreasureMaster picks villager (cardIndex=2), no step proxy, full night completes', () => {
    ctx = createGame(TEMPLATE_ROLES, undefined, { randomSeed: RANDOM_SEED });
    const stateBeforeNight = ctx.getGameState();
    const villagerCardIndex = stateBeforeNight.bottomCards!.indexOf('villager');
    const treasureSeat = ctx.findSeatByRole('treasureMaster');
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

    expect(state.nightState?.roles.identities[treasureSeat]?.borrowedAbilityRole).toBe('villager');
    expect(
      state.nightState?.facts.selections.some((selection) => selection.roleId === 'crow'),
    ).toBe(false);

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
    const treasureSeat = ctx.findSeatByRole('treasureMaster');
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

    expect(state.nightState?.roles.identities[treasureSeat]?.borrowedAbilityRole).toBe(
      'dreamcatcher',
    );
    expect(state.nightState?.facts.selections).toContainEqual({
      roleId: 'dreamcatcher',
      actorSeat: treasureSeat,
      chosenSeat: villagerSeat,
      landingSeat: villagerSeat,
    });

    // The seated poisoner skips, so no one dies.
    expect(result.deaths).toEqual([]);

    expect(state.nightState?.facts.selections).toContainEqual({
      roleId: 'crow',
      actorSeat: ctx.findSeatByRole('crow'),
      chosenSeat: villagerSeat,
      landingSeat: villagerSeat,
    });
  });

  it('TreasureMaster picks villager (cardIndex=2), dreamcatcher auto-skips', () => {
    ctx = createGame(TEMPLATE_ROLES, undefined, { randomSeed: RANDOM_SEED });
    const stateBeforeNight = ctx.getGameState();
    const villagerCardIndex = stateBeforeNight.bottomCards!.indexOf('villager');
    const treasureSeat = ctx.findSeatByRole('treasureMaster');
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

    expect(state.nightState?.roles.identities[treasureSeat]?.borrowedAbilityRole).toBe('villager');
    expect(
      state.nightState?.facts.selections.some((selection) => selection.roleId === 'dreamcatcher'),
    ).toBe(false);

    // The seated poisoner poisons seat 2 while wolf kill is disabled.
    expect(result.deaths).toEqual([villagerSeat]);
  });
});
