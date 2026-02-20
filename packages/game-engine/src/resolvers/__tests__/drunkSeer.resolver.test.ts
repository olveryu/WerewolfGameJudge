/**
 * DrunkSeer Resolver Unit Tests
 *
 * Tests for drunkSeerCheckResolver validation and randomized resolution logic.
 * drunkSeer check results are RANDOM: 50% correct, 50% inverted.
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import { drunkSeerCheckResolver } from '@werewolf/game-engine/resolvers/drunkSeer';
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
    [4, 'drunkSeer'],
    [5, 'witch'],
  ]);

  return {
    actorSeat: 4,
    actorRoleId: 'drunkSeer',
    players: defaultPlayers,
    currentNightResults: {},
    gameState: { isNight1: true },
    ...overrides,
  };
}

function createInput(target: number | null | undefined): ActionInput {
  return {
    schemaId: 'drunkSeerCheck',
    target: target as number | undefined,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('drunkSeerCheckResolver', () => {
  describe('validate', () => {
    it('应该允许跳过 (null 目标)', () => {
      const ctx = createContext();
      const input = createInput(null);

      const result = drunkSeerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });

    it('应该允许跳过 (undefined 目标)', () => {
      const ctx = createContext();
      const input = createInput(undefined);

      const result = drunkSeerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });

    it('应该拒绝不存在的目标', () => {
      const ctx = createContext();
      const input = createInput(99);

      const result = drunkSeerCheckResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('不存在');
    });

    it('应该接受有效的其他玩家目标', () => {
      const ctx = createContext();
      const input = createInput(2);

      const result = drunkSeerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
    });
  });

  describe('resolve (random results)', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('Math.random >= 0.5 时查验狼人应返回"狼人"（正确）', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
      const ctx = createContext();
      const input = createInput(2); // seat 2 is wolf

      const result = drunkSeerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.checkResult).toBe('狼人');
    });

    it('Math.random < 0.5 时查验狼人应返回"好人"（反转）', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.49);
      const ctx = createContext();
      const input = createInput(2); // seat 2 is wolf

      const result = drunkSeerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.checkResult).toBe('好人');
    });

    it('Math.random >= 0.5 时查验好人应返回"好人"（正确）', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.8);
      const ctx = createContext();
      const input = createInput(0); // seat 0 is villager

      const result = drunkSeerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.checkResult).toBe('好人');
    });

    it('Math.random < 0.5 时查验好人应返回"狼人"（反转）', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.1);
      const ctx = createContext();
      const input = createInput(0); // seat 0 is villager

      const result = drunkSeerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.checkResult).toBe('狼人');
    });

    it('查验女巫时随机正确应返回"好人"', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.99);
      const ctx = createContext();
      const input = createInput(5); // seat 5 is witch (good)

      const result = drunkSeerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.checkResult).toBe('好人');
    });

    it('查验白狼王时随机正确应返回"狼人"', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.7);
      const players = new Map<number, RoleId>([
        [0, 'villager'],
        [1, 'wolfKing'],
        [2, 'drunkSeer'],
      ]);
      const ctx = createContext({ players, actorSeat: 2 });
      const input = createInput(1);

      const result = drunkSeerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.checkResult).toBe('狼人');
    });

    it('查验白狼王时随机反转应返回"好人"', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.3);
      const players = new Map<number, RoleId>([
        [0, 'villager'],
        [1, 'wolfKing'],
        [2, 'drunkSeer'],
      ]);
      const ctx = createContext({ players, actorSeat: 2 });
      const input = createInput(1);

      const result = drunkSeerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.checkResult).toBe('好人');
    });

    it('边界值：Math.random = 0 时应反转', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0);
      const ctx = createContext();
      const input = createInput(2); // wolf

      const result = drunkSeerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.checkResult).toBe('好人'); // wolf inverted = 好人
    });

    it('边界值：Math.random = 1 时应正确', () => {
      jest.spyOn(Math, 'random').mockReturnValue(1);
      const ctx = createContext();
      const input = createInput(2); // wolf

      const result = drunkSeerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.checkResult).toBe('狼人'); // wolf correct = 狼人
    });
  });

  describe('magician swap interaction', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('魔术师交换后应查验交换后的角色（随机正确时）', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
      // Seat 0: villager (被交换到 seat 2), Seat 2: wolf (被交换到 seat 0)
      const players = new Map<number, RoleId>([
        [0, 'villager'],
        [1, 'magician'],
        [2, 'wolf'],
        [3, 'drunkSeer'],
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

      const result = drunkSeerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      // wolf after swap, correct = '狼人'
      expect(result.result?.checkResult).toBe('狼人');
    });

    it('魔术师交换后应查验交换后的角色（随机反转时）', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.1);
      const players = new Map<number, RoleId>([
        [0, 'villager'],
        [1, 'magician'],
        [2, 'wolf'],
        [3, 'drunkSeer'],
      ]);
      const ctx = createContext({
        players,
        actorSeat: 3,
        currentNightResults: {
          swappedSeats: [0, 2],
        },
      });
      const input = createInput(0);

      const result = drunkSeerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      // wolf after swap, inverted = '好人'
      expect(result.result?.checkResult).toBe('好人');
    });
  });

  describe('nightmare block', () => {
    it('被梦魇封锁时 resolver 不再拒绝（由 handler 层统一处理）', () => {
      const ctx = createContext({
        currentNightResults: { blockedSeat: 4 }, // drunkSeer is blocked
      });
      const input = createInput(2);

      const result = drunkSeerCheckResolver(ctx, input);

      // Resolver returns valid; handler layer will reject
      expect(result.valid).toBe(true);
    });

    it('被梦魇封锁时可以跳过', () => {
      const ctx = createContext({
        currentNightResults: { blockedSeat: 4 }, // drunkSeer is blocked
      });
      const input = createInput(undefined);

      const result = drunkSeerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });
  });
});
