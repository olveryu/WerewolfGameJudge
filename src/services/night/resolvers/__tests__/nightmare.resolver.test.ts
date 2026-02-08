/**
 * Nightmare Resolver Unit Tests
 *
 * Tests for nightmareBlockResolver validation and resolution logic.
 *
 * IMPORTANT: If nightmare blocks ANY wolf (team='wolf'), wolves cannot kill that night.
 *            This includes ALL wolf-faction roles: gargoyle, wolfRobot, etc.
 */

import { nightmareBlockResolver } from '@/services/night/resolvers/nightmare';
import type { ResolverContext, ActionInput } from '@/services/night/resolvers/types';
import type { RoleId } from '@/models/roles';

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
    [6, 'gargoyle'],
    [7, 'wolfRobot'],
    [8, 'wolfQueen'],
    [9, 'darkWolfKing'],
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
    it('应该允许跳过 (undefined 目标, schema.canSkip: true)', () => {
      const ctx = createContext();
      const input = createInput(undefined);

      const result = nightmareBlockResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
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

  describe('wolf block rule: ANY wolf (team=wolf) triggers wolfKillDisabled', () => {
    // ALL wolf-faction roles trigger wolfKillDisabled
    describe('所有狼阵营角色 (team=wolf) → 触发禁刀', () => {
      it('封锁 wolf 时应该禁用狼刀', () => {
        const ctx = createContext();
        const input = createInput(2); // block wolf

        const result = nightmareBlockResolver(ctx, input);

        expect(result.valid).toBe(true);
        expect(result.result?.blockedTarget).toBe(2);
        expect(result.updates?.wolfKillDisabled).toBe(true);
      });

      it('封锁 nightmare (梦魇自己也是狼) 时应该禁用狼刀', () => {
        const ctx = createContext();
        const input = createInput(5); // block nightmare (self)

        const result = nightmareBlockResolver(ctx, input);

        expect(result.valid).toBe(true);
        expect(result.updates?.wolfKillDisabled).toBe(true);
      });

      it('封锁 wolfQueen 时应该禁用狼刀', () => {
        const ctx = createContext();
        const input = createInput(8); // block wolfQueen

        const result = nightmareBlockResolver(ctx, input);

        expect(result.valid).toBe(true);
        expect(result.updates?.wolfKillDisabled).toBe(true);
      });

      it('封锁 darkWolfKing 时应该禁用狼刀', () => {
        const ctx = createContext();
        const input = createInput(9); // block darkWolfKing

        const result = nightmareBlockResolver(ctx, input);

        expect(result.valid).toBe(true);
        expect(result.updates?.wolfKillDisabled).toBe(true);
      });

      it('封锁 gargoyle 时也应该禁用狼刀 (任意狼阵营)', () => {
        const ctx = createContext();
        const input = createInput(6); // block gargoyle

        const result = nightmareBlockResolver(ctx, input);

        expect(result.valid).toBe(true);
        expect(result.result?.blockedTarget).toBe(6);
        expect(result.updates?.wolfKillDisabled).toBe(true);
      });

      it('封锁 wolfRobot 时也应该禁用狼刀 (任意狼阵营)', () => {
        const ctx = createContext();
        const input = createInput(7); // block wolfRobot

        const result = nightmareBlockResolver(ctx, input);

        expect(result.valid).toBe(true);
        expect(result.result?.blockedTarget).toBe(7);
        expect(result.updates?.wolfKillDisabled).toBe(true);
      });
    });

    // Non-wolves → do NOT trigger wolfKillDisabled
    describe('非狼阵营 → 不触发禁刀', () => {
      it('封锁村民时不应禁用狼刀', () => {
        const ctx = createContext();
        const input = createInput(0); // block villager

        const result = nightmareBlockResolver(ctx, input);

        expect(result.valid).toBe(true);
        expect(result.updates?.wolfKillDisabled).toBeUndefined();
      });

      it('封锁预言家时不应禁用狼刀', () => {
        const ctx = createContext();
        const input = createInput(4); // block seer

        const result = nightmareBlockResolver(ctx, input);

        expect(result.valid).toBe(true);
        expect(result.updates?.wolfKillDisabled).toBeUndefined();
      });
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
