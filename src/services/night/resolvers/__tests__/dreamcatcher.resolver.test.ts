/**
 * Dreamcatcher Resolver Unit Tests
 *
 * Tests for dreamcatcherDreamResolver validation and resolution logic.
 */

import type { RoleId } from '@/models/roles';
import { dreamcatcherDreamResolver } from '@/services/night/resolvers/dreamcatcher';
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
    [5, 'dreamcatcher'],
  ]);

  return {
    actorSeat: 5,
    actorRoleId: 'dreamcatcher',
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
    schemaId: 'dreamcatcherDream',
    target,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('dreamcatcherDreamResolver', () => {
  describe('validation', () => {
    it('应该允许跳过 (undefined 目标, schema.canSkip: true)', () => {
      const ctx = createContext();
      const input = createInput(undefined);

      const result = dreamcatcherDreamResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });
  });

  describe('dream action', () => {
    it('应该接受摄梦其他玩家', () => {
      const ctx = createContext();
      const input = createInput(0);

      const result = dreamcatcherDreamResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.dreamTarget).toBe(0);
      expect(result.updates?.dreamingSeat).toBe(0);
    });

    it('应该接受摄梦狼人', () => {
      const ctx = createContext();
      const input = createInput(2);

      const result = dreamcatcherDreamResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.dreamTarget).toBe(2);
    });
  });

  describe('constraint: notSelf', () => {
    it('不能摄梦自己 (notSelf constraint)', () => {
      const ctx = createContext();
      const input = createInput(5); // self

      const result = dreamcatcherDreamResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toBeDefined();
    });
  });

  describe('nightmare block', () => {
    // NOTE: Nightmare block guard is now at actionHandler layer.
    // The resolver itself does NOT reject blocked actions.
    // These tests verify resolver behavior when invoked directly (skip returns empty result)

    it('被梦魇封锁时跳过返回空结果', () => {
      const ctx = createContext({
        currentNightResults: { blockedSeat: 5 },
      });
      const input = createInput(undefined);

      const result = dreamcatcherDreamResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });
  });
});
