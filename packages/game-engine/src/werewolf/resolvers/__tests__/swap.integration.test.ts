/**
 * Swap Integration Tests
 *
 * Verifies the completeness of the swap protocol:
 * 1. Handler contract: swap input shape
 * 2. Check alignment: seer/psychic checks must use post-swap identity
 * 3. Death settlement alignment: deaths must follow swap rules
 *
 * Mandatory constraints (MUST):
 * - Only input method for swap: extra.targets: [seatA, seatB]
 * - target must be null
 * - swappedSeats is the single source of truth in WerewolfState
 */

import type { RoleSeatMap } from '@werewolf/game-engine/werewolf/DeathCalculator';
import { calculateDeaths } from '@werewolf/game-engine/werewolf/DeathCalculator';
import type { RoleId } from '@werewolf/game-engine/werewolf/models/roles';

import { RESOLVERS } from '../index';
import { magicianSwapResolver } from '../magician';
import type { ActionInput, CurrentNightResults, ResolverContext } from '../types';

const gargoyleCheckResolver = RESOLVERS.gargoyleCheck!;
const psychicCheckResolver = RESOLVERS.psychicCheck!;
const seerCheckResolver = RESOLVERS.seerCheck!;
const wolfRobotLearnResolver = RESOLVERS.wolfRobotLearn!;

/** All roles absent */
const NO_ROLES: RoleSeatMap = {
  wolfQueenLinkSeat: -1,
  dreamcatcherLinkSeat: -1,
  poisonSourceSeat: -1,
  guardProtectorSeat: -1,
  bondedLinkSeats: null,
  coupleLinkSeats: null,
  poisonImmuneSeats: [],
  reflectsDamageSeats: [],
  wolfKillSilentImmuneSeats: [],
  checkDeathTargetSeats: [],
  reflectionSources: [],
};

// =============================================================================
// Test Helpers
// =============================================================================

function createPlayers(seats: Array<[number, RoleId]>): ReadonlyMap<number, RoleId> {
  return new Map(seats);
}

function createContext(
  actorSeat: number,
  actorRoleId: RoleId,
  players: ReadonlyMap<number, RoleId>,
  currentNightResults: CurrentNightResults = {},
): ResolverContext {
  return {
    actorSeat,
    actorRoleId,
    players,
    currentNightResults,
    gameState: { isNight1: true },
  };
}

// =============================================================================
// 1. Handler Contract: Swap input shape
// =============================================================================

describe('Swap input protocol (handler contract)', () => {
  const players = createPlayers([
    [0, 'villager'],
    [1, 'wolf'],
    [2, 'seer'],
    [3, 'magician'],
  ]);

  describe('Valid input formats', () => {
    it('targets=[seatA, seatB] → successfully writes swappedSeats', () => {
      const ctx = createContext(3, 'magician', players);
      const input: ActionInput = {
        schemaId: 'magicianSwap',
        targets: [0, 1], // villager ↔ wolf
      };

      const result = magicianSwapResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.updates?.swappedSeats).toEqual([0, 1]);
    });

    it('targets=[] → skip (valid, no swappedSeats)', () => {
      const ctx = createContext(3, 'magician', players);
      const input: ActionInput = {
        schemaId: 'magicianSwap',
        targets: [],
      };

      const result = magicianSwapResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.updates).toBeUndefined();
    });

    it('targets=undefined → skip', () => {
      const ctx = createContext(3, 'magician', players);
      const input: ActionInput = {
        schemaId: 'magicianSwap',
        targets: undefined,
      };

      const result = magicianSwapResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.updates).toBeUndefined();
    });
  });

  describe('Invalid input must reject', () => {
    it('targets length != 2 → reject', () => {
      const ctx = createContext(3, 'magician', players);

      // Only 1
      const input1: ActionInput = { schemaId: 'magicianSwap', targets: [0] };
      expect(magicianSwapResolver(ctx, input1).valid).toBe(false);

      // 3
      const input3: ActionInput = { schemaId: 'magicianSwap', targets: [0, 1, 2] };
      expect(magicianSwapResolver(ctx, input3).valid).toBe(false);
    });

    it('targets contains nonexistent seat → reject', () => {
      const ctx = createContext(3, 'magician', players);
      const input: ActionInput = {
        schemaId: 'magicianSwap',
        targets: [0, 99], // seat 99 does not exist
      };

      const result = magicianSwapResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('不存在');
    });

    it('targets duplicated (same seat) → reject', () => {
      const ctx = createContext(3, 'magician', players);
      const input: ActionInput = {
        schemaId: 'magicianSwap',
        targets: [0, 0],
      };

      const result = magicianSwapResolver(ctx, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('同一个');
    });
  });
});

