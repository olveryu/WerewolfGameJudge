/**
 * TreasureMaster Resolver Unit Tests
 *
 * Validates card selection (wolf-faction cards rejected),
 * skip handling (nightmare block), context invariants, and invalid index rejection.
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/domain/models/roles';
import type {
  ActionInput,
  ResolverContext,
} from '@game-judge/game-engine/games/werewolf/domain/resolvers/types';

import { getBottomCardCountForRole } from '../../models/BottomCards';
import { treasureMasterChooseResolver } from '../treasureMaster';

// =============================================================================
// Helpers
// =============================================================================

const BOTTOM_CARDS: readonly RoleId[] = ['seer', 'wolf', 'villager'];

function createPlayers(): ReadonlyMap<number, RoleId> {
  return new Map<number, RoleId>([
    [0, 'treasureMaster'],
    [1, 'wolf'],
    [2, 'villager'],
  ]);
}

function createContext(overrides: Partial<ResolverContext> = {}): ResolverContext {
  return {
    actorSeat: 0,
    actorRoleId: 'treasureMaster',
    players: createPlayers(),
    currentNightResults: {},
    gameState: { isNight1: true, isWolfVoteUnanimityRequired: false },
    bottomCardContext: {
      bottomCards: BOTTOM_CARDS,
      actorSeat: 0,
    },
    ...overrides,
    rng: overrides?.rng ?? (() => 0.75),
  };
}

function createInput(cardIndex?: number | null): ActionInput {
  return {
    schemaId: 'treasureMasterChoose',
    cardIndex: cardIndex ?? undefined,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('treasureMasterChooseResolver', () => {
  it('should accept valid non-wolf card selection', () => {
    const ctx = createContext();
    const result = treasureMasterChooseResolver(ctx, createInput(0)); // seer
    expect(result.valid).toBe(true);
    expect(result.updates?.treasureMasterChosenCard).toBe('seer');
  });

  it('should accept villager card selection', () => {
    const ctx = createContext();
    const result = treasureMasterChooseResolver(ctx, createInput(2)); // villager
    expect(result.valid).toBe(true);
    expect(result.updates?.treasureMasterChosenCard).toBe('villager');
  });

  it('should reject wolf-faction card selection', () => {
    const ctx = createContext();
    const result = treasureMasterChooseResolver(ctx, createInput(1)); // wolf
    expect(result.valid).toBe(false);
    expect(result.rejectReason).toBe('不可选择狼人阵营底牌');
  });

  it('should reject cardIndex out of range (negative)', () => {
    const ctx = createContext();
    const result = treasureMasterChooseResolver(ctx, createInput(-1));
    expect(result.valid).toBe(false);
    expect(result.rejectReason).toBe('无效的卡牌索引');
  });

  it('should reject cardIndex out of range (too large)', () => {
    const ctx = createContext();
    const result = treasureMasterChooseResolver(
      ctx,
      createInput(getBottomCardCountForRole('treasureMaster')),
    );
    expect(result.valid).toBe(false);
    expect(result.rejectReason).toBe('无效的卡牌索引');
  });

  it('should reject non-integer cardIndex', () => {
    const ctx = createContext();
    const result = treasureMasterChooseResolver(ctx, createInput(1.5));
    expect(result.valid).toBe(false);
    expect(result.rejectReason).toBe('无效的卡牌索引');
  });

  it('should reject skip (cardIndex undefined) when not blocked', () => {
    const ctx = createContext();
    const result = treasureMasterChooseResolver(ctx, createInput());
    expect(result.valid).toBe(false);
    expect(result.rejectReason).toBe('必须选择一张底牌');
  });

  it('should reject skip (cardIndex null) when not blocked', () => {
    const ctx = createContext();
    const result = treasureMasterChooseResolver(ctx, createInput(null));
    expect(result.valid).toBe(false);
    expect(result.rejectReason).toBe('必须选择一张底牌');
  });

  it('should allow skip when blocked by nightmare', () => {
    const ctx = createContext({
      currentNightResults: { blockedSeat: 0 },
    });
    const result = treasureMasterChooseResolver(ctx, createInput());
    expect(result.valid).toBe(true);
    expect(result.updates).toBeUndefined();
  });

  it('fails fast when bottomCardContext is missing', () => {
    const ctx = createContext({ bottomCardContext: undefined });
    expect(() => treasureMasterChooseResolver(ctx, createInput(0))).toThrow(
      '[FAIL-FAST] Treasure master resolver requires bottomCardContext',
    );
  });
});
