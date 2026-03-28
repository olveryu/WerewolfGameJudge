/**
 * Crow Resolver Unit Tests
 *
 * Validates that the crow genericResolver writes cursedSeat correctly,
 * honors NotSelf constraint, and handles skip / non-existent target.
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import { createGenericResolver } from '@werewolf/game-engine/resolvers/genericResolver';
import type { ActionInput, ResolverContext } from '@werewolf/game-engine/resolvers/types';

// =============================================================================
// Helpers
// =============================================================================

function createPlayers(): ReadonlyMap<number, RoleId> {
  return new Map<number, RoleId>([
    [0, 'crow'],
    [1, 'seer'],
    [2, 'wolf'],
    [3, 'villager'],
    [4, 'hunter'],
  ]);
}

function createContext(overrides: Partial<ResolverContext> = {}): ResolverContext {
  return {
    actorSeat: 0,
    actorRoleId: 'crow' as RoleId,
    players: createPlayers(),
    currentNightResults: {},
    gameState: { isNight1: true },
    ...overrides,
  };
}

function createInput(target?: number | null): ActionInput {
  return {
    schemaId: 'crowCurse' as ActionInput['schemaId'],
    target: target ?? undefined,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('genericResolver: crow (cursedSeat)', () => {
  const resolver = createGenericResolver('crow');

  it('should accept valid target and write cursedSeat', () => {
    const ctx = createContext();
    const result = resolver(ctx, createInput(3));
    expect(result.valid).toBe(true);
    expect(result.updates?.cursedSeat).toBe(3);
    expect(result.result?.curseTarget).toBe(3);
  });

  it('should reject self-target (NotSelf constraint)', () => {
    const ctx = createContext();
    const result = resolver(ctx, createInput(0));
    expect(result.valid).toBe(false);
    expect(result.rejectReason).toBe('不能选择自己');
  });

  it('should allow skip (target=undefined)', () => {
    const ctx = createContext();
    const result = resolver(ctx, createInput());
    expect(result.valid).toBe(true);
    expect(result.updates).toBeUndefined();
  });

  it('should allow skip (target=null)', () => {
    const ctx = createContext();
    const result = resolver(ctx, createInput(null));
    expect(result.valid).toBe(true);
  });

  it('should reject non-existent target', () => {
    const ctx = createContext();
    const result = resolver(ctx, createInput(99));
    expect(result.valid).toBe(false);
    expect(result.rejectReason).toBe('目标玩家不存在');
  });
});
