/**
 * Night-1 Integration Test: Thief + Cupid (Thief & Cupid)
 *
 * Theme: Thief picks identity from 2 deck cards, Cupid links lovers; verifies card selection, lover linking, full-night flow.
 *
 * Template: 14 roles = 12 players + 2 deck cards
 *   Seer + Witch + Hunter + Idiot + Wolf x3 + Villager x5 + Thief + Cupid
 *
 * Architecture: intents -> handlers -> reducer -> GameState
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';

import type { GameContext } from './gameContext';
import { cleanupGame, createGame } from './gameFactory';
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
  const RANDOM_SEED = 'bottom-fixture-1';

  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  it('盗贼选 idiot（cardIndex=1），丘比特连线 seat 0 和 1，全夜完成', () => {
    ctx = createGame(TEMPLATE_ROLES, undefined, { randomSeed: RANDOM_SEED });

    // Verify initial state
    const initState = ctx.getGameState();
    expect(initState.bottomCards).toEqual(['idiot', 'villager']);
    expect(initState.thiefSeat).toBe(ctx.findSeatByRole('thief'));
    const idiotCardIndex = initState.bottomCards!.indexOf('idiot');
    const seerSeat = ctx.findSeatByRole('seer');
    const villagerSeats = Object.values(initState.players)
      .filter((player) => player?.role === 'villager')
      .map((player) => player!.seat);
    const firstVillagerSeat = villagerSeats[0];
    const secondVillagerSeat = villagerSeats[1];
    if (firstVillagerSeat === undefined || secondVillagerSeat === undefined) {
      throw new Error('[FAIL-FAST] Thief fixture requires two seated villagers');
    }
    const loverSeats = [firstVillagerSeat, secondVillagerSeat];

    // First step = thiefChoose
    ctx.assertStep('thiefChoose');

    // Run to cupidChooseLovers to verify step progression
    executeStepsUntil(ctx, 'cupidChooseLovers', {
      thief: { cardIndex: idiotCardIndex },
    });
    ctx.assertStep('cupidChooseLovers');

    // Continue to cupidLoversReveal
    executeStepsUntil(ctx, 'cupidLoversReveal', {
      cupid: { targets: loverSeats },
    });
    ctx.assertStep('cupidLoversReveal');

    // Execute remaining night
    const result = executeFullNight(ctx, {
      wolf: seerSeat,
      witch: { save: seerSeat, poison: null },
      seer: firstVillagerSeat,
      hunter: { confirmed: true },
    });

    expect(result.completed).toBe(true);

    const state = ctx.getGameState();

    // Core assertion: Thief card selection result
    expect(state.currentNightResults?.thiefChosenCard).toBe('idiot');

    // Core assertion: Cupid lover linking result
    expect(state.loverSeats).toEqual(loverSeats);

    // Seer normal check
    expect(state.seerReveal).toBeDefined();
    expect(state.seerReveal!.targetSeat).toBe(firstVillagerSeat);

    // wolf -> seer saved by witch -> peaceful night
    expect(result.deaths).toEqual([]);
  });

  it('盗贼选 villager（cardIndex=0），丘比特连线 seat 7 和 10（异阵营），全夜完成', () => {
    ctx = createGame(TEMPLATE_ROLES, undefined, { randomSeed: RANDOM_SEED });
    const initState = ctx.getGameState();
    const villagerCardIndex = initState.bottomCards!.indexOf('villager');
    const seerSeat = ctx.findSeatByRole('seer');
    const thiefSeat = ctx.findSeatByRole('thief');
    const wolfSeat = ctx.findSeatByRole('wolf');
    const villagerSeat = ctx.findSeatByRole('villager');
    const loverSeats = [seerSeat, thiefSeat];

    const result = executeFullNight(ctx, {
      thief: { cardIndex: villagerCardIndex },
      cupid: { targets: loverSeats },
      wolf: villagerSeat,
      witch: null, // Witch does not save
      seer: wolfSeat,
      hunter: { confirmed: true },
    });

    expect(result.completed).toBe(true);

    const state = ctx.getGameState();

    // Thief picked villager
    expect(state.currentNightResults?.thiefChosenCard).toBe('villager');

    // Cupid links seer and thief
    expect(state.loverSeats).toEqual(loverSeats);

    // cupidLoversReveal should have passed
    // wolf attacks seat 0 -> dies
    expect(result.deaths).toEqual([villagerSeat]);
  });
});
