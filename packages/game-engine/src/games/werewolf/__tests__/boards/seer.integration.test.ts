/** Seer integration tests through the canonical Werewolf public-command pipeline. */

import { BLOCKED_UI_DEFAULTS, type RoleId } from '@game-judge/game-engine/games/werewolf/public';

import { createGame } from './gameFactory';
import { executeStepsUntil, submitActionOrThrow } from './stepByStepRunner';

const SEER_TEMPLATE: RoleId[] = ['seer', 'wolf', 'villager', 'villager'];
const NIGHTMARE_SEER_TEMPLATE: RoleId[] = ['nightmare', 'wolf', 'seer', 'villager'];

function createAssignment(roles: readonly RoleId[]): Map<number, RoleId> {
  return new Map(roles.map((role, seat) => [seat, role]));
}

describe('Seer Integration', () => {
  describe('seerReveal single source of truth', () => {
    it('writes a wolf result when the Seer checks a wolf', () => {
      const ctx = createGame(SEER_TEMPLATE, createAssignment(SEER_TEMPLATE));
      expect(executeStepsUntil(ctx, 'seerCheck', { wolf: null })).toBe(true);

      submitActionOrThrow(ctx, 0, { kind: 'target', target: 1 }, 'seer checks wolf');

      expect(ctx.getGameState().seerReveal).toMatchObject({ targetSeat: 1 });
      expect(['wolf', '狼人']).toContain(ctx.getGameState().seerReveal?.result);
    });

    it('writes a good result when the Seer checks a villager', () => {
      const ctx = createGame(SEER_TEMPLATE, createAssignment(SEER_TEMPLATE));
      expect(executeStepsUntil(ctx, 'seerCheck', { wolf: null })).toBe(true);

      submitActionOrThrow(ctx, 0, { kind: 'target', target: 2 }, 'seer checks villager');

      expect(ctx.getGameState().seerReveal).toMatchObject({ targetSeat: 2 });
      expect(['good', '好人']).toContain(ctx.getGameState().seerReveal?.result);
    });

    it('commits a domain rejection for a self-check', () => {
      const ctx = createGame(SEER_TEMPLATE, createAssignment(SEER_TEMPLATE));
      expect(executeStepsUntil(ctx, 'seerCheck', { wolf: null })).toBe(true);

      const result = ctx.dispatchAsSeat(0, {
        type: 'werewolf.action.submit',
        input: { kind: 'target', target: 0 },
      });

      if (result.kind !== 'committed' || result.outcome.kind !== 'domainRejected') {
        throw new Error('[FAIL-FAST] Seer self-check must commit a domain rejection');
      }
      expect(result.outcome.reason).toContain('自己');
    });
  });

  it('accepts the canonical skip command without writing a reveal', () => {
    const ctx = createGame(SEER_TEMPLATE, createAssignment(SEER_TEMPLATE));
    expect(executeStepsUntil(ctx, 'seerCheck', { wolf: null })).toBe(true);

    submitActionOrThrow(ctx, 0, { kind: 'skip' }, 'seer skips');

    expect(ctx.getGameState().seerReveal).toBeUndefined();
  });

  describe('Nightmare block', () => {
    it('rejects a blocked Seer target action', () => {
      const ctx = createGame(NIGHTMARE_SEER_TEMPLATE, createAssignment(NIGHTMARE_SEER_TEMPLATE));
      submitActionOrThrow(ctx, 0, { kind: 'target', target: 2 }, 'nightmare blocks seer');
      expect(ctx.getGameState().currentNightResults?.blockedSeat).toBe(2);
      expect(executeStepsUntil(ctx, 'seerCheck', { wolf: null })).toBe(true);

      const result = ctx.dispatchAsSeat(2, {
        type: 'werewolf.action.submit',
        input: { kind: 'target', target: 1 },
      });

      expect(result).toMatchObject({
        kind: 'committed',
        outcome: { kind: 'domainRejected', reason: BLOCKED_UI_DEFAULTS.message },
      });
    });

    it('allows a blocked Seer to skip', () => {
      const ctx = createGame(NIGHTMARE_SEER_TEMPLATE, createAssignment(NIGHTMARE_SEER_TEMPLATE));
      submitActionOrThrow(ctx, 0, { kind: 'target', target: 2 }, 'nightmare blocks seer');
      expect(executeStepsUntil(ctx, 'seerCheck', { wolf: null })).toBe(true);

      submitActionOrThrow(ctx, 2, { kind: 'skip' }, 'blocked seer skips');
    });
  });
});
