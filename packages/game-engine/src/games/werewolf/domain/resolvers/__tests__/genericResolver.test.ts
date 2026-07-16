/**
 * Generic Resolver Unit Tests
 *
 * Validates that createGenericResolver produces correct results
 * for each supported effect kind, matching V1 resolver behavior.
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/domain/models/roles';
import { createGenericResolver } from '@game-judge/game-engine/games/werewolf/domain/resolvers/genericResolver';
import type {
  ActionInput,
  ResolverContext,
} from '@game-judge/game-engine/games/werewolf/domain/resolvers/types';

// =============================================================================
// Shared Helpers
// =============================================================================

function createPlayers(overrides?: Record<number, RoleId>): ReadonlyMap<number, RoleId> {
  const defaults: Record<number, RoleId> = {
    0: 'guard',
    1: 'seer',
    2: 'wolf',
    3: 'witch',
    4: 'villager',
    5: 'dreamcatcher',
    6: 'wolfQueen',
    7: 'slacker',
    8: 'nightmare',
    9: 'psychic',
    10: 'silenceElder',
    11: 'votebanElder',
  };
  return new Map(Object.entries({ ...defaults, ...overrides }).map(([k, v]) => [Number(k), v]));
}

function createContext(overrides: Partial<ResolverContext> = {}): ResolverContext {
  return {
    actorSeat: 0,
    actorRoleId: 'guard',
    players: createPlayers(),
    currentNightResults: {},
    gameState: { isNight1: true, isWolfVoteUnanimityRequired: false },
    ...overrides,
    rng: overrides?.rng ?? (() => 0.75),
  };
}

function createInput(
  schemaId: string,
  target?: number | null,
  extra?: Partial<ActionInput>,
): ActionInput {
  return {
    schemaId: schemaId as ActionInput['schemaId'],
    target: target ?? undefined,
    ...extra,
  };
}

// =============================================================================
// writeSlot effect tests
// =============================================================================

describe('genericResolver: writeSlot effect', () => {
  describe('guard (guardedSeat)', () => {
    const resolver = createGenericResolver('guard');

    it('should accept valid target and write guardedSeat', () => {
      const ctx = createContext({ actorSeat: 0, actorRoleId: 'guard' as RoleId });
      const result = resolver(ctx, createInput('guardProtect', 4));
      expect(result.valid).toBe(true);
      expect(result.updates?.guardedSeat).toBe(4);
    });

    it('should allow skip (target=undefined)', () => {
      const ctx = createContext({ actorSeat: 0, actorRoleId: 'guard' as RoleId });
      const result = resolver(ctx, createInput('guardProtect'));
      expect(result.valid).toBe(true);
      expect(result.updates).toBeUndefined();
    });

    it('should allow skip (target=null)', () => {
      const ctx = createContext({ actorSeat: 0, actorRoleId: 'guard' as RoleId });
      const result = resolver(ctx, createInput('guardProtect', null));
      expect(result.valid).toBe(true);
    });

    it('should allow guard to protect self (no NotSelf constraint)', () => {
      const ctx = createContext({ actorSeat: 0, actorRoleId: 'guard' as RoleId });
      const result = resolver(ctx, createInput('guardProtect', 0));
      expect(result.valid).toBe(true);
      expect(result.updates?.guardedSeat).toBe(0);
    });

    it('should reject non-existent target', () => {
      const ctx = createContext({ actorSeat: 0, actorRoleId: 'guard' as RoleId });
      const result = resolver(ctx, createInput('guardProtect', 99));
      expect(result.valid).toBe(false);
      expect(result.rejectReason).toBe('目标玩家不存在');
    });
  });

  describe('dreamcatcher (dreamingSeat)', () => {
    const resolver = createGenericResolver('dreamcatcher');

    it('should write dreamingSeat', () => {
      const ctx = createContext({ actorSeat: 5, actorRoleId: 'dreamcatcher' as RoleId });
      const result = resolver(ctx, createInput('dreamcatcherDream', 4));
      expect(result.valid).toBe(true);
      expect(result.updates?.dreamingSeat).toBe(4);
    });

    it('should reject self-target (NotSelf constraint)', () => {
      const ctx = createContext({ actorSeat: 5, actorRoleId: 'dreamcatcher' as RoleId });
      const result = resolver(ctx, createInput('dreamcatcherDream', 5));
      expect(result.valid).toBe(false);
      expect(result.rejectReason).toBe('不能选择自己');
    });

    it('should allow skip', () => {
      const ctx = createContext({ actorSeat: 5, actorRoleId: 'dreamcatcher' as RoleId });
      const result = resolver(ctx, createInput('dreamcatcherDream'));
      expect(result.valid).toBe(true);
    });
  });

  describe('silenceElder (silencedSeat)', () => {
    const resolver = createGenericResolver('silenceElder');

    it('should write silencedSeat', () => {
      const ctx = createContext({ actorSeat: 10, actorRoleId: 'silenceElder' as RoleId });
      const result = resolver(ctx, createInput('silenceElderSilence', 4));
      expect(result.valid).toBe(true);
      expect(result.updates?.silencedSeat).toBe(4);
    });

    it('should allow self-target (no NotSelf constraint)', () => {
      const ctx = createContext({ actorSeat: 10, actorRoleId: 'silenceElder' as RoleId });
      const result = resolver(ctx, createInput('silenceElderSilence', 10));
      expect(result.valid).toBe(true);
    });
  });

  describe('votebanElder (votebannedSeat)', () => {
    const resolver = createGenericResolver('votebanElder');

    it('should write votebannedSeat', () => {
      const ctx = createContext({ actorSeat: 11, actorRoleId: 'votebanElder' as RoleId });
      const result = resolver(ctx, createInput('votebanElderBan', 3));
      expect(result.valid).toBe(true);
      expect(result.updates?.votebannedSeat).toBe(3);
    });
  });
});

// =============================================================================
// charm effect tests
// =============================================================================

describe('genericResolver: charm effect', () => {
  const resolver = createGenericResolver('wolfQueen');

  it('should write charmedSeat', () => {
    const ctx = createContext({ actorSeat: 6, actorRoleId: 'wolfQueen' as RoleId });
    const result = resolver(ctx, createInput('wolfQueenCharm', 4));
    expect(result.valid).toBe(true);
    expect(result.updates).toEqual({ charmedSeat: 4 });
  });

  it('should reject self-target (NotSelf constraint)', () => {
    const ctx = createContext({ actorSeat: 6, actorRoleId: 'wolfQueen' as RoleId });
    const result = resolver(ctx, createInput('wolfQueenCharm', 6));
    expect(result.valid).toBe(false);
    expect(result.rejectReason).toBe('不能选择自己');
  });

  it('should allow skip', () => {
    const ctx = createContext({ actorSeat: 6, actorRoleId: 'wolfQueen' as RoleId });
    const result = resolver(ctx, createInput('wolfQueenCharm'));
    expect(result.valid).toBe(true);
  });
});

// =============================================================================
// chooseIdol effect tests
// =============================================================================

describe('genericResolver: chooseIdol effect', () => {
  const resolver = createGenericResolver('slacker');

  it('should accept a valid idol target', () => {
    const ctx = createContext({ actorSeat: 7, actorRoleId: 'slacker' as RoleId });
    const result = resolver(ctx, createInput('slackerChooseIdol', 4));
    expect(result.valid).toBe(true);
    expect(result.reveal).toBeUndefined();
  });

  it('should reject skip (canSkip=false)', () => {
    const ctx = createContext({ actorSeat: 7, actorRoleId: 'slacker' as RoleId });
    const result = resolver(ctx, createInput('slackerChooseIdol'));
    expect(result.valid).toBe(false);
    expect(result.rejectReason).toBe('必须选择榜样');
  });

  it('should allow skip when nightmare-blocked', () => {
    const ctx = createContext({
      actorSeat: 7,
      actorRoleId: 'slacker' as RoleId,
      currentNightResults: { blockedSeat: 7 },
    });
    const result = resolver(ctx, createInput('slackerChooseIdol'));
    expect(result.valid).toBe(true);
  });

  it('should reject self-target (NotSelf constraint)', () => {
    const ctx = createContext({ actorSeat: 7, actorRoleId: 'slacker' as RoleId });
    const result = resolver(ctx, createInput('slackerChooseIdol', 7));
    expect(result.valid).toBe(false);
    expect(result.rejectReason).toBe('不能选择自己');
  });

  it('should reject non-existent target', () => {
    const ctx = createContext({ actorSeat: 7, actorRoleId: 'slacker' as RoleId });
    const result = resolver(ctx, createInput('slackerChooseIdol', 99));
    expect(result.valid).toBe(false);
    expect(result.rejectReason).toBe('目标玩家不存在');
  });
});

describe('genericResolver: wildChild chooseIdol', () => {
  const resolver = createGenericResolver('wildChild');

  it('should accept a valid idol target', () => {
    const ctx = createContext({ actorSeat: 7, actorRoleId: 'wildChild' as RoleId });
    const result = resolver(ctx, createInput('wildChildChooseIdol', 4));
    expect(result.valid).toBe(true);
    expect(result.reveal).toBeUndefined();
  });
});

// =============================================================================
// check effect tests (faction + identity)
// =============================================================================

describe('genericResolver: check effect', () => {
  describe('seer (faction check)', () => {
    const resolver = createGenericResolver('seer');

    it('should return 好人 for good team target', () => {
      const ctx = createContext({ actorSeat: 1, actorRoleId: 'seer' as RoleId });
      const result = resolver(ctx, createInput('seerCheck', 4)); // villager
      expect(result.valid).toBe(true);
      expect(result.reveal).toEqual({ kind: 'factionCheck', checkResult: '好人' });
    });

    it('should return 狼人 for wolf team target', () => {
      const ctx = createContext({ actorSeat: 1, actorRoleId: 'seer' as RoleId });
      const result = resolver(ctx, createInput('seerCheck', 2)); // wolf
      expect(result.valid).toBe(true);
      expect(result.reveal).toEqual({ kind: 'factionCheck', checkResult: '狼人' });
    });

    it('should reject self-target', () => {
      const ctx = createContext({ actorSeat: 1, actorRoleId: 'seer' as RoleId });
      const result = resolver(ctx, createInput('seerCheck', 1));
      expect(result.valid).toBe(false);
      expect(result.rejectReason).toBe('不能选择自己');
    });

    it('should allow skip', () => {
      const ctx = createContext({ actorSeat: 1, actorRoleId: 'seer' as RoleId });
      const result = resolver(ctx, createInput('seerCheck'));
      expect(result.valid).toBe(true);
    });

    it('should be swap-aware (magician swap)', () => {
      const ctx = createContext({
        actorSeat: 1,
        actorRoleId: 'seer' as RoleId,
        currentNightResults: { swappedSeats: [2, 4] as readonly [number, number] },
      });
      // Checking seat 2 (wolf), but swapped with seat 4 (villager)
      const result = resolver(ctx, createInput('seerCheck', 2));
      expect(result.valid).toBe(true);
      expect(result.reveal).toEqual({ kind: 'factionCheck', checkResult: '好人' });
    });
  });

  describe('mirrorSeer (inverted faction check)', () => {
    const resolver = createGenericResolver('mirrorSeer');

    it('should return inverted result: 狼人 for good team', () => {
      const ctx = createContext({ actorSeat: 1, actorRoleId: 'mirrorSeer' as RoleId });
      const result = resolver(ctx, createInput('mirrorSeerCheck', 4)); // villager
      expect(result.valid).toBe(true);
      expect(result.reveal).toEqual({ kind: 'factionCheck', checkResult: '狼人' });
    });

    it('should return inverted result: 好人 for wolf team', () => {
      const ctx = createContext({ actorSeat: 1, actorRoleId: 'mirrorSeer' as RoleId });
      const result = resolver(ctx, createInput('mirrorSeerCheck', 2)); // wolf
      expect(result.valid).toBe(true);
      expect(result.reveal).toEqual({ kind: 'factionCheck', checkResult: '好人' });
    });
  });

  describe('drunkSeer (random faction check)', () => {
    const resolver = createGenericResolver('drunkSeer');

    it('uses the command-scoped random source', () => {
      const normal = resolver(
        createContext({
          actorSeat: 1,
          actorRoleId: 'drunkSeer' as RoleId,
          rng: () => 0.75,
        }),
        createInput('drunkSeerCheck', 4),
      );
      const inverted = resolver(
        createContext({
          actorSeat: 1,
          actorRoleId: 'drunkSeer' as RoleId,
          rng: () => 0.25,
        }),
        createInput('drunkSeerCheck', 4),
      );

      expect(normal.reveal).toEqual({ kind: 'factionCheck', checkResult: '好人' });
      expect(inverted.reveal).toEqual({ kind: 'factionCheck', checkResult: '狼人' });
    });
  });

  describe('psychic (identity check)', () => {
    const resolver = createGenericResolver('psychic');

    it('should return exact role identity', () => {
      const ctx = createContext({ actorSeat: 9, actorRoleId: 'psychic' as RoleId });
      const result = resolver(ctx, createInput('psychicCheck', 4)); // villager
      expect(result.valid).toBe(true);
      expect(result.reveal).toEqual({ kind: 'identityCheck', roleId: 'villager' });
    });

    it('should be swap-aware', () => {
      const ctx = createContext({
        actorSeat: 9,
        actorRoleId: 'psychic' as RoleId,
        currentNightResults: { swappedSeats: [2, 4] as readonly [number, number] },
      });
      const result = resolver(ctx, createInput('psychicCheck', 4)); // seat 4 swapped with 2
      expect(result.valid).toBe(true);
      expect(result.reveal).toEqual({ kind: 'identityCheck', roleId: 'wolf' });
    });

    it('should reject self-target', () => {
      const ctx = createContext({ actorSeat: 9, actorRoleId: 'psychic' as RoleId });
      const result = resolver(ctx, createInput('psychicCheck', 9));
      expect(result.valid).toBe(false);
    });
  });

  describe('gargoyle (identity check)', () => {
    const resolver = createGenericResolver('gargoyle');

    it('should return exact role identity', () => {
      const players = createPlayers({ 5: 'gargoyle' });
      const ctx = createContext({
        actorSeat: 5,
        actorRoleId: 'gargoyle' as RoleId,
        players,
      });
      const result = resolver(ctx, createInput('gargoyleCheck', 4));
      expect(result.valid).toBe(true);
      expect(result.reveal).toEqual({ kind: 'identityCheck', roleId: 'villager' });
    });
  });

  describe('wolfWitch (identity check, NotWolfFaction)', () => {
    const resolver = createGenericResolver('wolfWitch');

    it('should return identity for non-wolf target', () => {
      const players = createPlayers({ 5: 'wolfWitch' });
      const ctx = createContext({
        actorSeat: 5,
        actorRoleId: 'wolfWitch' as RoleId,
        players,
      });
      const result = resolver(ctx, createInput('wolfWitchCheck', 4));
      expect(result.valid).toBe(true);
      expect(result.reveal).toEqual({ kind: 'identityCheck', roleId: 'villager' });
    });

    it('should reject wolf-faction target (NotWolfFaction constraint)', () => {
      const players = createPlayers({ 5: 'wolfWitch' });
      const ctx = createContext({
        actorSeat: 5,
        actorRoleId: 'wolfWitch' as RoleId,
        players,
      });
      const result = resolver(ctx, createInput('wolfWitchCheck', 2)); // wolf
      expect(result.valid).toBe(false);
      expect(result.rejectReason).toBe('不能选择狼人阵营的玩家');
    });
  });

  describe('pureWhite (identity check)', () => {
    const resolver = createGenericResolver('pureWhite');

    it('should return exact role identity', () => {
      const players = createPlayers({ 5: 'pureWhite' });
      const ctx = createContext({
        actorSeat: 5,
        actorRoleId: 'pureWhite' as RoleId,
        players,
      });
      const result = resolver(ctx, createInput('pureWhiteCheck', 4));
      expect(result.valid).toBe(true);
      expect(result.reveal).toEqual({ kind: 'identityCheck', roleId: 'villager' });
    });
  });
});

// =============================================================================
// block effect tests
// =============================================================================

describe('genericResolver: block effect', () => {
  const resolver = createGenericResolver('nightmare');

  it('should write blockedSeat', () => {
    const ctx = createContext({ actorSeat: 8, actorRoleId: 'nightmare' as RoleId });
    const result = resolver(ctx, createInput('nightmareBlock', 4));
    expect(result.valid).toBe(true);
    expect(result.updates?.blockedSeat).toBe(4);
    expect(result.updates?.wolfKillOverride).toBeUndefined();
  });

  it('should set wolfKillOverride when blocking wolf-team target', () => {
    const ctx = createContext({ actorSeat: 8, actorRoleId: 'nightmare' as RoleId });
    const result = resolver(ctx, createInput('nightmareBlock', 2)); // wolf
    expect(result.valid).toBe(true);
    expect(result.updates?.blockedSeat).toBe(2);
    expect(result.updates?.wolfKillOverride).toBeDefined();
    expect(result.updates?.wolfKillOverride?.source).toBe('nightmare');
  });

  it('should allow skip', () => {
    const ctx = createContext({ actorSeat: 8, actorRoleId: 'nightmare' as RoleId });
    const result = resolver(ctx, createInput('nightmareBlock'));
    expect(result.valid).toBe(true);
  });
});

// =============================================================================
// learn effect tests
// =============================================================================

describe('genericResolver: learn effect', () => {
  const resolver = createGenericResolver('wolfRobot');

  it('should return the learned role as a typed reveal', () => {
    const players = createPlayers({ 5: 'wolfRobot' });
    const ctx = createContext({
      actorSeat: 5,
      actorRoleId: 'wolfRobot' as RoleId,
      players,
    });
    const result = resolver(ctx, createInput('wolfRobotLearn', 4)); // villager
    expect(result.valid).toBe(true);
    expect(result.reveal).toEqual({ kind: 'wolfRobotLearn', learnedRoleId: 'villager' });
  });

  it('should leave authoritative hunter status to the action handler', () => {
    const players = createPlayers({ 5: 'wolfRobot', 4: 'hunter' });
    const ctx = createContext({
      actorSeat: 5,
      actorRoleId: 'wolfRobot' as RoleId,
      players,
    });
    const result = resolver(ctx, createInput('wolfRobotLearn', 4));
    expect(result.valid).toBe(true);
    expect(result.reveal).toEqual({ kind: 'wolfRobotLearn', learnedRoleId: 'hunter' });
  });

  it('should be swap-aware', () => {
    const players = createPlayers({ 5: 'wolfRobot' });
    const ctx = createContext({
      actorSeat: 5,
      actorRoleId: 'wolfRobot' as RoleId,
      players,
      currentNightResults: { swappedSeats: [2, 4] as readonly [number, number] },
    });
    // Seat 4 was villager, now swapped with 2 (wolf)
    const result = resolver(ctx, createInput('wolfRobotLearn', 4));
    expect(result.valid).toBe(true);
    expect(result.reveal).toEqual({ kind: 'wolfRobotLearn', learnedRoleId: 'wolf' });
  });

  it('should reject self-target', () => {
    const players = createPlayers({ 5: 'wolfRobot' });
    const ctx = createContext({
      actorSeat: 5,
      actorRoleId: 'wolfRobot' as RoleId,
      players,
    });
    const result = resolver(ctx, createInput('wolfRobotLearn', 5));
    expect(result.valid).toBe(false);
  });

  it('should allow skip', () => {
    const players = createPlayers({ 5: 'wolfRobot' });
    const ctx = createContext({
      actorSeat: 5,
      actorRoleId: 'wolfRobot' as RoleId,
      players,
    });
    const result = resolver(ctx, createInput('wolfRobotLearn'));
    expect(result.valid).toBe(true);
  });
});

// =============================================================================
// createGenericResolver error handling
// =============================================================================

describe('genericResolver: error handling', () => {
  it('should throw for non-existent role', () => {
    expect(() => createGenericResolver('nonexistent')).toThrow('not found in ROLE_SPECS');
  });

  it('should throw for role without active ability', () => {
    // villager has no active abilities
    expect(() => createGenericResolver('villager')).toThrow('not an active ability');
  });
});
