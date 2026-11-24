/** Seer integration tests through the canonical Werewolf public-command pipeline. */

import { getWerewolfViewModel, type RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { REASON_STEP_STALE } from '@game-judge/game-engine/platform/steps';

import { createGame } from './gameFactory';
import { dispatchStep, executeStepsUntil, submitActionOrThrow } from './stepByStepRunner';

const SEER_TEMPLATE: RoleId[] = ['seer', 'wolf', 'villager', 'villager'];
const NIGHTMARE_SEER_TEMPLATE: RoleId[] = ['nightmare', 'wolf', 'seer', 'villager'];

function createAssignment(roles: readonly RoleId[]): Map<number, RoleId> {
  return new Map(roles.map((role, seat) => [seat, role]));
}

describe('Seer Integration', () => {
  describe('shared-step check result', () => {
    it('writes a wolf result when the Seer checks a wolf', () => {
      const ctx = createGame(SEER_TEMPLATE, createAssignment(SEER_TEMPLATE));
      expect(executeStepsUntil(ctx, 'seerCheck', { wolf: null })).toBe(true);

      submitActionOrThrow(ctx, 0, { kind: 'target', target: 1 }, 'seer checks wolf');

      expect(ctx.getGameState().nightState?.slice.records.seerCheck?.bySeat[0]?.result).toEqual({
        kind: 'factionCheck',
        chosenSeat: 1,
        landingSeat: 1,
        faction: 'wolf',
      });
    });

    it('writes a good result when the Seer checks a villager', () => {
      const ctx = createGame(SEER_TEMPLATE, createAssignment(SEER_TEMPLATE));
      expect(executeStepsUntil(ctx, 'seerCheck', { wolf: null })).toBe(true);

      submitActionOrThrow(ctx, 0, { kind: 'target', target: 2 }, 'seer checks villager');

      expect(ctx.getGameState().nightState?.slice.records.seerCheck?.bySeat[0]?.result).toEqual({
        kind: 'factionCheck',
        chosenSeat: 2,
        landingSeat: 2,
        faction: 'good',
      });
    });

    it('marks a self-check unavailable and rejects a forged submission', () => {
      const ctx = createGame(SEER_TEMPLATE, createAssignment(SEER_TEMPLATE));
      expect(executeStepsUntil(ctx, 'seerCheck', { wolf: null })).toBe(true);

      const step = getWerewolfViewModel(ctx.getGameState(), { seat: 0, isHost: true }).step;
      const action = step?.actions.find((candidate) => candidate.kind === 'pickSeats');
      expect(
        action?.kind === 'pickSeats' && action.seats.find((option) => option.seat === 0),
      ).toEqual({
        seat: 0,
        unavailableReason: '不能选择自己',
      });
      expect(dispatchStep(ctx, 0, { actionKey: 'seerCheck', seats: [0] })).toMatchObject({
        kind: 'rejected',
        reason: REASON_STEP_STALE,
      });
    });
  });

  it('accepts the canonical skip command without writing a reveal', () => {
    const ctx = createGame(SEER_TEMPLATE, createAssignment(SEER_TEMPLATE));
    expect(executeStepsUntil(ctx, 'seerCheck', { wolf: null })).toBe(true);

    submitActionOrThrow(ctx, 0, { kind: 'skip' }, 'seer skips');

    expect(ctx.getGameState().nightState?.slice.records.seerCheck?.bySeat[0]?.result).toBeNull();
  });

  describe('Nightmare block', () => {
    it('rejects a blocked Seer target action', () => {
      const ctx = createGame(NIGHTMARE_SEER_TEMPLATE, createAssignment(NIGHTMARE_SEER_TEMPLATE));
      submitActionOrThrow(ctx, 0, { kind: 'target', target: 2 }, 'nightmare blocks seer');
      expect(ctx.getGameState().nightState?.facts.disabledAbilities).toContainEqual({
        roleId: '*',
        seat: 2,
      });
      expect(executeStepsUntil(ctx, 'seerCheck', { wolf: null })).toBe(true);

      const step = getWerewolfViewModel(ctx.getGameState(), { seat: 2, isHost: false }).step;
      expect(step?.actions.find((action) => action.key === 'seerCheck')?.availability).toEqual({
        kind: 'unavailable',
        reason: '被噩梦之影恐惧，本夜无法使用技能',
      });
      expect(dispatchStep(ctx, 2, { actionKey: 'seerCheck', seats: [1] })).toMatchObject({
        kind: 'rejected',
        reason: REASON_STEP_STALE,
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
