/**
 * Guard Resolver Unit Tests
 *
 * Tests for guardProtectResolver validation and resolution logic.
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { ActionInput, ResolverContext } from '@werewolf/game-engine/resolvers/types';

import { guardProtectResolver } from '@/services/night/resolvers/guard';

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
    [5, 'guard'],
  ]);

  return {
    actorSeat: 5,
    actorRoleId: 'guard',
    players: defaultPlayers,
    currentNightResults: {},
    gameState: { isNight1: true },
    ...overrides,
  };
}

function createInput(target: number | null | undefined): ActionInput {
  return {
    schemaId: 'guardProtect',
    target: target ?? undefined,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('guardProtectResolver', () => {
  describe('skip action', () => {
    it('应该接受空行动（不守护）- undefined', () => {
      const ctx = createContext();
      const input = createInput(undefined);

      const result = guardProtectResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });

    it('应该接受空行动（不守护）- null', () => {
      const ctx = createContext();
      const input = createInput(null);

      const result = guardProtectResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });
  });

  describe('protect action', () => {
    it('应该接受守护其他玩家', () => {
      const ctx = createContext();
      const input = createInput(0); // protect villager at seat 0

      const result = guardProtectResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.guardedTarget).toBe(0);
      expect(result.updates?.guardedSeat).toBe(0);
    });

    it('守卫可以守护自己（neutral judge）', () => {
      const ctx = createContext();
      const input = createInput(5); // guard protects self

      const result = guardProtectResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.guardedTarget).toBe(5);
    });

    it('守卫可以守护狼人（neutral judge）', () => {
      const ctx = createContext();
      const input = createInput(2); // protect wolf at seat 2

      const result = guardProtectResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.guardedTarget).toBe(2);
    });
  });

  describe('nightmare block', () => {
    // NOTE: Nightmare block guard is now handled at actionHandler layer (single-point guard).
    // Resolver no longer rejects blocked actions - it only validates business rules.
    // Block guard tests are in actionHandler.test.ts.
    it('被梦魇封锁时 resolver 不再拒绝（由 handler 层统一处理）', () => {
      const ctx = createContext({
        currentNightResults: { blockedSeat: 5 }, // guard is blocked
      });
      const input = createInput(0);

      const result = guardProtectResolver(ctx, input);

      // Resolver returns valid; handler layer will reject
      expect(result.valid).toBe(true);
    });

    it('被梦魇封锁时可以跳过', () => {
      const ctx = createContext({
        currentNightResults: { blockedSeat: 5 }, // guard is blocked
      });
      const input = createInput(undefined);

      const result = guardProtectResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });
  });

  describe('updates', () => {
    it('守护时应该更新 guardedSeat', () => {
      const ctx = createContext();
      const input = createInput(1);

      const result = guardProtectResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.updates?.guardedSeat).toBe(1);
    });
  });
});
