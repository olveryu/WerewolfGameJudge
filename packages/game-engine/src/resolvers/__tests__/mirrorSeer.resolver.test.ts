/**
 * MirrorSeer Resolver Unit Tests
 *
 * Tests for mirrorSeerCheckResolver validation and inverted resolution logic.
 * mirrorSeer check results are INVERTED: wolves → '好人', good → '狼人'.
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import { mirrorSeerCheckResolver } from '@werewolf/game-engine/resolvers/mirrorSeer';
import type { ActionInput, ResolverContext } from '@werewolf/game-engine/resolvers/types';

// =============================================================================
// Test Helpers
// =============================================================================

function createContext(overrides: Partial<ResolverContext> = {}): ResolverContext {
  const defaultPlayers = new Map<number, RoleId>([
    [0, 'villager'],
    [1, 'villager'],
    [2, 'wolf'],
    [3, 'wolf'],
    [4, 'mirrorSeer'],
    [5, 'witch'],
  ]);

  return {
    actorSeat: 4,
    actorRoleId: 'mirrorSeer',
    players: defaultPlayers,
    currentNightResults: {},
    gameState: { isNight1: true },
    ...overrides,
  };
}

function createInput(target: number | null | undefined): ActionInput {
  return {
    schemaId: 'mirrorSeerCheck',
    target: target as number | undefined,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('mirrorSeerCheckResolver', () => {
  describe('validate', () => {
    it('应该允许跳过 (null 目标)', () => {
      const ctx = createContext();
      const input = createInput(null);

      const result = mirrorSeerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });

    it('应该允许跳过 (undefined 目标)', () => {
      const ctx = createContext();
      const input = createInput(undefined);

      const result = mirrorSeerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });

    it('应该拒绝查验自己 (notSelf constraint)', () => {
      const ctx = createContext({ actorSeat: 4 });
      const input = createInput(4);

      const result = mirrorSeerCheckResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('自己');
    });

    it('应该拒绝不存在的目标', () => {
      const ctx = createContext();
      const input = createInput(99);

      const result = mirrorSeerCheckResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('不存在');
    });

    it('应该接受有效的其他玩家目标', () => {
      const ctx = createContext();
      const input = createInput(2);

      const result = mirrorSeerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
    });
  });

  describe('resolve (inverted results)', () => {
    it('查验狼人应该返回"好人"（反转）', () => {
      const ctx = createContext();
      const input = createInput(2); // seat 2 is wolf

      const result = mirrorSeerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.checkResult).toBe('好人');
    });

    it('查验好人应该返回"狼人"（反转）', () => {
      const ctx = createContext();
      const input = createInput(0); // seat 0 is villager

      const result = mirrorSeerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.checkResult).toBe('狼人');
    });

    it('查验女巫应该返回"狼人"（反转，good team → 狼人）', () => {
      const ctx = createContext();
      const input = createInput(5); // seat 5 is witch

      const result = mirrorSeerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.checkResult).toBe('狼人');
    });

    it('查验白狼王应该返回"好人"（反转，wolf team → 好人）', () => {
      const players = new Map<number, RoleId>([
        [0, 'villager'],
        [1, 'wolfKing'],
        [2, 'mirrorSeer'],
      ]);
      const ctx = createContext({ players, actorSeat: 2 });
      const input = createInput(1);

      const result = mirrorSeerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.checkResult).toBe('好人');
    });

    it('查验狼美人应该返回"好人"（反转，wolf team → 好人）', () => {
      const players = new Map<number, RoleId>([
        [0, 'villager'],
        [1, 'wolfQueen'],
        [2, 'mirrorSeer'],
      ]);
      const ctx = createContext({ players, actorSeat: 2 });
      const input = createInput(1);

      const result = mirrorSeerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.checkResult).toBe('好人');
    });
  });

  describe('magician swap interaction', () => {
    it('魔术师交换后应查验交换后的角色（反转）', () => {
      // Seat 0: villager (被交换到 seat 2), Seat 2: wolf (被交换到 seat 0)
      const players = new Map<number, RoleId>([
        [0, 'villager'],
        [1, 'magician'],
        [2, 'wolf'],
        [3, 'mirrorSeer'],
      ]);
      const ctx = createContext({
        players,
        actorSeat: 3,
        currentNightResults: {
          swappedSeats: [0, 2],
        },
      });
      // Check seat 0 (originally villager, but swapped to wolf)
      const input = createInput(0);

      const result = mirrorSeerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      // wolf after swap → normal result '狼人' → inverted = '好人'
      expect(result.result?.checkResult).toBe('好人');
    });
  });

  describe('nightmare block', () => {
    it('被梦魇封锁时 resolver 不再拒绝（由 handler 层统一处理）', () => {
      const ctx = createContext({
        currentNightResults: { blockedSeat: 4 }, // mirrorSeer is blocked
      });
      const input = createInput(2);

      const result = mirrorSeerCheckResolver(ctx, input);

      // Resolver returns valid; handler layer will reject
      expect(result.valid).toBe(true);
    });

    it('被梦魇封锁时可以跳过', () => {
      const ctx = createContext({
        currentNightResults: { blockedSeat: 4 }, // mirrorSeer is blocked
      });
      const input = createInput(undefined);

      const result = mirrorSeerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });
  });
});
