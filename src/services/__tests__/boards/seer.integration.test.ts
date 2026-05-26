/**
 * Seer Integration Tests
 *
 * Verifies the full pipeline for the seer role under the current architecture:
 * - UI -> PlayerMessage(ACTION) -> Handler -> Resolver -> APPLY_RESOLVER_RESULT
 * - seerReveal result correctness
 * - Nightmare block scenarios
 *
 * Uses harness (createGame)
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import { BLOCKED_UI_DEFAULTS } from '@werewolf/game-engine/models/roles/spec';

import { createGame } from './gameFactory';

/** Hard cap for step progression loops to avoid infinite loops */
const MAX_STEP_ADVANCES = 20;

describe('Seer Integration', () => {
  /**
   * Simplified template: only seer and wolf (minimal testable config)
   *
   * NIGHT_STEPS order determines the first step:
   * - First step here is wolfKill (wolf precedes seer in the step table)
   * - Tests must advance to the seerCheck step first
   */
  const SEER_TEMPLATE: RoleId[] = [
    'seer', // seat 0
    'wolf', // seat 1
    'villager', // seat 2
    'villager', // seat 3
  ];

  function createRoleAssignment(): Map<number, RoleId> {
    const map = new Map<number, RoleId>();
    SEER_TEMPLATE.forEach((role, idx) => map.set(idx, role));
    return map;
  }

  /** Helper to advance to the seerCheck step (with hard cap) */
  function advanceToSeerStep(ctx: ReturnType<typeof createGame>): boolean {
    // First step is wolfKill
    if (ctx.getGameState().currentStepId === 'wolfKill') {
      // Wolf abandons attack
      ctx.sendPlayerMessage({
        type: 'WOLF_VOTE',
        seat: 1,
        target: -1, // abandon attack
      });
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 1,
        role: 'wolf',
        target: null,
      });
      ctx.advanceNight();
    }

    // Should now be at seerCheck
    return ctx.getGameState().currentStepId === 'seerCheck';
  }

  describe('seerReveal Single Source of Truth', () => {
    it('should write seerReveal to GameState when seer checks wolf', () => {
      const ctx = createGame(SEER_TEMPLATE, createRoleAssignment());

      // Advance to seerCheck
      expect(advanceToSeerStep(ctx)).toBe(true);
      expect(ctx.getGameState().currentStepId).toBe('seerCheck');

      // seer checks seat 1 (wolf)
      const result = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 0,
        role: 'seer',
        target: 1,
      });

      expect(result.success).toBe(true);

      const state = ctx.getGameState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(1);
      // result may be "wolf" or "狼人" (depends on resolver impl)
      expect(['wolf', '狼人']).toContain(state.seerReveal!.result);
    });

    it('should write seerReveal with "good" when seer checks villager', () => {
      const ctx = createGame(SEER_TEMPLATE, createRoleAssignment());

      // Advance to seerCheck
      advanceToSeerStep(ctx);

      // seer checks seat 2 (villager)
      const result = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 0,
        role: 'seer',
        target: 2,
      });

      expect(result.success).toBe(true);

      const state = ctx.getGameState();
      expect(state.seerReveal).toBeDefined();
      expect(state.seerReveal!.targetSeat).toBe(2);
      // Seer checking a good player returns "好人" or "good"
      expect(['好人', 'good']).toContain(state.seerReveal!.result);
    });

    it('should reject seer self-check (notSelf constraint)', () => {
      const ctx = createGame(SEER_TEMPLATE, createRoleAssignment());

      // Advance to seerCheck
      advanceToSeerStep(ctx);

      // seer checks self (seat 0)
      const result = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 0,
        role: 'seer',
        target: 0,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toContain('自己');
    });
  });

  describe('Skip Action', () => {
    it('should allow seer to skip (target=null)', () => {
      const ctx = createGame(SEER_TEMPLATE, createRoleAssignment());

      // Advance to seerCheck
      advanceToSeerStep(ctx);

      const result = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 0,
        role: 'seer',
        target: null,
      });

      expect(result.success).toBe(true);

      const state = ctx.getGameState();
      // No seerReveal expected on skip
      expect(state.seerReveal).toBeUndefined();
    });
  });

  describe('Nightmare Block Edge Cases', () => {
    // Template including nightmare
    const NIGHTMARE_SEER_TEMPLATE: RoleId[] = [
      'nightmare', // seat 0
      'wolf', // seat 1
      'seer', // seat 2
      'villager', // seat 3
    ];

    function createNightmareAssignment(): Map<number, RoleId> {
      const map = new Map<number, RoleId>();
      NIGHTMARE_SEER_TEMPLATE.forEach((role, idx) => map.set(idx, role));
      return map;
    }

    /** Advance to seerCheck step (with hard cap) */
    function advanceToSeerCheckWithCap(ctx: ReturnType<typeof createGame>): void {
      for (let i = 0; i < MAX_STEP_ADVANCES; i++) {
        if (ctx.getGameState().currentStepId === 'seerCheck') {
          return;
        }

        const currentStep = ctx.getGameState().currentStepId;

        // If at wolfKill, must submit attack
        if (currentStep === 'wolfKill') {
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

        const advanceResult = ctx.advanceNight();
        if (!advanceResult.success) break;
      }

      if (ctx.getGameState().currentStepId !== 'seerCheck') {
        throw new Error(`Failed to reach seerCheck within ${MAX_STEP_ADVANCES} advances`);
      }
    }

    it('should reject blocked seer with non-skip action', () => {
      const ctx = createGame(NIGHTMARE_SEER_TEMPLATE, createNightmareAssignment());

      // First step is nightmare
      expect(ctx.getGameState().currentStepId).toBe('nightmareBlock');

      // nightmare blocks seer (seat 2)
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 0,
        role: 'nightmare',
        target: 2,
      });

      // Verify blockedSeat is set
      expect(ctx.getGameState().currentNightResults?.blockedSeat).toBe(2);

      // Advance to seer step (with hard cap)
      advanceToSeerCheckWithCap(ctx);

      // seer attempts check (should be rejected)
      const result = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 2,
        role: 'seer',
        target: 1,
      });

      expect(result.success).toBe(false);
      // Assert against constant to avoid Chinese-copy dependency
      expect(result.reason).toBe(BLOCKED_UI_DEFAULTS.message);
    });

    it('should allow blocked seer to skip', () => {
      const ctx = createGame(NIGHTMARE_SEER_TEMPLATE, createNightmareAssignment());

      // nightmare blocks seer (seat 2)
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 0,
        role: 'nightmare',
        target: 2,
      });

      // Advance to seer step (with hard cap)
      advanceToSeerCheckWithCap(ctx);

      // seer skips (should succeed)
      const result = ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 2,
        role: 'seer',
        target: null,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Wire Protocol Contract', () => {
    it('seerCheck payload: target is single seat number (not encoded)', () => {
      const ctx = createGame(SEER_TEMPLATE, createRoleAssignment());

      // Advance to seerCheck
      advanceToSeerStep(ctx);
      ctx.clearCapturedMessages();

      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 0,
        role: 'seer',
        target: 1,
      });

      const captured = ctx.getCapturedMessages();
      const seerMsg = captured.find((c) => c.stepId === 'seerCheck' && c.message.type === 'ACTION');

      expect(seerMsg).toBeDefined();
      const msg = seerMsg!.message as { target: number | null };
      expect(msg.target).toBe(1);
      // Not an encoded value
      expect(msg.target).toBeLessThan(100);
    });

    it('seerCheck payload: skip has target=null', () => {
      const ctx = createGame(SEER_TEMPLATE, createRoleAssignment());

      // Advance to seerCheck
      advanceToSeerStep(ctx);
      ctx.clearCapturedMessages();

      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 0,
        role: 'seer',
        target: null,
      });

      const captured = ctx.getCapturedMessages();
      const seerMsg = captured.find((c) => c.stepId === 'seerCheck' && c.message.type === 'ACTION');

      expect(seerMsg).toBeDefined();
      const msg = seerMsg!.message as { target: number | null };
      expect(msg.target).toBeNull();
    });
  });
});
