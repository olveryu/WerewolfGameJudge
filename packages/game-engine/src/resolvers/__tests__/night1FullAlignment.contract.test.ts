/**
 * Night-1 Full Role Alignment Contract Test
 *
 * 全量对齐测试：验证 NIGHT_STEPS ↔ SCHEMAS ↔ RESOLVERS 三层一致性
 *
 * 测试项：
 * 1. audioKey === roleId（音频文件命名规范）
 * 2. Schema constraints ↔ Resolver 校验对齐
 * 3. revealKind 存在 ⇔ resolver 返回对应 result 字段
 * 4. Nightmare blocking 逻辑统一
 * 5. canSkip 行为对齐
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import {
  NIGHT_STEPS,
  ROLE_SPECS,
  type SchemaId,
  SCHEMAS,
} from '@werewolf/game-engine/models/roles/spec';
import type {
  ActionSchema,
  CompoundSchema,
  RevealKind,
} from '@werewolf/game-engine/models/roles/spec/schema.types';
import { TargetConstraint } from '@werewolf/game-engine/models/roles/spec/schema.types';
import { RESOLVERS } from '@werewolf/game-engine/resolvers';
import type { ActionInput, ResolverContext } from '@werewolf/game-engine/resolvers/types';

// === Test Helpers ===

function createContext(
  actorSeat: number,
  actorRoleId: RoleId,
  overrides?: Partial<ResolverContext>,
): ResolverContext {
  const players = new Map<number, RoleId>([
    [0, 'magician'],
    [1, 'slacker'],
    [2, 'wolfRobot'],
    [3, 'dreamcatcher'],
    [4, 'gargoyle'],
    [5, 'nightmare'],
    [6, 'guard'],
    [7, 'wolf'],
    [8, 'wolfQueen'],
    [9, 'witch'],
    [10, 'seer'],
    [11, 'psychic'],
    [12, 'hunter'],
    [13, 'darkWolfKing'],
    [14, 'villager'],
    [15, 'villager'],
  ]);

  return {
    actorSeat,
    actorRoleId,
    players,
    currentNightResults: {},
    witchState: { canSave: true, canPoison: true },
    gameState: { isNight1: true },
    ...overrides,
  };
}

function getSchemaCanSkip(schemaId: SchemaId): boolean {
  const schema = SCHEMAS[schemaId];
  if (!schema) return false;

  if (schema.kind === 'compound') {
    const compoundSchema = schema as CompoundSchema;
    return compoundSchema.steps?.every((s) => s.canSkip === true) ?? false;
  }

  if ('canSkip' in schema) {
    return (schema as { canSkip?: boolean }).canSkip === true;
  }

  return false;
}

function getSchemaRevealKind(schemaId: SchemaId): RevealKind | undefined {
  const schema = SCHEMAS[schemaId] as ActionSchema;
  if (!schema) return undefined;
  return schema.ui?.revealKind;
}

// === 1. audioKey === roleId Contract ===

describe('audioKey === roleId Contract (PR8 alignment)', () => {
  it.each(NIGHT_STEPS)('$id: audioKey should equal roleId', (step) => {
    expect(step.audioKey).toBe(step.roleId);
  });

  it('all audioKey values should be valid RoleId values', () => {
    const validRoleIds = Object.keys(ROLE_SPECS);
    for (const step of NIGHT_STEPS) {
      expect(validRoleIds).toContain(step.audioKey);
    }
  });
});

// === 2. Schema constraints ↔ Resolver alignment ===

describe('Schema constraints ↔ Resolver alignment', () => {
  describe('guardProtect allows self-target (Night-1 design)', () => {
    /**
     * guardProtect schema has NO notSelf constraint: constraints: []
     * This is intentional for Night-1 scope where guard self-protect is allowed.
     *
     * Schema-Resolver alignment: ✅ Both allow self-target
     */
    it('guardProtect schema has NO notSelf constraint', () => {
      const schema = SCHEMAS.guardProtect;
      expect(schema.constraints).toEqual([]);
    });

    it('guardProtect resolver ALLOWS self-target (aligned with schema)', () => {
      const resolver = RESOLVERS.guardProtect;
      const context = createContext(6, 'guard');

      const result = resolver!(context, { schemaId: 'guardProtect', target: 6 });

      expect(result.valid).toBe(true);
    });
  });

  describe('witchAction save step notSelf constraint', () => {
    it('schema should define notSelf for save step', () => {
      const witchSchema = SCHEMAS.witchAction as CompoundSchema;
      expect(witchSchema.kind).toBe('compound');

      const saveStep = witchSchema.steps[0];
      expect(saveStep.key).toBe('save');
      expect(saveStep.constraints).toContain(TargetConstraint.NotSelf);
    });

    it('resolver should reject witch saving self', () => {
      const resolver = RESOLVERS.witchAction;
      const witchSeat = 9;
      const context = createContext(witchSeat, 'witch');

      const input: ActionInput = {
        schemaId: 'witchAction',
        stepResults: { save: witchSeat }, // 尝试救自己
      };

      const result = resolver!(context, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('自救');
    });
  });

  describe('wolfKill should NOT have notSelf (neutral judge rule)', () => {
    it('schema should not have notSelf constraint', () => {
      const wolfSchema = SCHEMAS.wolfKill;
      expect(wolfSchema.constraints ?? []).not.toContain(TargetConstraint.NotSelf);
    });

    it('resolver should accept wolf killing self', () => {
      const resolver = RESOLVERS.wolfKill;
      const wolfSeat = 7;
      const context = createContext(wolfSeat, 'wolf');

      const input: ActionInput = {
        schemaId: 'wolfKill',
        target: wolfSeat, // 刀自己
      };

      const result = resolver!(context, input);

      // 狼刀是中立的，可以刀任意座位
      expect(result.valid).toBe(true);
    });
  });
});

