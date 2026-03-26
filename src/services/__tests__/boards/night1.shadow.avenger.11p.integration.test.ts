/**
 * Night-1 Shadow & Avenger Integration Test (12p)
 *
 * 覆盖：shadowChooseMimic + avengerConfirm 步骤
 * - shadowChooseMimic: chooseSeat schema (notSelf constraint)
 * - avengerConfirm: confirm schema (displays faction)
 *
 * 板子：影子复仇者 12 人
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import { Team } from '@werewolf/game-engine/models/roles/spec/types';

import { cleanupGame, createGame } from './gameFactory';
import { executeFullNight, executeStepsUntil } from './stepByStepRunner';

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
    ctx.sendPlayerMessage({
      type: 'ACTION',
      seat: shadowSeat,
      role: 'shadow' as RoleId,
      target: 5,
    });

    // Advance past shadowChooseMimic → should be at avengerConfirm
    ctx.advanceNightOrThrow('after shadowChooseMimic');
    ctx.assertStep('avengerConfirm');

    // Verify shadowMimicTarget recorded
    const state = ctx.getGameState();
    expect(state.currentNightResults?.shadowMimicTarget).toBe(5);

    // Submit avenger confirm
    const avengerSeat = ctx.findSeatByRole('avenger');
    ctx.sendPlayerMessage({
      type: 'ACTION',
      seat: avengerSeat,
      role: 'avenger' as RoleId,
      target: null,
      extra: { confirmed: true },
    });

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
    ctx.sendPlayerMessage({
      type: 'ACTION',
      seat: shadowSeat,
      role: 'shadow' as RoleId,
      target: avengerSeat,
    });

    // Should have avengerFaction set since target is avenger
    const state = ctx.getGameState();
    expect(state.currentNightResults?.avengerFaction).toBe(Team.Third);
    expect(state.currentNightResults?.shadowMimicTarget).toBe(avengerSeat);

    // Ack the reveal
    ctx.sendPlayerMessage({
      type: 'REVEAL_ACK',
      seat: shadowSeat,
      role: 'shadow' as RoleId,
      revision: 0,
    });

    // Advance to avengerConfirm
    ctx.advanceNightOrThrow('after shadowChooseMimic reveal');
    ctx.assertStep('avengerConfirm');

    // Complete the night
    const avengerSeatForConfirm = ctx.findSeatByRole('avenger');
    ctx.sendPlayerMessage({
      type: 'ACTION',
      seat: avengerSeatForConfirm,
      role: 'avenger' as RoleId,
      target: null,
      extra: { confirmed: true },
    });
    executeFullNight(ctx);
  });
});
