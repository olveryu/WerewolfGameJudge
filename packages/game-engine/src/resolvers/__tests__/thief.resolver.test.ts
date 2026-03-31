/**
 * Thief Resolver Unit Tests
 *
 * Validates bottom card selection logic:
 * - Must choose a card (canSkip=false)
 * - If wolf exists in bottom cards, must choose wolf
 * - Sets bottomCardStepRoles to all bottom cards (matching treasureMaster behavior)
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import { thiefChooseResolver } from '@werewolf/game-engine/resolvers/thief';
import type { ActionInput, ResolverContext } from '@werewolf/game-engine/resolvers/types';

// =============================================================================
// Helpers
// =============================================================================

function createContext(
  bottomCards: readonly RoleId[],
  overrides: Partial<ResolverContext> = {},
): ResolverContext {
  return {
    actorSeat: 0,
    actorRoleId: 'thief',
    players: new Map<number, RoleId>([
      [0, 'thief'],
      [1, 'seer'],
      [2, 'wolf'],
    ]),
    currentNightResults: {},
    gameState: { isNight1: true },
    bottomCardContext: { bottomCards, actorSeat: 0 },
    ...overrides,
  };
}

function createInput(cardIndex?: number): ActionInput {
  return {
    schemaId: 'thiefChoose' as ActionInput['schemaId'],
    cardIndex,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('thiefChooseResolver', () => {
  it('should reject when no card selected', () => {
    const ctx = createContext(['seer', 'hunter']);
    const result = thiefChooseResolver(ctx, createInput());
    expect(result.valid).toBe(false);
    expect(result.rejectReason).toContain('必须选择');
  });

  it('should accept valid card selection', () => {
    const ctx = createContext(['seer', 'hunter']);
    const result = thiefChooseResolver(ctx, createInput(0));
    expect(result.valid).toBe(true);
    expect(result.updates?.thiefChosenCard).toBe('seer');
    expect(result.updates?.bottomCardStepRoles).toEqual(['seer', 'hunter']);
  });

  it('should reject out-of-range index', () => {
    const ctx = createContext(['seer', 'hunter']);
    const result = thiefChooseResolver(ctx, createInput(2));
    expect(result.valid).toBe(false);
    expect(result.rejectReason).toContain('无效');
  });

  it('should reject choosing non-wolf when wolf exists', () => {
    const ctx = createContext(['wolf', 'seer']);
    const result = thiefChooseResolver(ctx, createInput(1)); // choosing seer
    expect(result.valid).toBe(false);
    expect(result.rejectReason).toContain('狼人');
  });

  it('should accept choosing wolf when wolf exists', () => {
    const ctx = createContext(['wolf', 'seer']);
    const result = thiefChooseResolver(ctx, createInput(0)); // choosing wolf
    expect(result.valid).toBe(true);
    expect(result.updates?.thiefChosenCard).toBe('wolf');
    expect(result.updates?.bottomCardStepRoles).toEqual(['wolf', 'seer']);
  });

  it('should allow skip when blocked by nightmare', () => {
    const ctx = createContext(['seer', 'hunter'], {
      currentNightResults: { blockedSeat: 0 },
    });
    const result = thiefChooseResolver(ctx, createInput());
    expect(result.valid).toBe(true);
  });
});
