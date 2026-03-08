/**
 * Awakened Gargoyle Resolver Unit Tests
 *
 * Tests for awakenedGargoyleConvertResolver validation and resolution logic.
 * Covers: mandatory convert (canSkip: false), constraint enforcement
 * (NotSelf, NotWolfFaction, AdjacentToWolfFaction), and convertReveal no-op.
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import {
  awakenedGargoyleConvertResolver,
  awakenedGargoyleConvertRevealResolver,
} from '@werewolf/game-engine/resolvers/awakenedGargoyle';
import type { ActionInput, ResolverContext } from '@werewolf/game-engine/resolvers/types';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * 6-player circular seating: 0-1-2-3-4-5-0
 * Seat 4: awakenedGargoyle (wolf faction)
 * Seat 2: wolf
 * Adjacent to seat 4: seats 3 and 5
 * Adjacent to seat 2: seats 1 and 3
 * Adjacent to wolf faction (seats 2,4): seats 1, 3, 5
 */
function createContext(overrides: Partial<ResolverContext> = {}): ResolverContext {
  const defaultPlayers = new Map<number, RoleId>([
    [0, 'villager'],
    [1, 'villager'],
    [2, 'wolf'],
    [3, 'seer'],
    [4, 'awakenedGargoyle'],
    [5, 'guard'],
  ]);

  return {
    actorSeat: 4,
    actorRoleId: 'awakenedGargoyle',
    players: defaultPlayers,
    currentNightResults: {},
    gameState: { isNight1: true },
    ...overrides,
  };
}

function createInput(target: number | null | undefined): ActionInput {
  return {
    schemaId: 'awakenedGargoyleConvert',
    target: target as number | undefined,
  };
}

// =============================================================================
// Tests — awakenedGargoyleConvertResolver
// =============================================================================

describe('awakenedGargoyleConvertResolver', () => {
  describe('mandatory convert (canSkip: false)', () => {
    it('应该拒绝 null 目标（强制发动）', () => {
      const ctx = createContext();
      const input = createInput(null);

      const result = awakenedGargoyleConvertResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('必须');
    });

    it('应该拒绝 undefined 目标（强制发动）', () => {
      const ctx = createContext();
      const input = createInput(undefined);

      const result = awakenedGargoyleConvertResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('必须');
    });
  });

  describe('constraint validation', () => {
    it('应该拒绝转化自己 (NotSelf)', () => {
      const ctx = createContext({ actorSeat: 4 });
      const input = createInput(4);

      const result = awakenedGargoyleConvertResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('自己');
    });

    it('应该拒绝转化狼人阵营玩家 (NotWolfFaction)', () => {
      const ctx = createContext();
      const input = createInput(2); // wolf at seat 2, adjacent to gargoyle via seat 3

      const result = awakenedGargoyleConvertResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('狼人阵营');
    });

    it('应该拒绝转化不与狼人阵营相邻的玩家 (AdjacentToWolfFaction)', () => {
      const ctx = createContext();
      // Seat 0: villager, adjacent to seats 5 and 1
      // Seat 5 is guard (non-wolf), seat 1 is villager (non-wolf)
      // But seat 5 is adjacent to gargoyle (seat 4), so seat 5 IS adjacent to wolf faction
      // Seat 0 is adjacent to seat 5 (non-wolf) and seat 1 (non-wolf)
      // Wolf faction is at seats 2 and 4. Seat 0 is adjacent to seats 5 and 1 — neither is wolf faction.
      // Wait: in circular 6-player, seat 0 is adjacent to seats 5 and 1.
      // Seat 5 is guard (not wolf faction). Seat 1 is villager (not wolf faction).
      // So seat 0 is NOT adjacent to wolf faction.
      const input = createInput(0);

      const result = awakenedGargoyleConvertResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('相邻');
    });

    it('应该拒绝不存在的目标', () => {
      const ctx = createContext();
      const input = createInput(99);

      const result = awakenedGargoyleConvertResolver(ctx, input);

      expect(result.valid).toBe(false);
    });
  });

  describe('valid convert', () => {
    it('应该接受转化与狼人阵营相邻的非狼玩家', () => {
      const ctx = createContext();
      // Seat 3: seer, adjacent to gargoyle (seat 4) and wolf (seat 2) — valid target
      const input = createInput(3);

      const result = awakenedGargoyleConvertResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.updates).toEqual({ convertedSeat: 3 });
      expect(result.result).toEqual({ convertTarget: 3 });
    });

    it('应该接受转化另一侧与觉醒石像鬼相邻的玩家', () => {
      const ctx = createContext();
      // Seat 5: guard, adjacent to gargoyle (seat 4) — valid target
      const input = createInput(5);

      const result = awakenedGargoyleConvertResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.updates).toEqual({ convertedSeat: 5 });
      expect(result.result).toEqual({ convertTarget: 5 });
    });

    it('应该接受转化与普通狼人相邻的玩家', () => {
      const ctx = createContext();
      // Seat 1: villager, adjacent to wolf (seat 2) — valid target
      const input = createInput(1);

      const result = awakenedGargoyleConvertResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.updates).toEqual({ convertedSeat: 1 });
      expect(result.result).toEqual({ convertTarget: 1 });
    });
  });
});

// =============================================================================
// Tests — awakenedGargoyleConvertRevealResolver
// =============================================================================

describe('awakenedGargoyleConvertRevealResolver', () => {
  it('confirmed = true → valid', () => {
    const ctx = createContext();
    const input: ActionInput = { schemaId: 'awakenedGargoyleConvertReveal', confirmed: true };

    const result = awakenedGargoyleConvertRevealResolver(ctx, input);

    expect(result.valid).toBe(true);
  });

  it('no confirmation → still valid (no-op)', () => {
    const ctx = createContext();
    const input: ActionInput = { schemaId: 'awakenedGargoyleConvertReveal' };

    const result = awakenedGargoyleConvertRevealResolver(ctx, input);

    expect(result.valid).toBe(true);
  });
});
