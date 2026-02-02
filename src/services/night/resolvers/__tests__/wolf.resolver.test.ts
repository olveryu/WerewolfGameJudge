/**
 * Wolf Kill Resolver Unit Tests
 *
 * Tests for wolfKillResolver validation and resolution logic.
 *
 * IMPORTANT: Wolf kill is NEUTRAL JUDGE - wolves can target ANY seat
 * including self or wolf teammates.
 */

import { wolfKillResolver } from '../wolf';
import type { ResolverContext, ActionInput } from '../types';
import type { RoleId } from '../../../../models/roles/spec/specs';

// =============================================================================
// Test Helpers
// =============================================================================

function createContext(overrides: Partial<ResolverContext> = {}): ResolverContext {
  const defaultPlayers = new Map<number, RoleId>([
    [0, 'villager'],
    [1, 'villager'],
    [2, 'wolf'],
    [3, 'wolf'],
    [4, 'seer'],
    [5, 'witch'],
  ]);

  return {
    actorSeat: 2,
    actorRoleId: 'wolf',
    players: defaultPlayers,
    currentNightResults: {},
    gameState: {
      isNight1: true,
    },
    ...overrides,
  };
}

function createInput(target: number | undefined): ActionInput {
  return {
    schemaId: 'wolfKill',
    target,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('wolfKillResolver', () => {
  describe('validation', () => {
    it('应该允许空刀 (target = undefined)，与 schema allowEmptyVote 对齐', () => {
      const ctx = createContext();
      const input = createInput(undefined);

      const result = wolfKillResolver(ctx, input);

      // 空刀是允许的 (schema.meeting.allowEmptyVote: true)
      expect(result.valid).toBe(true);
      expect(result.result).toEqual({}); // No kill target
    });

    it('应该拒绝不存在的目标玩家', () => {
      const ctx = createContext();
      const input = createInput(99); // seat 99 doesn't exist

      const result = wolfKillResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('不存在');
    });
  });

  describe('neutral judge (狼人可刀任意目标)', () => {
    it('应该接受刀村民', () => {
      const ctx = createContext();
      const input = createInput(0); // villager

      const result = wolfKillResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.updates?.wolfVotesBySeat?.['2']).toBe(0);
    });

    it('应该接受刀神职 (预言家)', () => {
      const ctx = createContext();
      const input = createInput(4); // seer

      const result = wolfKillResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.updates?.wolfVotesBySeat?.['2']).toBe(4);
    });

    it('狼人可以刀自己（neutral judge: 不限制 self）', () => {
      const ctx = createContext();
      const input = createInput(2); // wolf kills self

      const result = wolfKillResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.updates?.wolfVotesBySeat?.['2']).toBe(2);
    });

    it('狼人可以刀狼队友（neutral judge: 不限制 team）', () => {
      const ctx = createContext();
      const input = createInput(3); // wolf kills other wolf

      const result = wolfKillResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.updates?.wolfVotesBySeat?.['2']).toBe(3);
    });
  });

  describe('wolfKillDisabled', () => {
    it('狼刀被禁用时提交非空投票应该被拒绝', () => {
      const ctx = createContext({
        currentNightResults: { wolfKillDisabled: true },
      });
      const input = createInput(0);

      const result = wolfKillResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toBeDefined();
    });

    it('狼刀被禁用时可以空刀', () => {
      const ctx = createContext({
        currentNightResults: { wolfKillDisabled: true },
      });
      const input = createInput(undefined);

      const result = wolfKillResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });
  });

  describe('updates', () => {
    it('刀人时应该更新 wolfVotesBySeat', () => {
      const ctx = createContext();
      const input = createInput(0);

      const result = wolfKillResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.updates?.wolfVotesBySeat?.['2']).toBe(0);
    });
  });
});
