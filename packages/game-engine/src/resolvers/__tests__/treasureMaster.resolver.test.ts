/**
 * TreasureMaster Resolver Unit Tests
 *
 * Validates card selection, wolf-faction rejection, effectiveTeam computation,
 * skip handling (nightmare block), and invalid index rejection.
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import { Team } from '@werewolf/game-engine/models/roles/spec/types';
import { BOTTOM_CARD_COUNT } from '@werewolf/game-engine/models/Template';
import type { ActionInput, ResolverContext } from '@werewolf/game-engine/resolvers/types';

import { computeEffectiveTeam, treasureMasterChooseResolver } from '../treasureMaster';

// =============================================================================
// Helpers
// =============================================================================

const BOTTOM_CARDS: readonly RoleId[] = ['seer' as RoleId, 'wolf' as RoleId, 'villager' as RoleId];

function createPlayers(): ReadonlyMap<number, RoleId> {
  return new Map<number, RoleId>([
    [0, 'treasureMaster' as RoleId],
    [1, 'wolf' as RoleId],
    [2, 'villager' as RoleId],
  ]);
}

function createContext(overrides: Partial<ResolverContext> = {}): ResolverContext {
  return {
    actorSeat: 0,
    actorRoleId: 'treasureMaster' as RoleId,
    players: createPlayers(),
    currentNightResults: {},
    gameState: { isNight1: true },
    bottomCardContext: {
      bottomCards: BOTTOM_CARDS,
      actorSeat: 0,
    },
    ...overrides,
  };
}

function createInput(cardIndex?: number | null): ActionInput {
  return {
    schemaId: 'treasureMasterChoose' as ActionInput['schemaId'],
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
    expect(result.updates?.effectiveTeam).toBe(Team.Wolf); // bottom cards contain wolf
    expect(result.updates?.bottomCardStepRoles).toEqual(['seer', 'wolf', 'villager']);
  });

  it('should accept villager card selection', () => {
    const ctx = createContext();
    const result = treasureMasterChooseResolver(ctx, createInput(2)); // villager
    expect(result.valid).toBe(true);
    expect(result.updates?.treasureMasterChosenCard).toBe('villager');
  });

  it('should reject wolf-faction card', () => {
    const ctx = createContext();
    const result = treasureMasterChooseResolver(ctx, createInput(1)); // wolf
    expect(result.valid).toBe(false);
    expect(result.rejectReason).toBe('不能选择狼人阵营的卡牌');
  });

  it('should reject cardIndex out of range (negative)', () => {
    const ctx = createContext();
    const result = treasureMasterChooseResolver(ctx, createInput(-1));
    expect(result.valid).toBe(false);
    expect(result.rejectReason).toBe('无效的卡牌索引');
  });

  it('should reject cardIndex out of range (too large)', () => {
    const ctx = createContext();
    const result = treasureMasterChooseResolver(ctx, createInput(BOTTOM_CARD_COUNT));
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

  it('should reject when missing bottomCardContext', () => {
    const ctx = createContext({ bottomCardContext: undefined });
    const result = treasureMasterChooseResolver(ctx, createInput(0));
    expect(result.valid).toBe(false);
    expect(result.rejectReason).toBe('缺少盗宝大师上下文');
  });
});

describe('computeEffectiveTeam', () => {
  it('should return Team.Wolf when bottom cards contain wolf', () => {
    expect(computeEffectiveTeam(BOTTOM_CARDS)).toBe(Team.Wolf);
  });

  it('should return Team.Good when 2+ god cards (no wolf)', () => {
    const cards: RoleId[] = ['seer' as RoleId, 'guard' as RoleId, 'villager' as RoleId];
    expect(computeEffectiveTeam(cards)).toBe(Team.Good);
  });

  it('should return Team.Good when 2+ villager cards (no wolf)', () => {
    const cards: RoleId[] = ['villager' as RoleId, 'villager' as RoleId, 'seer' as RoleId];
    expect(computeEffectiveTeam(cards)).toBe(Team.Good);
  });

  it('should return Team.Good for mixed composition (no wolf)', () => {
    const cards: RoleId[] = ['seer' as RoleId, 'villager' as RoleId, 'slacker' as RoleId];
    expect(computeEffectiveTeam(cards)).toBe(Team.Good);
  });
});