// =============================================================================
// 2. Check alignment: checks must use post-swap identity
// =============================================================================

describe('Check alignment (post-swap identity)', () => {
  /**
   * Scenario: A=villager, B=wolf, magician swap [A, B]
   * Expected: checking A should see B's identity (wolf)
   */

  const players = createPlayers([
    [0, 'villager'], // A
    [1, 'wolf'], // B
    [2, 'seer'],
    [3, 'psychic'],
    [4, 'gargoyle'],
    [5, 'wolfRobot'],
    [6, 'magician'],
  ]);

  const swappedSeats: readonly [number, number] = [0, 1]; // A ↔ B

  describe('Seer check', () => {
    it('post-swap check on A (originally villager) → should return wolf faction', () => {
      const ctx = createContext(2, 'seer', players, { swappedSeats });
      const input: ActionInput = {
        schemaId: 'seerCheck',
        target: 0, // check A
      };

      const result = seerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      // A is originally villager, but post-swap check should see B's identity (wolf) → '狼人'
      expect(result.result?.checkResult).toBe('狼人');
    });

    it('post-swap check on B (originally wolf) → should return good faction', () => {
      const ctx = createContext(2, 'seer', players, { swappedSeats });
      const input: ActionInput = {
        schemaId: 'seerCheck',
        target: 1, // check B
      };

      const result = seerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      // B is originally wolf, but post-swap check should see A's identity (villager) → '好人'
      expect(result.result?.checkResult).toBe('好人');
    });

    it('checking seat not affected by swap → returns original identity', () => {
      const ctx = createContext(2, 'seer', players, { swappedSeats });
      const input: ActionInput = {
        schemaId: 'seerCheck',
        target: 3, // psychic, not swapped
      };

      const result = seerCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.checkResult).toBe('好人');
    });
  });

  describe('Psychic check', () => {
    it('post-swap psychic check on A (originally villager) → should return wolf', () => {
      const ctx = createContext(3, 'psychic', players, { swappedSeats });
      const input: ActionInput = {
        schemaId: 'psychicCheck',
        target: 0,
      };

      const result = psychicCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      // post-swap should see wolf
      expect(result.result?.identityResult).toBe('wolf');
    });
  });

  describe('Gargoyle check', () => {
    it('post-swap check on A (originally villager) → should return wolf', () => {
      const ctx = createContext(4, 'gargoyle', players, { swappedSeats });
      const input: ActionInput = {
        schemaId: 'gargoyleCheck',
        target: 0,
      };

      const result = gargoyleCheckResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.identityResult).toBe('wolf');
    });
  });

  describe('wolfRobot learn', () => {
    it('post-swap learn on A (originally villager) → should return wolf', () => {
      const ctx = createContext(5, 'wolfRobot', players, { swappedSeats });
      const input: ActionInput = {
        schemaId: 'wolfRobotLearn',
        target: 0,
      };

      const result = wolfRobotLearnResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.result?.identityResult).toBe('wolf');
    });
  });
});

// =============================================================================
// 3. Death settlement alignment: deaths must follow swap rules
// =============================================================================

