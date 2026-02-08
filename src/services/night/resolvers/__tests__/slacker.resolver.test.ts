/**
 * Slacker Resolver Unit Tests
 *
 * Tests for slackerChooseIdolResolver validation and resolution logic.
 */

import { slackerChooseIdolResolver } from '@/services/night/resolvers/slacker';
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
    [3, 'wolf'],
    [4, 'seer'],
    [5, 'slacker'],
  ]);

  return {
    actorSeat: 5,
    actorRoleId: 'slacker',
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
    schemaId: 'slackerChooseIdol',
    target,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('slackerChooseIdolResolver', () => {
  describe('validation', () => {
    it('应该拒绝缺少目标', () => {
      const ctx = createContext();
      const input = createInput(undefined);

      const result = slackerChooseIdolResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('必须选择');
    });

    it('应该拒绝不存在的目标玩家', () => {
      const ctx = createContext();
      const input = createInput(99);

      const result = slackerChooseIdolResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('不存在');
    });
  });

  describe('choose idol action', () => {
    it('应该接受选择村民为榜样', () => {
      const ctx = createContext();
      const input = createInput(0);

      const result = slackerChooseIdolResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.idolTarget).toBe(0);
    });

    it('应该接受选择神职为榜样', () => {
      const ctx = createContext();
      const input = createInput(4); // seer

      const result = slackerChooseIdolResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.idolTarget).toBe(4);
    });

    it('应该接受选择狼人为榜样', () => {
      const ctx = createContext();
      const input = createInput(2); // wolf

      const result = slackerChooseIdolResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.idolTarget).toBe(2);
    });
  });

  describe('constraint: notSelf', () => {
    it('不能选自己为榜样 (notSelf constraint)', () => {
      const ctx = createContext();
      const input = createInput(5); // self

      const result = slackerChooseIdolResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toBeDefined();
    });
  });

  describe('nightmare block', () => {
    // NOTE: Nightmare block guard for non-skip actions is now handled at actionHandler layer.
    // Slacker resolver only handles the special case: blocked + skip is allowed (even though canSkip=false).
    it('被梦魇封锁时 resolver 不再拒绝非跳过行动（由 handler 层统一处理）', () => {
      const ctx = createContext({
        currentNightResults: { blockedSeat: 5 },
      });
      const input = createInput(0);

      const result = slackerChooseIdolResolver(ctx, input);

      // Resolver returns valid; handler layer will reject
      expect(result.valid).toBe(true);
    });

    it('被梦魇封锁时可以跳过（特殊规则：虽然 canSkip=false，但被 block 时允许 skip）', () => {
      const ctx = createContext({
        currentNightResults: { blockedSeat: 5 },
      });
      const input = createInput(undefined);

      const result = slackerChooseIdolResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });
  });
});
