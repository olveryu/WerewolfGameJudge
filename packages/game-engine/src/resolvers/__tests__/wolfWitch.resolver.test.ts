/**
 * WolfWitch Resolver Unit Tests
 *
 * Tests for wolfWitchCheckResolver validation and resolution logic.
 * Includes notWolfFaction constraint verification.
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { ActionInput, ResolverContext } from '@werewolf/game-engine/resolvers/types';
import { wolfWitchCheckResolver } from '@werewolf/game-engine/resolvers/wolfWitch';

// =============================================================================
// Test Helpers
// =============================================================================

function createContext(overrides: Partial<ResolverContext> = {}): ResolverContext {
  const defaultPlayers = new Map<number, RoleId>([
    [0, 'villager'],
    [1, 'seer'],
    [2, 'wolf'],
    [3, 'wolfKing'],
    [4, 'wolfWitch'],
    [5, 'witch'],
  ]);

  return {
    actorSeat: 4,
    actorRoleId: 'wolfWitch',
    players: defaultPlayers,
    currentNightResults: {},
    gameState: { isNight1: true },
    ...overrides,
  };
}

function createInput(target: number | null | undefined): ActionInput {
  return {
    schemaId: 'wolfWitchCheck',
    target: target as number | undefined,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('wolfWitchCheckResolver', () => {
  describe('validate', () => {
    it('应该允许跳过 (null 目标, schema.canSkip: true)', () => {
      const ctx = createContext();
      const input = createInput(null);

      const result = wolfWitchCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });

    it('应该允许跳过 (undefined 目标, schema.canSkip: true)', () => {
      const ctx = createContext();
      const input = createInput(undefined);

      const result = wolfWitchCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });

    it('应该拒绝不存在的目标', () => {
      const ctx = createContext();
      const input = createInput(99);

      const result = wolfWitchCheckResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('不存在');
    });

    it('应该接受有效的非狼阵营玩家目标', () => {
      const ctx = createContext();
      const input = createInput(0); // villager — non-wolf

      const result = wolfWitchCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
    });
  });

  describe('notWolfFaction constraint', () => {
    it('应该拒绝狼人阵营目标 (wolf)', () => {
      const ctx = createContext();
      const input = createInput(2); // seat 2 is wolf

      const result = wolfWitchCheckResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('狼人阵营');
    });

    it('应该拒绝狼人阵营目标 (wolfKing)', () => {
      const ctx = createContext();
      const input = createInput(3); // seat 3 is wolfKing

      const result = wolfWitchCheckResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('狼人阵营');
    });

    it('应该拒绝查验自己 (wolfWitch 自身是狼阵营)', () => {
      const ctx = createContext({ actorSeat: 4 });
      const input = createInput(4); // self = wolfWitch = wolf faction

      const result = wolfWitchCheckResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('狼人阵营');
    });

    it('应该允许查验非狼阵营目标 (villager)', () => {
      const ctx = createContext();
      const input = createInput(0); // seat 0 is villager

      const result = wolfWitchCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
    });

    it('应该允许查验非狼阵营目标 (seer)', () => {
      const ctx = createContext();
      const input = createInput(1); // seat 1 is seer

      const result = wolfWitchCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
    });
  });

  describe('resolve', () => {
    it('查验村民应该返回 villager', () => {
      const ctx = createContext();
      const input = createInput(0); // seat 0 is villager

      const result = wolfWitchCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.identityResult).toBe('villager');
    });

    it('查验预言家应该返回 seer', () => {
      const ctx = createContext();
      const input = createInput(1); // seat 1 is seer

      const result = wolfWitchCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.identityResult).toBe('seer');
    });

    it('查验女巫应该返回 witch', () => {
      const ctx = createContext();
      const input = createInput(5); // seat 5 is witch

      const result = wolfWitchCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.identityResult).toBe('witch');
    });
  });

  describe('nightmare block', () => {
    // NOTE: Nightmare block guard is now handled at actionHandler layer (single-point guard).
    // Resolver no longer rejects blocked actions - it only validates business rules.
    // Block guard tests are in actionHandler.test.ts.
    it('被梦魇封锁时 resolver 不再拒绝（由 handler 层统一处理）', () => {
      const ctx = createContext({
        currentNightResults: { blockedSeat: 4 }, // wolfWitch is blocked
      });
      const input = createInput(0);

      const result = wolfWitchCheckResolver(ctx, input);

      // Resolver returns valid; handler layer will reject
      expect(result.valid).toBe(true);
    });

    it('被梦魇封锁时可以跳过', () => {
      const ctx = createContext({
        currentNightResults: { blockedSeat: 4 }, // wolfWitch is blocked
      });
      const input = createInput(undefined);

      const result = wolfWitchCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });

    it('未被封锁时应该正常返回结果', () => {
      const ctx = createContext({
        currentNightResults: { blockedSeat: 0 }, // someone else is blocked
      });
      const input = createInput(0);

      const result = wolfWitchCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.identityResult).toBe('villager');
    });
  });
});
