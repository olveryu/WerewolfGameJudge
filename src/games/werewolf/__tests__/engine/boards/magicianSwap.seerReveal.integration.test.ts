/**
 * Magician Swap -> Seer Reveal Regression Test
 *
 * Key regression: ensure seer check uses **post-swap identity** after magician swap.
 *
 * Scenario:
 * - Magician swaps seat 0 (original magician) with seat 1 (original wolf)
 * - After swap: seat 0 = wolf, seat 1 = magician
 * - Seer checks seat 0 should return "狼人/wolf" (now wolf)
 * - Seer checks seat 1 should return "好人/good" (now magician)
 *
 * Production action input:
 * - magician swap: { kind: 'multiTarget', targets: [seatA, seatB] }
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';

import { createGame } from './gameFactory';
import { executeStepsUntil, submitActionOrThrow } from './stepByStepRunner';

describe('Magician Swap → Seer Reveal Regression', () => {
  /**
   * Template: magician + wolf + seer + villager
   * Initial config:
   * - seat 0: magician
   * - seat 1: wolf
   * - seat 2: seer
   * - seat 3: villager
   */
  const SWAP_TEMPLATE: RoleId[] = [
    'magician', // seat 0
    'wolf', // seat 1
    'seer', // seat 2
    'villager', // seat 3
  ];

  function createSwapAssignment(): Map<number, RoleId> {
    const map = new Map<number, RoleId>();
    SWAP_TEMPLATE.forEach((role, idx) => map.set(idx, role));
    return map;
  }

  describe('Seer should use post-swap identity', () => {
    it('seer checks swapped seat 0 → should see wolf (original wolf was swapped to seat 0)', () => {
      const ctx = createGame(SWAP_TEMPLATE, createSwapAssignment());

      // First step should be magicianSwap
      ctx.assertStep('magicianSwap');

      // Magician swaps seat 0 (magician) with seat 1 (wolf)
      submitActionOrThrow(
        ctx,
        0,
        { kind: 'multiTarget', targets: [0, 1] },
        'magician swaps seats 0 and 1',
      );

      // Advance to seerCheck; wolves skip the attack.
      expect(executeStepsUntil(ctx, 'seerCheck', { wolf: null })).toBe(true);

      expect(ctx.getGameState().currentStepId).toBe('seerCheck');

      // Seer checks seat 0 (should be wolf after swap)
      // Note: after swap, seat 0's role is now wolf
      submitActionOrThrow(ctx, 2, { kind: 'target', target: 0 }, 'seer checks swapped seat 0');

      const state = ctx.getGameState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(0);
      // Key assertion: should return wolf identity (post-swap identity)
      expect(['wolf', '狼人']).toContain(state.seerReveal!.result);
    });

    it('seer checks swapped seat 1 → should see good (original magician was swapped to seat 1)', () => {
      const ctx = createGame(SWAP_TEMPLATE, createSwapAssignment());

      // Magician swaps seat 0 (magician) with seat 1 (wolf)
      submitActionOrThrow(
        ctx,
        0,
        { kind: 'multiTarget', targets: [0, 1] },
        'magician swaps seats 0 and 1',
      );

      // Advance to seerCheck; wolves skip the attack.
      expect(executeStepsUntil(ctx, 'seerCheck', { wolf: null })).toBe(true);

      expect(ctx.getGameState().currentStepId).toBe('seerCheck');

      // Seer checks seat 1 (should be magician = good after swap)
      submitActionOrThrow(ctx, 2, { kind: 'target', target: 1 }, 'seer checks swapped seat 1');

      const state = ctx.getGameState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(1);
      // Key assertion: should return good identity (magician is in good faction)
      expect(['好人', 'good']).toContain(state.seerReveal!.result);
    });

    it('no swap (skip) → seer should use original identity', () => {
      const ctx = createGame(SWAP_TEMPLATE, createSwapAssignment());

      // Magician skips (no swap)
      submitActionOrThrow(ctx, 0, { kind: 'skip' }, 'magician skips swap');

      // Advance to seerCheck; wolves skip the attack.
      expect(executeStepsUntil(ctx, 'seerCheck', { wolf: null })).toBe(true);
      expect(ctx.getGameState().currentStepId).toBe('seerCheck');

      // Seer checks seat 1 (original identity should still be wolf)
      submitActionOrThrow(ctx, 2, { kind: 'target', target: 1 }, 'seer checks original wolf');

      const state = ctx.getGameState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(1);
      // No swap; seat 1 should still be wolf
      expect(['wolf', '狼人']).toContain(state.seerReveal!.result);
    });
  });
});
