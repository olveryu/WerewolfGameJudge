/**
 * Hunter Resolver Unit Tests
 *
 * Tests for hunterConfirmResolver validation logic.
 */

import { hunterConfirmResolver } from '@/services/night/resolvers/hunter';
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
    [4, 'hunter'],
  ]);

  return {
    actorSeat: 4,
    actorRoleId: 'hunter',
    players: defaultPlayers,
    currentNightResults: {},
    gameState: { isNight1: true },
    ...overrides,
  };
}

function createInput(confirmed?: boolean): ActionInput {
  return {
    schemaId: 'hunterConfirm',
    confirmed,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('hunterConfirmResolver', () => {
  describe('validate', () => {
    it('应该接受确认行动', () => {
      const ctx = createContext();
      const input = createInput(true);

      const result = hunterConfirmResolver(ctx, input);

      expect(result.valid).toBe(true);
    });

    it('应该接受未确认行动', () => {
      const ctx = createContext();
      const input = createInput(false);

      const result = hunterConfirmResolver(ctx, input);

      expect(result.valid).toBe(true);
    });

    it('应该接受无确认值', () => {
      const ctx = createContext();
      const input = createInput(undefined);

      const result = hunterConfirmResolver(ctx, input);

      expect(result.valid).toBe(true);
    });
  });

  describe('result', () => {
    it('应该返回空结果', () => {
      const ctx = createContext();
      const input = createInput(true);

      const result = hunterConfirmResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });
  });
});
