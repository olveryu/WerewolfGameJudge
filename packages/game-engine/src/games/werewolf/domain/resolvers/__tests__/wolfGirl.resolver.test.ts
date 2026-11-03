/**
 * Wolf Girl Resolver Unit Tests
 *
 * Tests for the generic resolver wired to the Wolf Girl step
 * (wolfGirlConfess writeSlot) and the wolfGirlConfessReveal no-op resolver.
 * Covers: mandatory confession (canSkip: false), constraint enforcement
 * (NotSelf, NotWolfFaction), the single-slot write, and the reveal no-op.
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/domain/models/roles';
import { createGenericResolver } from '@game-judge/game-engine/games/werewolf/domain/resolvers/genericResolver';
import type {
  ActionInput,
  ResolverContext,
} from '@game-judge/game-engine/games/werewolf/domain/resolvers/types';
import { wolfGirlConfessRevealResolver } from '@game-judge/game-engine/games/werewolf/domain/resolvers/wolfGirl';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * 6-player seating:
 * Seat 0: villager (civilian confession target)
 * Seat 1: seer (god confession target)
 * Seat 2: wolf
 * Seat 3: wolf
 * Seat 4: wolfGirl (actor)
 * Seat 5: guard (god confession target)
 */
function createContext(overrides: Partial<ResolverContext> = {}): ResolverContext {
  const defaultPlayers = new Map<number, RoleId>([
    [0, 'villager'],
    [1, 'seer'],
    [2, 'wolf'],
    [3, 'wolf'],
    [4, 'wolfGirl'],
    [5, 'guard'],
  ]);

  return {
    actorSeat: 4,
    actorRoleId: 'wolfGirl',
    players: defaultPlayers,
    currentNightResults: {},
    gameState: { isNight1: true, isWolfVoteUnanimityRequired: false },
    ...overrides,
    rng: overrides?.rng ?? (() => 0.75),
  };
}

function createInput(target: number | null | undefined, confirmed?: boolean): ActionInput {
  return {
    schemaId: 'wolfGirlConfess',
    target: target as number | undefined,
    confirmed,
  };
}

const confessResolver = createGenericResolver('wolfGirl');

// =============================================================================
// Tests — wolfGirlConfess (generic writeSlot resolver, the role's only ability)
// =============================================================================

describe('wolfGirlConfess resolver', () => {
  it('accepts a civilian target and writes only the confession slot', () => {
    const result = confessResolver(createContext(), createInput(0));
    expect(result.valid).toBe(true);
    expect(result.updates).toEqual({ wolfGirlConfessedSeat: 0 });
  });

  it('accepts a god target and writes only the confession slot', () => {
    const result = confessResolver(createContext(), createInput(1));
    expect(result.valid).toBe(true);
    expect(result.updates).toEqual({ wolfGirlConfessedSeat: 1 });
  });

  it('rejects confessing herself (NotSelf)', () => {
    const result = confessResolver(createContext(), createInput(4));
    expect(result.valid).toBe(false);
    expect(result.rejectReason).toBeDefined();
  });

  it('rejects confessing a wolf teammate (NotWolfFaction)', () => {
    const result = confessResolver(createContext(), createInput(2));
    expect(result.valid).toBe(false);
    expect(result.rejectReason).toBeDefined();
  });

  it('rejects a missing target: confession is mandatory', () => {
    const result = confessResolver(createContext(), createInput(undefined));
    expect(result.valid).toBe(false);
  });

  it('rejects a nonexistent target seat', () => {
    const result = confessResolver(createContext(), createInput(99));
    expect(result.valid).toBe(false);
  });

  it('allows a skip only when nightmare-blocked (generic exception)', () => {
    const ctx = createContext({ currentNightResults: { blockedSeat: 4 } });
    const result = confessResolver(ctx, createInput(undefined));
    expect(result.valid).toBe(true);
  });
});

// =============================================================================
// Tests — wolfGirlConfessRevealResolver (no-op)
// =============================================================================

describe('wolfGirlConfessRevealResolver', () => {
  it('is valid when the player confirms they saw the confession status', () => {
    const ctx = createContext();
    const input: ActionInput = { schemaId: 'wolfGirlConfessReveal', confirmed: true };
    const result = wolfGirlConfessRevealResolver(ctx, input);
    expect(result.valid).toBe(true);
  });

  it('is a valid no-op without confirmation (step is managed by handler)', () => {
    const ctx = createContext();
    const input: ActionInput = { schemaId: 'wolfGirlConfessReveal' };
    const result = wolfGirlConfessRevealResolver(ctx, input);
    expect(result.valid).toBe(true);
  });
});
