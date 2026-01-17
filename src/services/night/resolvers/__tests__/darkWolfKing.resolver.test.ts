/**
 * Dark Wolf King Resolver Unit Tests
 *
 * Tests for darkWolfKingConfirmResolver validation logic.
 */

import { darkWolfKingConfirmResolver } from '../darkWolfKing';
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
    [3, 'darkWolfKing'],
  ]);

  return {
    actorSeat: 3,
    actorRoleId: 'darkWolfKing',
    players: defaultPlayers,
    currentNightResults: {},
    gameState: { isNight1: true },
    ...overrides,
  };
}

function createInput(confirmed?: boolean): ActionInput {
  return {
    schemaId: 'darkWolfKingConfirm',
    confirmed,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('darkWolfKingConfirmResolver', () => {
  describe('validate', () => {
    it('应该接受确认行动', () => {
      const ctx = createContext();
      const input = createInput(true);

      const result = darkWolfKingConfirmResolver(ctx, input);

      expect(result.valid).toBe(true);
    });

    it('应该接受未确认行动', () => {
      const ctx = createContext();
      const input = createInput(false);

      const result = darkWolfKingConfirmResolver(ctx, input);

      expect(result.valid).toBe(true);
    });

    it('应该接受无确认值', () => {
      const ctx = createContext();
      const input = createInput(undefined);

      const result = darkWolfKingConfirmResolver(ctx, input);

      expect(result.valid).toBe(true);
    });
  });

  describe('result', () => {
    it('应该返回空结果', () => {
      const ctx = createContext();
      const input = createInput(true);

      const result = darkWolfKingConfirmResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });
  });
});
