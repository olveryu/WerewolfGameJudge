/**
 * Piper Resolver Unit Tests
 *
 * Tests for piperHypnotizeResolver validation and resolution logic.
 * Covers: multi-target selection, constraint enforcement, duplicate rejection,
 * already-hypnotized rejection, and cumulative hypnotizedSeats merging.
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import { piperHypnotizeResolver } from '@werewolf/game-engine/resolvers/piper';
import type { ActionInput, ResolverContext } from '@werewolf/game-engine/resolvers/types';

// =============================================================================
// Test Helpers
// =============================================================================

function createContext(overrides: Partial<ResolverContext> = {}): ResolverContext {
  const defaultPlayers = new Map<number, RoleId>([
    [0, 'villager'],
    [1, 'villager'],
    [2, 'wolf'],
    [3, 'seer'],
    [4, 'witch'],
    [5, 'piper'],
  ]);

  return {
    actorSeat: 5,
    actorRoleId: 'piper',
    players: defaultPlayers,
    currentNightResults: {},
    gameState: { isNight1: true },
    ...overrides,
  };
}

function createInput(targets?: readonly number[]): ActionInput {
  return {
    schemaId: 'piperHypnotize',
    targets,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('piperHypnotizeResolver', () => {
  describe('validation', () => {
    it('应该接受跳过（canSkip: true）', () => {
      const ctx = createContext();
      const input = createInput(undefined);

      const result = piperHypnotizeResolver(ctx, input);

      expect(result.valid).toBe(true);
    });

    it('应该接受空目标数组（skip）', () => {
      const ctx = createContext();
      const input = createInput([]);

      const result = piperHypnotizeResolver(ctx, input);

      expect(result.valid).toBe(true);
    });

    it('应该拒绝超过最大目标数', () => {
      const ctx = createContext();
      const input = createInput([0, 1, 2]);

      const result = piperHypnotizeResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('1-2');
    });

    it('应该拒绝重复目标', () => {
      const ctx = createContext();
      const input = createInput([0, 0]);

      const result = piperHypnotizeResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('重复');
    });

    it('应该拒绝选择自己（NotSelf 约束）', () => {
      const ctx = createContext();
      const input = createInput([5]);

      const result = piperHypnotizeResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('自己');
    });

    it('应该拒绝不存在的目标玩家', () => {
      const ctx = createContext();
      const input = createInput([99]);

      const result = piperHypnotizeResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('不存在');
    });

    it('应该拒绝已被催眠的目标', () => {
      const ctx = createContext({
        gameState: { isNight1: false, hypnotizedSeats: [0] },
      });
      const input = createInput([0]);

      const result = piperHypnotizeResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('已被催眠');
    });
  });

  describe('hypnotize action', () => {
    it('应该接受选择 1 名目标', () => {
      const ctx = createContext();
      const input = createInput([0]);

      const result = piperHypnotizeResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.hypnotizedTargets).toEqual([0]);
      expect(result.updates?.hypnotizedSeats).toEqual([0]);
    });

    it('应该接受选择 2 名目标', () => {
      const ctx = createContext();
      const input = createInput([0, 3]);

      const result = piperHypnotizeResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.hypnotizedTargets).toEqual([0, 3]);
      expect(result.updates?.hypnotizedSeats).toEqual([0, 3]);
    });

    it('应该累积合并已有的 hypnotizedSeats', () => {
      const ctx = createContext({
        gameState: { isNight1: false, hypnotizedSeats: [1] },
      });
      const input = createInput([0, 3]);

      const result = piperHypnotizeResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.updates?.hypnotizedSeats).toEqual([0, 1, 3]); // sorted, merged
    });

    it('应该允许选择狼人（无 NotWolfFaction 约束）', () => {
      const ctx = createContext();
      const input = createInput([2]); // wolf at seat 2

      const result = piperHypnotizeResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.hypnotizedTargets).toEqual([2]);
    });
  });
});