// === 3. revealKind ↔ Resolver result field alignment ===

describe('revealKind ↔ Resolver result field alignment', () => {
  // 这些 schema 有 revealKind 需要返回 reveal 结果
  const schemasWithReveal = [
    {
      schemaId: 'seerCheck' as SchemaId,
      revealKind: 'seer' as RevealKind,
      roleId: 'seer' as RoleId,
      seat: 10,
    },
    {
      schemaId: 'psychicCheck' as SchemaId,
      revealKind: 'psychic' as RevealKind,
      roleId: 'psychic' as RoleId,
      seat: 11,
    },
    {
      schemaId: 'gargoyleCheck' as SchemaId,
      revealKind: 'gargoyle' as RevealKind,
      roleId: 'gargoyle' as RoleId,
      seat: 4,
    },
    {
      schemaId: 'wolfRobotLearn' as SchemaId,
      revealKind: 'wolfRobot' as RevealKind,
      roleId: 'wolfRobot' as RoleId,
      seat: 2,
    },
  ];

  describe('schemas with revealKind should be correctly configured', () => {
    it.each(schemasWithReveal)(
      '$schemaId: should have revealKind=$revealKind',
      ({ schemaId, revealKind }) => {
        const actualRevealKind = getSchemaRevealKind(schemaId);
        expect(actualRevealKind).toBe(revealKind);
      },
    );
  });

  describe('resolvers with revealKind should return corresponding result field', () => {
    it('seerCheck resolver returns checkResult when valid target', () => {
      const resolver = RESOLVERS.seerCheck;
      const seerSeat = 10;
      const targetSeat = 7; // wolf

      const context = createContext(seerSeat, 'seer');
      const result = resolver!(context, { schemaId: 'seerCheck', target: targetSeat });

      expect(result.valid).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result!.checkResult).toBeDefined();
      expect(['好人', '狼人']).toContain(result.result!.checkResult);
    });

    it('psychicCheck resolver returns identityResult when valid target', () => {
      const resolver = RESOLVERS.psychicCheck;
      const psychicSeat = 11;
      const targetSeat = 7; // wolf

      const context = createContext(psychicSeat, 'psychic');
      const result = resolver!(context, { schemaId: 'psychicCheck', target: targetSeat });

      expect(result.valid).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result!.identityResult).toBeDefined();
    });

    it('gargoyleCheck resolver returns identityResult when valid target', () => {
      const resolver = RESOLVERS.gargoyleCheck;
      const gargoyleSeat = 4;
      const targetSeat = 7; // wolf

      const context = createContext(gargoyleSeat, 'gargoyle');
      const result = resolver!(context, { schemaId: 'gargoyleCheck', target: targetSeat });

      expect(result.valid).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result!.identityResult).toBeDefined();
    });

    it('wolfRobotLearn resolver returns identityResult when valid target', () => {
      const resolver = RESOLVERS.wolfRobotLearn;
      const robotSeat = 2;
      const targetSeat = 10; // seer (good)

      const context = createContext(robotSeat, 'wolfRobot');
      const result = resolver!(context, { schemaId: 'wolfRobotLearn', target: targetSeat });

      expect(result.valid).toBe(true);
      expect(result.result).toBeDefined();
      // wolfRobot returns identityResult (exact role), not checkResult (good/evil)
      expect(result.result!.identityResult).toBeDefined();
      expect(result.result!.learnTarget).toBe(targetSeat);
    });
  });

  describe('skip action should NOT return reveal result', () => {
    it('seerCheck skip should not return result', () => {
      const resolver = RESOLVERS.seerCheck;
      const context = createContext(10, 'seer');
      const result = resolver!(context, { schemaId: 'seerCheck', target: undefined });

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });

    it('psychicCheck skip should not return result', () => {
      const resolver = RESOLVERS.psychicCheck;
      const context = createContext(11, 'psychic');
      const result = resolver!(context, { schemaId: 'psychicCheck', target: undefined });

      expect(result.valid).toBe(true);
      expect(result.result).toEqual({});
    });
  });
});

