/**
 * Magician Resolver Unit Tests
 *
 * Tests for magicianSwapResolver validation and resolution logic.
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { ActionInput, ResolverContext } from '@werewolf/game-engine/resolvers/types';

import { magicianSwapResolver } from '@/services/night/resolvers/magician';

// =============================================================================
// Test Helpers
// =============================================================================

function createContext(overrides: Partial<ResolverContext> = {}): ResolverContext {
  const defaultPlayers = new Map<number, RoleId>([
    [0, 'villager'],
    [1, 'villager'],
    [2, 'wolf'],
    [3, 'wolf'],
    [4, 'magician'],
    [5, 'seer'],
  ]);

  return {
    actorSeat: 4,
    actorRoleId: 'magician',
    players: defaultPlayers,
    currentNightResults: {},
    gameState: { isNight1: true },
    ...overrides,
  };
}

function createInput(targets: number[] | undefined): ActionInput {
  return {
    schemaId: 'magicianSwap',
    targets,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('magicianSwapResolver', () => {
  describe('validate', () => {
    it('应该接受跳过（空目标）', () => {
      const ctx = createContext();
      const input = createInput(undefined);

      const result = magicianSwapResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });

    it('应该接受跳过（空数组）', () => {
      const ctx = createContext();
      const input = createInput([]);

      const result = magicianSwapResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });

    it('应该拒绝只选一个目标', () => {
      const ctx = createContext();
      const input = createInput([0]);

      const result = magicianSwapResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('两名');
    });

    it('应该拒绝选三个目标', () => {
      const ctx = createContext();
      const input = createInput([0, 1, 2]);

      const result = magicianSwapResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('两名');
    });

    it('应该拒绝不存在的目标', () => {
      const ctx = createContext();
      const input = createInput([0, 99]);

      const result = magicianSwapResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('不存在');
    });

    it('应该拒绝选择同一个玩家', () => {
      const ctx = createContext();
      const input = createInput([1, 1]);

      const result = magicianSwapResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('同一个');
    });

    it('应该接受两个有效目标', () => {
      const ctx = createContext();
      const input = createInput([0, 2]);

      const result = magicianSwapResolver(ctx, input);

      expect(result.valid).toBe(true);
    });
  });

  describe('resolve', () => {
    it('交换时应该返回交换目标', () => {
      const ctx = createContext();
      const input = createInput([0, 2]);

      const result = magicianSwapResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.swapTargets).toEqual([0, 2]);
    });

    it('交换时应该更新 swappedSeats', () => {
      const ctx = createContext();
      const input = createInput([0, 2]);

      const result = magicianSwapResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.updates?.swappedSeats).toEqual([0, 2]);
    });

    it('魔术师可以交换包括自己', () => {
      const ctx = createContext();
      const input = createInput([4, 2]); // seat 4 is magician

      const result = magicianSwapResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.swapTargets).toEqual([4, 2]);
    });
  });

  describe('nightmare block', () => {
    // NOTE: Nightmare block guard is now handled at actionHandler layer (single-point guard).
    // Resolver no longer rejects blocked actions - it only validates business rules.
    // Block guard tests are in actionHandler.test.ts.
    it('被梦魇封锁时 resolver 不再拒绝（由 handler 层统一处理）', () => {
      const ctx = createContext({
        currentNightResults: { blockedSeat: 4 }, // magician is blocked
      });
      const input = createInput([0, 2]);

      const result = magicianSwapResolver(ctx, input);

      // Resolver returns valid; handler layer will reject
      expect(result.valid).toBe(true);
    });

    it('被梦魇封锁时可以跳过', () => {
      const ctx = createContext({
        currentNightResults: { blockedSeat: 4 }, // magician is blocked
      });
      const input = createInput(undefined);

      const result = magicianSwapResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });
  });
});
