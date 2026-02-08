/**
 * Gargoyle Resolver Unit Tests
 *
 * Tests for gargoyleCheckResolver validation and resolution logic.
 */

import { gargoyleCheckResolver } from '@/services/night/resolvers/gargoyle';
import type { ResolverContext, ActionInput } from '@/services/night/resolvers/types';
import type { RoleId } from '@/models/roles/spec/specs';

// =============================================================================
// Test Helpers
// =============================================================================

function createContext(overrides: Partial<ResolverContext> = {}): ResolverContext {
  const defaultPlayers = new Map<number, RoleId>([
    [0, 'villager'],
    [1, 'villager'],
    [2, 'wolf'],
    [3, 'wolfKing'],
    [4, 'gargoyle'],
    [5, 'witch'],
  ]);

  return {
    actorSeat: 4,
    actorRoleId: 'gargoyle',
    players: defaultPlayers,
    currentNightResults: {},
    gameState: { isNight1: true },
    ...overrides,
  };
}

function createInput(target: number | null | undefined): ActionInput {
  return {
    schemaId: 'gargoyleCheck',
    target: target as number | undefined,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('gargoyleCheckResolver', () => {
  describe('validate', () => {
    it('应该允许跳过 (null 目标, schema.canSkip: true)', () => {
      const ctx = createContext();
      const input = createInput(null);

      const result = gargoyleCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });

    it('应该允许跳过 (undefined 目标, schema.canSkip: true)', () => {
      const ctx = createContext();
      const input = createInput(undefined);

      const result = gargoyleCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });

    it('应该允许查验自己 (no notSelf constraint - neutral judge)', () => {
      const ctx = createContext({ actorSeat: 4 });
      const input = createInput(4);

      const result = gargoyleCheckResolver(ctx, input);

      // Gargoyle can check self, result should show their own role
      expect(result.valid).toBe(true);
    });

    it('应该拒绝不存在的目标', () => {
      const ctx = createContext();
      const input = createInput(99);

      const result = gargoyleCheckResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('不存在');
    });

    it('应该接受有效的其他玩家目标', () => {
      const ctx = createContext();
      const input = createInput(2);

      const result = gargoyleCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
    });
  });

  describe('resolve', () => {
    it('查验狼人应该返回具体角色 wolf', () => {
      const ctx = createContext();
      const input = createInput(2); // seat 2 is wolf

      const result = gargoyleCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.identityResult).toBe('wolf');
    });

    it('查验白狼王应该返回 wolfKing', () => {
      const ctx = createContext();
      const input = createInput(3); // seat 3 is wolfKing

      const result = gargoyleCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.identityResult).toBe('wolfKing');
    });

    it('查验村民应该返回 villager', () => {
      const ctx = createContext();
      const input = createInput(0); // seat 0 is villager

      const result = gargoyleCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.identityResult).toBe('villager');
    });

    it('查验女巫应该返回 witch', () => {
      const ctx = createContext();
      const input = createInput(5); // seat 5 is witch

      const result = gargoyleCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.identityResult).toBe('witch');
    });
  });

  describe('nightmare block', () => {
    // NOTE: Nightmare block guard is now at actionHandler layer.
    // The resolver itself does NOT reject blocked actions.
    // These tests verify resolver behavior when invoked directly (skip allowed, target returns empty result)

    it('被梦魇封锁时跳过返回空结果', () => {
      const ctx = createContext({
        currentNightResults: { blockedSeat: 4 }, // gargoyle is blocked
      });
      const input = createInput(undefined);

      const result = gargoyleCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });

    it('未被封锁时应该正常返回结果', () => {
      const ctx = createContext({
        currentNightResults: { blockedSeat: 0 }, // someone else is blocked
      });
      const input = createInput(2);

      const result = gargoyleCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.identityResult).toBe('wolf');
    });
  });
});
