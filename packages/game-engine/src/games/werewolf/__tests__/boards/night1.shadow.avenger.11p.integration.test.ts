/**
 * Night-1 Shadow & Avenger Integration Test (12p)
 *
 * Coverage: shadowChooseMimic + avengerConfirm steps
 * - shadowChooseMimic: chooseSeat schema (notSelf constraint)
 * - avengerConfirm: confirm schema (displays faction)
 *
 * Board: Shadow Avenger 12p
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { Team } from '@game-judge/game-engine/games/werewolf/public';

import { cleanupGame, createGame } from './gameFactory';
import { executeFullNight, executeStepsUntil, submitActionOrThrow } from './stepByStepRunner';

const CUSTOM_ROLES: RoleId[] = [
  'shadow',
  'avenger',
  'slacker',
  'wolf',
  'wolf',
  'wolf',
  'seer',
  'witch',
  'guard',
  'villager',
  'villager',
  'villager',
];

describe('Night-1: shadow choose mimic + avenger confirm (12p)', () => {
  afterEach(() => {
    cleanupGame();
  });

  it('should reach shadowChooseMimic and record mimic target', () => {
    const ctx = createGame(CUSTOM_ROLES);

    // Theme assertion for coverage contract
    expect(ctx.getGameState().templateRoles).toHaveLength(12);

    // Execute to shadowChooseMimic step
    const reached = executeStepsUntil(ctx, 'shadowChooseMimic', {
      shadow: 5, // mimic seat 5
      slacker: 3, // choose idol seat 3
    });
    expect(reached).toBe(true);
    ctx.assertStep('shadowChooseMimic');

    // Submit shadow action: mimic seat 5
    const shadowSeat = ctx.findSeatByRole('shadow');
    submitActionOrThrow(ctx, shadowSeat, { kind: 'target', target: 5 }, 'shadow mimics seat 5');

    // Advance past shadowChooseMimic → should be at avengerConfirm
    expect(executeStepsUntil(ctx, 'avengerConfirm')).toBe(true);
    ctx.assertStep('avengerConfirm');

    // Verify shadowMimicTarget recorded
    const state = ctx.getGameState();
    expect(state.currentNightResults?.shadowMimicTarget).toBe(5);

    // Submit avenger confirm
    const avengerSeat = ctx.findSeatByRole('avenger');
    submitActionOrThrow(ctx, avengerSeat, { kind: 'confirm' }, 'avenger confirms faction');

    // Complete the night
    executeFullNight(ctx);
  });

  it('shadow mimics avenger → sets avengerFaction = Team.Third in currentNightResults', () => {
    const ctx = createGame(CUSTOM_ROLES);

    const avengerSeat = ctx.findSeatByRole('avenger');

    // Execute to shadowChooseMimic, shadow picks avenger
    const reached = executeStepsUntil(ctx, 'shadowChooseMimic', {
      shadow: avengerSeat,
      slacker: 3, // choose idol seat 3
    });
    expect(reached).toBe(true);

    // Submit shadow action: mimic avenger
    const shadowSeat = ctx.findSeatByRole('shadow');
    submitActionOrThrow(
      ctx,
      shadowSeat,
      { kind: 'target', target: avengerSeat },
      'shadow mimics avenger',
    );

    // Should have avengerFaction set since target is avenger
    const state = ctx.getGameState();
    expect(state.currentNightResults?.avengerFaction).toBe(Team.Third);
    expect(state.currentNightResults?.shadowMimicTarget).toBe(avengerSeat);

    // Advance to avengerConfirm
    expect(executeStepsUntil(ctx, 'avengerConfirm')).toBe(true);
    ctx.assertStep('avengerConfirm');

    // Complete the night
    const avengerSeatForConfirm = ctx.findSeatByRole('avenger');
    submitActionOrThrow(
      ctx,
      avengerSeatForConfirm,
      { kind: 'confirm' },
      'avenger confirms bonded faction',
    );
    executeFullNight(ctx);
  });
});
