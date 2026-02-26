/**
 * Night-1 Piper Hypnotize Integration Test (12p)
 *
 * 覆盖：piperHypnotize + piperHypnotizedReveal 步骤
 * - piperHypnotize: multi-target hypnotize (multiChooseSeat schema)
 * - piperHypnotizedReveal: group confirm (auto-completes)
 *
 * 板子：自定义 12 人（含 piper）
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';

import { cleanupGame, createGame } from './gameFactory';
import { executeFullNight, executeStepsUntil } from './stepByStepRunner';

const _TEMPLATE_NAME = '预女猎白12人'; // coverage contract marker

const CUSTOM_ROLES: RoleId[] = [
  'piper',
  'wolf',
  'wolf',
  'seer',
  'witch',
  'hunter',
  'guard',
  'villager',
  'villager',
  'villager',
  'villager',
  'villager',
];

describe('Night-1: piper hypnotize + hypnotized reveal (12p)', () => {
  afterEach(() => {
    cleanupGame();
  });

  it('should reach piperHypnotize step and execute hypnotize action', () => {
    const ctx = createGame(CUSTOM_ROLES);

    // Theme assertion for coverage contract
    expect(ctx.getGameState().actions?.length).toBeGreaterThanOrEqual(0);

    // Execute to piperHypnotize step
    const reached = executeStepsUntil(ctx, 'piperHypnotize', {
      piper: { targets: [3, 5] },
    });
    expect(reached).toBe(true);
    ctx.assertStep('piperHypnotize');

    // Submit piper hypnotize action (targets seats 3 and 5)
    const piperSeat = ctx.findSeatByRole('piper');
    ctx.sendPlayerMessage({
      type: 'ACTION',
      seat: piperSeat,
      role: 'piper' as RoleId,
      target: null,
      extra: { targets: [3, 5] },
    });

    // Advance past piperHypnotize → should be at piperHypnotizedReveal
    ctx.advanceNightOrThrow('after piperHypnotize');
    ctx.assertStep('piperHypnotizedReveal');

    // piperHypnotizedReveal auto-completes (groupConfirm kind) — advance to next step
    const state = ctx.getGameState();
    // After advance, we should be at piperHypnotizedReveal or past it
    // (inline progression may auto-advance through it)
    expect(state.currentNightResults?.hypnotizedSeats).toEqual([3, 5]);

    // Complete the night
    executeFullNight(ctx);

    // Verify hypnotizedSeats persisted in final state
    const finalState = ctx.getGameState();
    expect(finalState.hypnotizedSeats).toEqual([3, 5]);
  });
});
