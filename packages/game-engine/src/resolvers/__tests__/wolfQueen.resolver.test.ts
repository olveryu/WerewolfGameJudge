/**
 * Wolf Queen Charm Resolver Unit Tests
 *
 * Tests for wolfQueenCharmResolver validation and resolution logic.
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { ActionInput, ResolverContext } from '@werewolf/game-engine/resolvers/types';
import { wolfQueenCharmResolver } from '@werewolf/game-engine/resolvers/wolfQueen';

// =============================================================================
// Test Helpers
// =============================================================================

function createContext(overrides: Partial<ResolverContext> = {}): ResolverContext {
  const defaultPlayers = new Map<number, RoleId>([
    [1, 'wolfQueen'],
    [2, 'villager'],
    [3, 'wolf'],
    [4, 'seer'],
    [5, 'witch'],
  ]);

  return {
    actorSeat: 1,
    actorRoleId: 'wolfQueen',
    players: defaultPlayers,
    currentNightResults: {},
    gameState: { isNight1: true },
    ...overrides,
  };
}

function createInput(target: number | undefined | null): ActionInput {
  return {
    schemaId: 'wolfQueenCharm',
    target: target ?? undefined,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('wolfQueenCharmResolver', () => {
  describe('skip (no target)', () => {
    it('should allow skip with undefined target', () => {
      const result = wolfQueenCharmResolver(createContext(), createInput(undefined));
      expect(result).toEqual({ valid: true, result: {} });
    });

    it('should allow skip with null target', () => {
      const result = wolfQueenCharmResolver(createContext(), createInput(null));
      expect(result).toEqual({ valid: true, result: {} });
    });
  });

  describe('valid charm', () => {
    it('should charm a valid non-self target', () => {
      const result = wolfQueenCharmResolver(createContext(), createInput(2));
      expect(result.valid).toBe(true);
      expect(result.result).toEqual({ charmTarget: 2 });
    });
  });

  describe('constraint violations', () => {
    it('should reject targeting self', () => {
      const result = wolfQueenCharmResolver(createContext(), createInput(1));
      expect(result.valid).toBe(false);
      expect(result.rejectReason).toBeDefined();
    });

    it('should reject targeting non-existent player', () => {
      const result = wolfQueenCharmResolver(createContext(), createInput(99));
      expect(result.valid).toBe(false);
    });
  });
});