// === 4. Nightmare blocking alignment ===

describe('Nightmare blocking behavior', () => {
  const blockableSchemas = [
    { schemaId: 'guardProtect' as SchemaId, roleId: 'guard' as RoleId, actorSeat: 6 },
    { schemaId: 'seerCheck' as SchemaId, roleId: 'seer' as RoleId, actorSeat: 10 },
    { schemaId: 'psychicCheck' as SchemaId, roleId: 'psychic' as RoleId, actorSeat: 11 },
    { schemaId: 'gargoyleCheck' as SchemaId, roleId: 'gargoyle' as RoleId, actorSeat: 4 },
    { schemaId: 'dreamcatcherDream' as SchemaId, roleId: 'dreamcatcher' as RoleId, actorSeat: 3 },
  ];

  // NOTE: Nightmare block guard is now at actionHandler layer, not resolver layer.
  // Resolvers no longer reject blocked actions directly - they return valid=true with empty result.
  // The rejection happens in checkNightmareBlockGuard() in actionHandler.ts.

  describe('blocked actors skip returns empty result', () => {
    it.each(blockableSchemas)(
      '$schemaId: blocked by nightmare + skip → valid=true with empty result',
      ({ schemaId, roleId, actorSeat }) => {
        const resolver = RESOLVERS[schemaId];
        const context = createContext(actorSeat, roleId, {
          currentNightResults: { blockedSeat: actorSeat },
        });

        const result = resolver!(context, { schemaId, target: undefined }); // skip

        expect(result.valid).toBe(true);
        expect(result.result).toEqual({});
      },
    );
  });

  describe('blocked actors non-skip returns valid (handler does blocking)', () => {
    // These tests verify resolvers don't reject blocked actions themselves.
    // The actual rejection is done by checkNightmareBlockGuard() in actionHandler.ts.
    it.each(blockableSchemas)(
      '$schemaId: blocked by nightmare + non-skip → resolver returns valid (handler rejects)',
      ({ schemaId, roleId, actorSeat }) => {
        const resolver = RESOLVERS[schemaId];
        const context = createContext(actorSeat, roleId, {
          currentNightResults: { blockedSeat: actorSeat },
        });

        const result = resolver!(context, { schemaId, target: 7 }); // 选一个目标

        // Resolver returns valid=true, handler layer does the actual rejection
        expect(result.valid).toBe(true);
      },
    );
  });

  /**
   * Wolf kill when wolfKillDisabled:
   * - Non-empty vote (target) → REJECTED
   * - Empty vote (空刀) → allowed
   */
  describe('wolfKillDisabled behavior', () => {
    it('wolfKillDisabled + non-empty vote → valid=false', () => {
      const resolver = RESOLVERS.wolfKill;
      const wolfSeat = 7;
      const context = createContext(wolfSeat, 'wolf', {
        currentNightResults: { wolfKillDisabled: true },
      });

      const result = resolver!(context, { schemaId: 'wolfKill', target: 14 });

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toBeDefined();
    });

    it('wolfKillDisabled + empty vote (空刀) → valid=true', () => {
      const resolver = RESOLVERS.wolfKill;
      const wolfSeat = 7;
      const context = createContext(wolfSeat, 'wolf', {
        currentNightResults: { wolfKillDisabled: true },
      });

      const result = resolver!(context, { schemaId: 'wolfKill', target: undefined });

      expect(result.valid).toBe(true);
      // Should record the empty vote
      expect(result.updates?.wolfVotesBySeat?.[String(wolfSeat)]).toBe(-1);
    });
  });

  it('nightmare resolver sets wolfKillDisabled when blocking a wolf', () => {
    const resolver = RESOLVERS.nightmareBlock;
    const nightmareSeat = 5;
    const wolfSeat = 7;
    const context = createContext(nightmareSeat, 'nightmare');

    const result = resolver!(context, { schemaId: 'nightmareBlock', target: wolfSeat });

    expect(result.valid).toBe(true);
    expect(result.updates?.blockedSeat).toBe(wolfSeat);
    expect(result.updates?.wolfKillDisabled).toBe(true);
  });

  it('nightmare resolver does NOT set wolfKillDisabled when blocking non-wolf', () => {
    const resolver = RESOLVERS.nightmareBlock;
    const nightmareSeat = 5;
    const seerSeat = 10;
    const context = createContext(nightmareSeat, 'nightmare');

    const result = resolver!(context, { schemaId: 'nightmareBlock', target: seerSeat });

    expect(result.valid).toBe(true);
    expect(result.updates?.blockedSeat).toBe(seerSeat);
    expect(result.updates?.wolfKillDisabled).toBeUndefined();
  });
});