describe('Death settlement alignment (swap rules)', () => {
  /**
   * Scenario: attack A, magician swap [A, B]
   * Expected: death falls on B (death state swapped)
   */

  it('attack A, swap [A,B] → B dies', () => {
    const deaths = calculateDeaths(
      {
        wolfKill: 0, // kill A
        magicianSwap: { first: 0, second: 1 }, // swap A ↔ B
      },
      NO_ROLES,
    );

    // A would have died, but swap transfers death to B
    expect(deaths).not.toContain(0);
    expect(deaths).toContain(1);
  });

  it('attack B, swap [A,B] → A dies', () => {
    const deaths = calculateDeaths(
      {
        wolfKill: 1, // kill B
        magicianSwap: { first: 0, second: 1 }, // swap A ↔ B
      },
      NO_ROLES,
    );

    // B would have died, but swap transfers death to A
    expect(deaths).toContain(0);
    expect(deaths).not.toContain(1);
  });

  it('attack C (not swapped) → C dies, A/B unaffected', () => {
    const deaths = calculateDeaths(
      {
        wolfKill: 2, // kill C
        magicianSwap: { first: 0, second: 1 }, // swap A ↔ B
      },
      NO_ROLES,
    );

    expect(deaths).toContain(2);
    expect(deaths).not.toContain(0);
    expect(deaths).not.toContain(1);
  });

  it('neither dies → swap has no effect', () => {
    const deaths = calculateDeaths(
      {
        wolfKill: 2, // kill C (not A or B)
        magicianSwap: { first: 0, second: 1 },
      },
      NO_ROLES,
    );

    // Neither A nor B dies
    expect(deaths).not.toContain(0);
    expect(deaths).not.toContain(1);
  });

  it('both die (e.g. poison and attack) → swap has no effect', () => {
    const deaths = calculateDeaths(
      {
        wolfKill: 0, // A attacked
        witchAction: { kind: 'poison', targetSeat: 1 }, // B poisoned
        magicianSwap: { first: 0, second: 1 },
      },
      NO_ROLES,
    );

    // Both die, swap does not exchange
    expect(deaths).toContain(0);
    expect(deaths).toContain(1);
  });
});

// =============================================================================
// 4. Edge cases
// =============================================================================

describe('Swap edge cases', () => {
  it('no swap → check returns original identity', () => {
    const players = createPlayers([
      [0, 'villager'],
      [1, 'wolf'],
      [2, 'seer'],
    ]);
    const ctx = createContext(2, 'seer', players, {}); // no swappedSeats
    const input: ActionInput = {
      schemaId: 'seerCheck',
      target: 0,
    };

    const result = seerCheckResolver(ctx, input);

    expect(result.valid).toBe(true);
    expect(result.result?.checkResult).toBe('好人'); // villager is good
  });

  it('no swap → no death transfer', () => {
    const deaths = calculateDeaths(
      {
        wolfKill: 0,
        // no magicianSwap
      },
      NO_ROLES,
    );

    expect(deaths).toContain(0);
  });
});

// =============================================================================
// 4. Handler → Resolver wire protocol contract
// =============================================================================

describe('Handler → Resolver wire protocol (buildActionInput)', () => {
  /**
   * These tests verify the wire protocol from UI to Handler:
   * - swap must use extra.targets = [seatA, seatB]
   * - target must be null
   *
   * Note: directly tests the resolver layer's expectations on ActionInput shape,
   * since buildActionInput is just simple field extraction.
   */

  const players = createPlayers([
    [0, 'villager'],
    [1, 'wolf'],
    [2, 'seer'],
    [3, 'magician'],
  ]);

  describe('protocol: extra.targets = [seatA, seatB]', () => {
    it('resolver reads input.targets, not target', () => {
      const ctx = createContext(3, 'magician', players);

      // Simulate buildActionInput output (built from extra.targets)
      const input: ActionInput = {
        schemaId: 'magicianSwap',
        target: undefined, // protocol: target must be null/undefined
        targets: [0, 1], // protocol: extra.targets
      };

      const result = magicianSwapResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.updates?.swappedSeats).toEqual([0, 1]);
    });

    it('non-null target does not interfere with resolver (resolver only reads targets)', () => {
      const ctx = createContext(3, 'magician', players);

      // Suppose old UI incorrectly passed both target and targets
      // resolver should only read targets
      const input: ActionInput = {
        schemaId: 'magicianSwap',
        target: 999, // invalid value, should not be used
        targets: [0, 1],
      };

      const result = magicianSwapResolver(ctx, input);

      expect(result.valid).toBe(true);
      expect(result.updates?.swappedSeats).toEqual([0, 1]);
    });
  });

  describe('old mergedTarget encoding is not supported', () => {
    it('mergedTarget encoding (a + b*100) is not parsed by resolver', () => {
      const ctx = createContext(3, 'magician', players);

      // Old mergedTarget encoding: 2 + 4*100 = 402
      // This value in target field will not be parsed
      const input: ActionInput = {
        schemaId: 'magicianSwap',
        target: 402, // old mergedTarget format
        targets: undefined,
      };

      const result = magicianSwapResolver(ctx, input);

      // targets undefined → treated as skip, not error
      expect(result.valid).toBe(true);
      expect(result.updates).toBeUndefined(); // no swap
    });
  });
});
