/**
 * Night-1 Shadow & Avenger Integration Test (12p)
 *
 * Coverage: shadowChooseMimic + avengerConfirm steps
 * - shadowChooseMimic: chooseSeat schema (notSelf constraint)
 * - avengerConfirm: confirm schema (displays faction)
 *
 * Board: Shadow Avenger 12p
 */

import { getWerewolfViewModel, type RoleId } from '@game-judge/game-engine/games/werewolf/public';

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

    const state = ctx.getGameState();
    expect(state.nightState?.facts.selections).toContainEqual({
      roleId: 'shadow',
      actorSeat: shadowSeat,
      chosenSeat: 5,
      landingSeat: 5,
    });

    // Submit avenger confirm
    const avengerSeat = ctx.findSeatByRole('avenger');
    submitActionOrThrow(ctx, avengerSeat, { kind: 'confirm' }, 'avenger confirms faction');

    // Complete the night
    executeFullNight(ctx);
  });

  it('shadow mimics avenger → avenger sees the bonded third-party faction', () => {
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

    const state = ctx.getGameState();
    expect(state.nightState?.facts.selections).toContainEqual({
      roleId: 'shadow',
      actorSeat: shadowSeat,
      chosenSeat: avengerSeat,
      landingSeat: avengerSeat,
    });

    // Advance to avengerConfirm
    expect(executeStepsUntil(ctx, 'avengerConfirm')).toBe(true);
    ctx.assertStep('avengerConfirm');
    const view = getWerewolfViewModel(ctx.getGameState(), {
      seat: avengerSeat,
      isHost: false,
    }).step;
    const action = view?.actions.find((entry) => entry.kind === 'view');
    expect(action?.kind === 'view' && action.content.text).toBe('你与影子绑定，同属第三方阵营');

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
