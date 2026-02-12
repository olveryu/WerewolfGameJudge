/**
 * Seer Resolver Unit Tests
 *
 * Tests for seerCheckResolver validation and resolution logic.
 */

import type { RoleId } from '@/models/roles';
import { seerCheckResolver } from '@/services/night/resolvers/seer';
import type { ActionInput, ResolverContext } from '@/services/night/resolvers/types';

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
    actorSeat: 4,
    actorRoleId: 'seer',
    players: defaultPlayers,
    currentNightResults: {},
    gameState: { isNight1: true },
    ...overrides,
  };
}

function createInput(target: number | null | undefined): ActionInput {
  return {
    schemaId: 'seerCheck',
    target: target as number | undefined,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('seerCheckResolver', () => {
  describe('validate', () => {
    it('应该允许跳过 (null 目标, schema.canSkip: true)', () => {
      const ctx = createContext();
      const input = createInput(null);

      const result = seerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });

    it('应该允许跳过 (undefined 目标, schema.canSkip: true)', () => {
      const ctx = createContext();
      const input = createInput(undefined);

      const result = seerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });

    it('应该允许查验自己 (no notSelf constraint - neutral judge)', () => {
      const ctx = createContext({ actorSeat: 4 });
      const input = createInput(4);

      const result = seerCheckResolver(ctx, input);

      // Seer can check self, result should show their own team
      expect(result.valid).toBe(true);
    });

    it('应该拒绝不存在的目标', () => {
      const ctx = createContext();
      const input = createInput(99);

      const result = seerCheckResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('不存在');
    });

    it('应该接受有效的其他玩家目标', () => {
      const ctx = createContext();
      const input = createInput(2);

      const result = seerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
    });
  });

  describe('resolve', () => {
    it('查验狼人应该返回"狼人"', () => {
      const ctx = createContext();
      const input = createInput(2); // seat 2 is wolf

      const result = seerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.checkResult).toBe('狼人');
    });

    it('查验好人应该返回"好人"', () => {
      const ctx = createContext();
      const input = createInput(0); // seat 0 is villager

      const result = seerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.checkResult).toBe('好人');
    });

    it('查验女巫应该返回"好人"', () => {
      const ctx = createContext();
      const input = createInput(5); // seat 5 is witch

      const result = seerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.checkResult).toBe('好人');
    });

    it('查验白狼王应该返回"狼人"', () => {
      const players = new Map<number, RoleId>([
        [0, 'villager'],
        [1, 'wolfKing'],
        [2, 'seer'],
      ]);
      const ctx = createContext({ players, actorSeat: 2 });
      const input = createInput(1);

      const result = seerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.checkResult).toBe('狼人');
    });

    it('查验狼美人应该返回"狼人"', () => {
      const players = new Map<number, RoleId>([
        [0, 'villager'],
        [1, 'wolfQueen'],
        [2, 'seer'],
      ]);
      const ctx = createContext({ players, actorSeat: 2 });
      const input = createInput(1);

      const result = seerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.checkResult).toBe('狼人');
    });
  });

  describe('nightmare block', () => {
    // NOTE: Nightmare block guard is now handled at actionHandler layer (single-point guard).
    // Resolver no longer rejects blocked actions - it only validates business rules.
    // Block guard tests are in actionHandler.test.ts.
    it('被梦魇封锁时 resolver 不再拒绝（由 handler 层统一处理）', () => {
      const ctx = createContext({
        currentNightResults: { blockedSeat: 4 }, // seer is blocked
      });
      const input = createInput(2);

      const result = seerCheckResolver(ctx, input);

      // Resolver returns valid; handler layer will reject
      expect(result.valid).toBe(true);
    });

    it('被梦魇封锁时可以跳过', () => {
      const ctx = createContext({
        currentNightResults: { blockedSeat: 4 }, // seer is blocked
      });
      const input = createInput(undefined);

      const result = seerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });

    it('未被封锁时应该正常返回结果', () => {
      const ctx = createContext({
        currentNightResults: { blockedSeat: 0 }, // someone else is blocked
      });
      const input = createInput(2);

      const result = seerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.checkResult).toBe('狼人');
    });
  });
});
