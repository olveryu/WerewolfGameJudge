/**
 * Cupid Resolver Unit Tests
 *
 * Validates lover selection logic:
 * - Must choose exactly 2 targets (canSkip=false)
 * - Cannot select duplicate targets
 * - Can select self
 * - Can select self
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import {
  cupidChooseLoversResolver,
  cupidLoversRevealResolver,
} from '@werewolf/game-engine/resolvers/cupid';
import type { ActionInput, ResolverContext } from '@werewolf/game-engine/resolvers/types';

// =============================================================================
// Helpers
// =============================================================================

function createContext(overrides: Partial<ResolverContext> = {}): ResolverContext {
  return {
    actorSeat: 0,
    actorRoleId: 'cupid',
    players: new Map<number, RoleId>([
      [0, 'cupid'],
      [1, 'seer'],
      [2, 'wolf'],
      [3, 'villager'],
      [4, 'hunter'],
    ]),
    currentNightResults: {},
    gameState: { isNight1: true },
    ...overrides,
  };
}

function createInput(targets?: readonly number[]): ActionInput {
  return {
    schemaId: 'cupidChooseLovers' as ActionInput['schemaId'],
    targets,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('cupidChooseLoversResolver', () => {
  it('should reject when no targets provided', () => {
    const ctx = createContext();
    const result = cupidChooseLoversResolver(ctx, createInput());
    expect(result.valid).toBe(false);
    expect(result.rejectReason).toContain('两名');
  });

  it('should reject when only 1 target', () => {
    const ctx = createContext();
    const result = cupidChooseLoversResolver(ctx, createInput([1]));
    expect(result.valid).toBe(false);
  });

  it('should reject duplicate targets', () => {
    const ctx = createContext();
    const result = cupidChooseLoversResolver(ctx, createInput([1, 1]));
    expect(result.valid).toBe(false);
    expect(result.rejectReason).toContain('重复');
  });

  it('should accept valid pair of non-wolf players', () => {
    const ctx = createContext();
    const result = cupidChooseLoversResolver(ctx, createInput([1, 3]));
    expect(result.valid).toBe(true);
    expect(result.updates?.loverSeats).toEqual([1, 3]);
  });

  it('should allow selecting self (cupid seat)', () => {
    const ctx = createContext();
    const result = cupidChooseLoversResolver(ctx, createInput([0, 1])); // cupid + seer
    expect(result.valid).toBe(true);
    expect(result.updates?.loverSeats).toEqual([0, 1]);
  });

  it('should sort lover seats ascending', () => {
    const ctx = createContext();
    const result = cupidChooseLoversResolver(ctx, createInput([3, 1]));
    expect(result.valid).toBe(true);
    expect(result.updates?.loverSeats).toEqual([1, 3]);
  });
});

describe('cupidLoversRevealResolver', () => {
  it('should always return valid (no-op)', () => {
    const ctx = createContext();
    const result = cupidLoversRevealResolver(ctx, createInput());
    expect(result.valid).toBe(true);
  });
});
