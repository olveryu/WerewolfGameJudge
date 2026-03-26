/**
 * Avenger Resolver Unit Tests
 *
 * Tests for avengerConfirmResolver validation logic.
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import { avengerConfirmResolver } from '@werewolf/game-engine/resolvers/avenger';
import type { ActionInput, ResolverContext } from '@werewolf/game-engine/resolvers/types';

// =============================================================================
// Test Helpers
// =============================================================================

function createContext(overrides: Partial<ResolverContext> = {}): ResolverContext {
  const defaultPlayers = new Map<number, RoleId>([
    [0, 'villager'],
    [1, 'wolf'],
    [2, 'shadow'],
    [3, 'avenger'],
  ]);

  return {
    actorSeat: 3,
    actorRoleId: 'avenger',
    players: defaultPlayers,
    currentNightResults: {},
    gameState: { isNight1: true },
    ...overrides,
  };
}

function createInput(confirmed?: boolean): ActionInput {
  return {
    schemaId: 'avengerConfirm',
    confirmed,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('avengerConfirmResolver', () => {
  it('确认行动始终有效', () => {
    const ctx = createContext();
    const input = createInput(true);

    const result = avengerConfirmResolver(ctx, input);

    expect(result.valid).toBe(true);
    expect(result.result).toEqual({});
  });

  it('无确认标记时也有效', () => {
    const ctx = createContext();
    const input = createInput(undefined);

    const result = avengerConfirmResolver(ctx, input);

    expect(result.valid).toBe(true);
  });
});
