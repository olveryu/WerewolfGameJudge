/**
 * Thief Resolver Unit Tests
 *
 * Validates bottom card selection logic:
 * - Must choose a card (canSkip=false)
 * - If wolf exists in bottom cards, must choose wolf
 * - Corrupt server context fails fast
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/domain/models/roles';
import { thiefChooseResolver } from '@game-judge/game-engine/games/werewolf/domain/resolvers/thief';
import type {
  ActionInput,
  ResolverContext,
} from '@game-judge/game-engine/games/werewolf/domain/resolvers/types';

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
    gameState: { isNight1: true, isWolfVoteUnanimityRequired: false },
    bottomCardContext: { bottomCards, actorSeat: 0 },
    ...overrides,
    rng: overrides?.rng ?? (() => 0.75),
  };
}

function createInput(cardIndex?: number): ActionInput {
  return {
    schemaId: 'thiefChoose',
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
  });

  it('should allow skip when blocked by nightmare', () => {
    const ctx = createContext(['seer', 'hunter'], {
      currentNightResults: { blockedSeat: 0 },
    });
    const result = thiefChooseResolver(ctx, createInput());
    expect(result.valid).toBe(true);
  });

  it('fails fast when bottomCardContext is missing', () => {
    const ctx = createContext(['seer', 'hunter'], { bottomCardContext: undefined });
    expect(() => thiefChooseResolver(ctx, createInput(0))).toThrow(
      '[FAIL-FAST] Thief resolver requires bottomCardContext',
    );
  });

  it('fails fast when the server provides the wrong deck size', () => {
    const ctx = createContext(['seer']);
    expect(() => thiefChooseResolver(ctx, createInput(0))).toThrow(
      '[FAIL-FAST] Thief requires 2 bottom cards, received 1',
    );
  });
});
