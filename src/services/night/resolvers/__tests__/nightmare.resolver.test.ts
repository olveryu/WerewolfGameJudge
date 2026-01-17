/**
 * Nightmare Resolver Unit Tests
 *
 * Tests for nightmareBlockResolver validation and resolution logic.
 *
 * IMPORTANT: If nightmare blocks a wolf, wolves cannot kill that night.
 */

import { nightmareBlockResolver } from '../nightmare';
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
    [5, 'nightmare'],
  ]);

  return {
    actorSeat: 5,
    actorRoleId: 'nightmare',
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
    schemaId: 'nightmareBlock',
    target,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('nightmareBlockResolver', () => {
  describe('validation', () => {
    it('应该拒绝缺少目标 (undefined)', () => {
      const ctx = createContext();
      const input = createInput(undefined);

      const result = nightmareBlockResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('必须选择');
    });

    it('应该拒绝不存在的目标玩家', () => {
      const ctx = createContext();
      const input = createInput(99);

      const result = nightmareBlockResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('不存在');
    });
  });

  describe('block action', () => {
    it('应该接受封锁村民', () => {
      const ctx = createContext();
      const input = createInput(0);

      const result = nightmareBlockResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.blockedTarget).toBe(0);
      expect(result.updates?.blockedSeat).toBe(0);
    });

    it('应该接受封锁神职 (预言家)', () => {
      const ctx = createContext();
      const input = createInput(4);

      const result = nightmareBlockResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.blockedTarget).toBe(4);
    });
  });

  describe('wolf block rule (封锁狼人 → 狼刀禁用)', () => {
    it('封锁狼人时应该禁用狼刀', () => {
      const ctx = createContext();
      const input = createInput(2); // block wolf

      const result = nightmareBlockResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.blockedTarget).toBe(2);
      expect(result.updates?.wolfKillDisabled).toBe(true);
    });

    it('封锁非狼人时不应禁用狼刀', () => {
      const ctx = createContext();
      const input = createInput(0); // block villager

      const result = nightmareBlockResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.updates?.wolfKillDisabled).toBeUndefined();
    });
  });

  describe('updates', () => {
    it('封锁时应该更新 blockedSeat', () => {
      const ctx = createContext();
      const input = createInput(1);

      const result = nightmareBlockResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.updates?.blockedSeat).toBe(1);
    });
  });
});