// === 5. canSkip alignment ===

describe('canSkip behavior alignment', () => {
  const canSkipSchemas = [
    { schemaId: 'seerCheck' as SchemaId, roleId: 'seer' as RoleId, actorSeat: 10 },
    { schemaId: 'psychicCheck' as SchemaId, roleId: 'psychic' as RoleId, actorSeat: 11 },
    { schemaId: 'gargoyleCheck' as SchemaId, roleId: 'gargoyle' as RoleId, actorSeat: 4 },
    { schemaId: 'dreamcatcherDream' as SchemaId, roleId: 'dreamcatcher' as RoleId, actorSeat: 3 },
    { schemaId: 'nightmareBlock' as SchemaId, roleId: 'nightmare' as RoleId, actorSeat: 5 },
    { schemaId: 'guardProtect' as SchemaId, roleId: 'guard' as RoleId, actorSeat: 6 },
  ];

  describe('schemas with canSkip=true', () => {
    it.each(canSkipSchemas)('$schemaId: schema should have canSkip=true', ({ schemaId }) => {
      expect(getSchemaCanSkip(schemaId)).toBe(true);
    });

    it.each(canSkipSchemas)(
      '$schemaId: resolver should accept undefined target',
      ({ schemaId, roleId, actorSeat }) => {
        const resolver = RESOLVERS[schemaId];
        const context = createContext(actorSeat, roleId);

        const result = resolver!(context, { schemaId, target: undefined });

        expect(result.valid).toBe(true);
        expect(result.result).toEqual({});
      },
    );
  });

  const noSkipSchemas = [
    { schemaId: 'wolfKill' as SchemaId, roleId: 'wolf' as RoleId, actorSeat: 7 },
    // Note: slackerChooseIdol has canSkip=false but blocked slacker can skip (special case)
  ];

  const confirmSchemasShouldHaveCanSkip = [
    { schemaId: 'hunterConfirm' as SchemaId },
    { schemaId: 'darkWolfKingConfirm' as SchemaId },
  ];

  describe('confirm schemas should have canSkip=true (blocked can skip)', () => {
    it.each(confirmSchemasShouldHaveCanSkip)(
      '$schemaId: should have canSkip=true',
      ({ schemaId }) => {
        expect(getSchemaCanSkip(schemaId)).toBe(true);
      },
    );
  });

  describe('schemas without canSkip', () => {
    it.each(noSkipSchemas)(
      '$schemaId: schema should have canSkip=false or undefined',
      ({ schemaId }) => {
        expect(getSchemaCanSkip(schemaId)).toBe(false);
      },
    );
  });
});

// === 6. NIGHT_STEPS order stability ===

describe('NIGHT_STEPS order stability', () => {
  it('should have exactly 21 steps', () => {
    expect(NIGHT_STEPS).toHaveLength(21);
  });

  it('step order should match expected sequence', () => {
    const expectedOrder = [
      'magicianSwap',
      'slackerChooseIdol',
      'wildChildChooseIdol',
      'nightmareBlock',
      'dreamcatcherDream',
      'guardProtect',
      'silenceElderSilence',
      'votebanElderBan',
      'wolfKill',
      'wolfQueenCharm',
      'witchAction',
      'hunterConfirm',
      'darkWolfKingConfirm',
      'wolfRobotLearn',
      'seerCheck',
      'mirrorSeerCheck',
      'drunkSeerCheck',
      'wolfWitchCheck',
      'gargoyleCheck',
      'pureWhiteCheck',
      'psychicCheck',
    ];

    const actualOrder = NIGHT_STEPS.map((s) => s.id);
    expect(actualOrder).toEqual(expectedOrder);
  });

  it('all step IDs should be unique', () => {
    const ids = NIGHT_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// === 7. Confirm kind schemas alignment ===

describe('Confirm kind schemas', () => {
  const confirmSchemas = [
    { schemaId: 'hunterConfirm' as SchemaId, roleId: 'hunter' as RoleId, seat: 12 },
    { schemaId: 'darkWolfKingConfirm' as SchemaId, roleId: 'darkWolfKing' as RoleId, seat: 13 },
  ];

  it.each(confirmSchemas)('$schemaId: should have kind=confirm', ({ schemaId }) => {
    const schema = SCHEMAS[schemaId];
    expect(schema.kind).toBe('confirm');
  });

  it.each(confirmSchemas)(
    '$schemaId: resolver should accept confirm input',
    ({ schemaId, roleId, seat }) => {
      const resolver = RESOLVERS[schemaId];
      const context = createContext(seat, roleId);

      const result = resolver!(context, { schemaId, confirmed: true });

      expect(result.valid).toBe(true);
    },
  );
});
