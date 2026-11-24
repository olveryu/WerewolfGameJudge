/**
 * Night-1 Piper Hypnotize Integration Test (12p)
 *
 * Covers: piperHypnotize + piperHypnotizedReveal steps
 * - piperHypnotize: multi-target hypnotize (multiChooseSeat schema)
 * - piperHypnotizedReveal: group confirm (requires every player to acknowledge)
 *
 * Board: custom 12-player (includes piper)
 */

import { getWerewolfViewModel, type RoleId } from '@game-judge/game-engine/games/werewolf/public';

import { cleanupGame, createGame } from './gameFactory';
import {
  executeFullNight,
  executeStepsUntil,
  submitActionOrThrow,
  submitStep,
} from './stepByStepRunner';

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
    expect(
      state.nightState?.facts.selections
        .filter((selection) => selection.roleId === 'piper')
        .map((selection) => selection.landingSeat),
    ).toEqual([3, 5]);
    const hypnotizedView = getWerewolfViewModel(state, { seat: 3, isHost: false }).step;
    const reveal = hypnotizedView?.actions.find((action) => action.kind === 'view');
    expect(reveal?.kind === 'view' && reveal.content.text).toContain('4号、6号');

    for (const player of Object.values(state.players)) {
      if (player === null) continue;
      submitStep(ctx, player.seat, { actionKey: 'piperHypnotizedReveal' }, 'acknowledge reveal');
    }

    // Complete the night
    executeFullNight(ctx);

    const finalState = ctx.getGameState();
    expect(
      finalState.nightState?.facts.selections
        .filter((selection) => selection.roleId === 'piper')
        .map((selection) => selection.landingSeat),
    ).toEqual([3, 5]);
  });
});
