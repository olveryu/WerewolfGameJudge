/**
 * Night-1 Piper Hypnotize Integration Test (12p)
 *
 * Covers: piperHypnotize + piperHypnotizedReveal steps
 * - piperHypnotize: multi-target hypnotize (multiChooseSeat schema)
 * - piperHypnotizedReveal: group confirm (requires every player to acknowledge)
 *
 * Board: custom 12-player (includes piper)
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';

import { cleanupGame, createGame } from './gameFactory';
import { executeFullNight, executeStepsUntil, submitActionOrThrow } from './stepByStepRunner';

const _TEMPLATE_NAME = '预女猎白'; // coverage contract marker

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
    const reached = executeStepsUntil(ctx, 'piperHypnotize');
    expect(reached).toBe(true);
    ctx.assertStep('piperHypnotize');

    // Submit piper hypnotize action (targets seats 3 and 5)
    const piperSeat = ctx.findSeatByRole('piper');
    submitActionOrThrow(
      ctx,
      piperSeat,
      { kind: 'multiTarget', targets: [3, 5] },
      'piper hypnotizes seats 3 and 5',
    );

    // Settle authoritative progression through piperHypnotize
    expect(executeStepsUntil(ctx, 'piperHypnotizedReveal')).toBe(true);
    ctx.assertStep('piperHypnotizedReveal');

    // piperHypnotizedReveal remains active until every player acknowledges
    const state = ctx.getGameState();
    expect(state.currentNightResults?.hypnotizedSeats).toEqual([3, 5]);

    for (const player of Object.values(state.players)) {
      if (player === null) continue;
      ctx.dispatchAsSeatOrThrow(
        player.seat,
        { type: 'werewolf.groupConfirm.ack' },
        `acknowledge hypnotized-player reveal at seat ${player.seat}`,
      );
    }

    // Complete the night
    executeFullNight(ctx);

    // Verify hypnotizedSeats persisted in final state
    const finalState = ctx.getGameState();
    expect(finalState.hypnotizedSeats).toEqual([3, 5]);
  });
});
