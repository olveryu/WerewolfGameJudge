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
 * Wire Protocol:
 * - magician swap: target=null + extra.targets=[seatA, seatB]
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';

import { createGame } from './gameFactory';

/** Hard cap for step progression loops to avoid infinite loops */
const MAX_STEP_ADVANCES = 20;

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

  /** Helper to advance to a specific step (with hard cap) */
  function advanceToStep(
    ctx: ReturnType<typeof createGame>,
    targetStepId: string,
    handleStep?: (stepId: string) => void,
  ): void {
    for (let i = 0; i < MAX_STEP_ADVANCES; i++) {
      const currentStepId = ctx.getGameState().currentStepId;

      if (currentStepId === targetStepId) {
        return;
      }

      // Allow caller to handle intermediate steps
      if (handleStep) {
        handleStep(currentStepId!);
      }

      const result = ctx.advanceNight();
      if (!result.success) {
        break;
      }
    }

    if (ctx.getGameState().currentStepId !== targetStepId) {
      throw new Error(`Failed to reach ${targetStepId} within ${MAX_STEP_ADVANCES} advances`);
    }
  }

  describe('Seer should use post-swap identity', () => {
    it('seer checks swapped seat 0 → should see wolf (original wolf was swapped to seat 0)', () => {
      const ctx = createGame(SWAP_TEMPLATE, createSwapAssignment());

      // First step should be magicianSwap
      expect(ctx.getGameState().currentStepId).toBe('magicianSwap');

      // Magician swaps seat 0 (magician) with seat 1 (wolf)
      // Wire protocol: target=null, extra.targets=[seatA, seatB]
      const swapResult = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 0,
        role: 'magician',
        target: null,
        extra: { targets: [0, 1] },
      });
      expect(swapResult.success).toBe(true);

      // Advance to seerCheck, handle intermediate steps (wolves skip attack)
      advanceToStep(ctx, 'seerCheck', (stepId) => {
        if (stepId === 'wolfKill') {
          // Wolves skip attack
          ctx.sendPlayerMessage({
            type: 'WOLF_VOTE',
            seat: 1,
            target: -1,
          });
          ctx.sendPlayerMessage({
            type: 'ACTION',
            seat: 1,
            role: 'wolf',
            target: null,
          });
        }
      });

      expect(ctx.getGameState().currentStepId).toBe('seerCheck');

      // Seer checks seat 0 (should be wolf after swap)
      // Note: after swap, seat 0's role is now wolf
      const checkResult = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 2,
        role: 'seer',
        target: 0, // check seat 0
      });

      expect(checkResult.success).toBe(true);

      const state = ctx.getGameState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(0);
      // Key assertion: should return wolf identity (post-swap identity)
      expect(['wolf', '狼人']).toContain(state.seerReveal!.result);
    });

    it('seer checks swapped seat 1 → should see good (original magician was swapped to seat 1)', () => {
      const ctx = createGame(SWAP_TEMPLATE, createSwapAssignment());

      // Magician swaps seat 0 (magician) with seat 1 (wolf)
      const swapResult = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 0,
        role: 'magician',
        target: null,
        extra: { targets: [0, 1] },
      });
      expect(swapResult.success).toBe(true);

      // Advance to seerCheck, handle intermediate steps
      advanceToStep(ctx, 'seerCheck', (stepId) => {
        if (stepId === 'wolfKill') {
          ctx.sendPlayerMessage({
            type: 'WOLF_VOTE',
            seat: 1,
            target: -1,
          });
          ctx.sendPlayerMessage({
            type: 'ACTION',
            seat: 1,
            role: 'wolf',
            target: null,
          });
        }
      });

      expect(ctx.getGameState().currentStepId).toBe('seerCheck');

      // Seer checks seat 1 (should be magician = good after swap)
      const checkResult = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 2,
        role: 'seer',
        target: 1, // check seat 1
      });

      expect(checkResult.success).toBe(true);

      const state = ctx.getGameState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(1);
      // Key assertion: should return good identity (magician is in good faction)
      expect(['好人', 'good']).toContain(state.seerReveal!.result);
    });

    it('no swap (skip) → seer should use original identity', () => {
      const ctx = createGame(SWAP_TEMPLATE, createSwapAssignment());

      // Magician skips (no swap)
      const skipResult = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 0,
        role: 'magician',
        target: null,
        extra: { targets: [] }, // empty targets means skip
      });
      expect(skipResult.success).toBe(true);

      // Advance to seerCheck
      advanceToStep(ctx, 'seerCheck', (stepId) => {
        if (stepId === 'wolfKill') {
          ctx.sendPlayerMessage({
            type: 'WOLF_VOTE',
            seat: 1,
            target: -1,
          });
          ctx.sendPlayerMessage({
            type: 'ACTION',
            seat: 1,
            role: 'wolf',
            target: null,
          });
        }
      });

      // Seer checks seat 1 (original identity should still be wolf)
      const checkResult = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 2,
        role: 'seer',
        target: 1,
      });

      expect(checkResult.success).toBe(true);

      const state = ctx.getGameState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(1);
      // No swap; seat 1 should still be wolf
      expect(['wolf', '狼人']).toContain(state.seerReveal!.result);
    });
  });
});
