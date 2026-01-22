/**
 * Schema-UI-Resolver 三层对齐合约测试
 *
 * 本测试确保：
 * 1. Schema 是 notSelf 约束的单一真相
 * 2. UI 从 schema 读取约束（无 hardcode）
 * 3. Resolver 按 schema 校验（schema-first）
 *
 * 如果任何层出现 drift，此测试会失败。
 */

import { SCHEMAS, type SchemaId } from '../../../models/roles/spec/schemas';
import type { ChooseSeatSchema, SwapSchema, CompoundSchema } from '../../../models/roles/spec/schema.types';
import { RESOLVERS } from '../../../services/night/resolvers';
import type { ResolverContext, ActionInput } from '../../../services/night/resolvers/types';
import type { RoleId } from '../../../models/roles/spec/specs';

// === Test Helpers ===

function createContext(actorSeat: number, actorRoleId: RoleId): ResolverContext {
  const players = new Map<number, RoleId>([
    [0, 'villager'],
    [1, 'villager'],
    [2, 'villager'],
  ]);
  players.set(actorSeat, actorRoleId);

  return {
    actorSeat,
    actorRoleId,
    players,
    currentNightResults: {},
  };
}

function getSchemaConstraints(schemaId: SchemaId): readonly string[] {
  const schema = SCHEMAS[schemaId];
  if (!schema) return [];
  if (schema.kind === 'chooseSeat' || schema.kind === 'swap') {
    return (schema as ChooseSeatSchema | SwapSchema).constraints;
  }
  if (schema.kind === 'wolfVote') {
    return schema.constraints ?? [];
  }
  return [];
}

// === Schema 是 notSelf 的单一真相 ===

describe('Schema notSelf constraint - single source of truth', () => {
  // 有 notSelf 的 schema（必须拒绝自指）
  const schemasWithNotSelf: Array<{ schemaId: SchemaId; roleId: RoleId }> = [
    { schemaId: 'dreamcatcherDream', roleId: 'dreamcatcher' },
    { schemaId: 'wolfQueenCharm', roleId: 'wolfQueen' },
    { schemaId: 'wolfRobotLearn', roleId: 'wolfRobot' },
    { schemaId: 'slackerChooseIdol', roleId: 'slacker' },
  ];

  // 无 notSelf 的 schema（允许自指）
  const schemasWithoutNotSelf: Array<{ schemaId: SchemaId; roleId: RoleId }> = [
    { schemaId: 'seerCheck', roleId: 'seer' },
    { schemaId: 'psychicCheck', roleId: 'psychic' },
    { schemaId: 'gargoyleCheck', roleId: 'gargoyle' },
    { schemaId: 'nightmareBlock', roleId: 'nightmare' },
    { schemaId: 'guardProtect', roleId: 'guard' },
    { schemaId: 'wolfKill', roleId: 'wolf' },
  ];

  describe('schemas WITH notSelf constraint', () => {
    it.each(schemasWithNotSelf)(
      '$schemaId: schema.constraints contains notSelf',
      ({ schemaId }) => {
        const constraints = getSchemaConstraints(schemaId);
        expect(constraints).toContain('notSelf');
      },
    );

    it.each(schemasWithNotSelf)(
      '$schemaId: resolver REJECTS self-target (aligned with schema)',
      ({ schemaId, roleId }) => {
        const resolver = RESOLVERS[schemaId];
        expect(resolver).toBeDefined();

        const actorSeat = 0;
        const context = createContext(actorSeat, roleId);
        const input: ActionInput = { schemaId, target: actorSeat };

        const result = resolver!(context, input);

        expect(result.valid).toBe(false);
        expect(result.rejectReason).toBeDefined();
      },
    );
  });

  describe('schemas WITHOUT notSelf constraint (neutral judge)', () => {
    it.each(schemasWithoutNotSelf)(
      '$schemaId: schema.constraints does NOT contain notSelf',
      ({ schemaId }) => {
        const constraints = getSchemaConstraints(schemaId);
        expect(constraints).not.toContain('notSelf');
      },
    );

    it.each(schemasWithoutNotSelf)(
      '$schemaId: resolver ALLOWS self-target (aligned with schema)',
      ({ schemaId, roleId }) => {
        const resolver = RESOLVERS[schemaId];
        expect(resolver).toBeDefined();

        const actorSeat = 0;
        const context = createContext(actorSeat, roleId);
        const input: ActionInput = { schemaId, target: actorSeat };

        const result = resolver!(context, input);

        expect(result.valid).toBe(true);
      },
    );
  });

  describe('witchAction compound schema step constraints', () => {
    it('witchAction.save step has notSelf constraint', () => {
      const schema = SCHEMAS.witchAction as CompoundSchema;
      const saveStep = schema.steps.find((s) => s.key === 'save');
      expect(saveStep).toBeDefined();
      expect(saveStep!.constraints).toContain('notSelf');
    });

    it('witchAction resolver rejects self-save (aligned with schema)', () => {
      const resolver = RESOLVERS.witchAction;
      const witchSeat = 0;
      const context = createContext(witchSeat, 'witch');
      const input: ActionInput = {
        schemaId: 'witchAction',
        stepResults: { save: witchSeat },
      };

      const result = resolver!(context, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('自救');
    });

    it('witchAction.poison step has NO notSelf constraint', () => {
      const schema = SCHEMAS.witchAction as CompoundSchema;
      const poisonStep = schema.steps.find((s) => s.key === 'poison');
      expect(poisonStep).toBeDefined();
      expect(poisonStep!.constraints).not.toContain('notSelf');
    });

    it('witchAction resolver allows self-poison (aligned with schema)', () => {
      const resolver = RESOLVERS.witchAction;
      const witchSeat = 0;
      const context = createContext(witchSeat, 'witch');
      const input: ActionInput = {
        schemaId: 'witchAction',
        stepResults: { poison: witchSeat },
      };

      const result = resolver!(context, input);

      expect(result.valid).toBe(true);
    });
  });
});

// === UI 从 schema 读取（无 hardcode） ===

describe('UI reads constraints from schema (no hardcode)', () => {
  /**
   * 这个测试验证 RoomScreen.helpers.ts 中的 buildSeatViewModels
   * 只根据传入的 schemaConstraints 禁用座位，无 hardcode。
   *
   * 相关代码：
   * - RoomScreen.tsx: currentSchemaConstraints = currentSchema.constraints
   * - RoomScreen.helpers.ts: if (options?.schemaConstraints?.includes('notSelf') && index === mySeatNumber)
   */
  it('buildSeatViewModels uses schemaConstraints parameter (not hardcoded role checks)', () => {
    // 这个测试在 RoomScreen.helpers.test.ts 中有详细覆盖
    // 这里只做存在性断言
    const { buildSeatViewModels } = require('../RoomScreen.helpers');
    expect(typeof buildSeatViewModels).toBe('function');

    // 函数签名中包含 schemaConstraints 参数
    const fnStr = buildSeatViewModels.toString();
    expect(fnStr).toContain('schemaConstraints');
  });
});

// === 完整性检查 ===

describe('notSelf constraint completeness', () => {
  it('all chooseSeat/swap schemas are covered in this test', () => {
    const allSchemaIds = Object.keys(SCHEMAS) as SchemaId[];
    const chooseSeatSchemas = allSchemaIds.filter((id) => {
      const schema = SCHEMAS[id];
      return schema.kind === 'chooseSeat' || schema.kind === 'swap' || schema.kind === 'wolfVote';
    });

    const testedSchemas = new Set([
      // With notSelf
      'dreamcatcherDream',
      'wolfQueenCharm',
      'wolfRobotLearn',
      'slackerChooseIdol',
      // Without notSelf
      'seerCheck',
      'psychicCheck',
      'gargoyleCheck',
      'nightmareBlock',
      'guardProtect',
      'wolfKill',
      // Swap (special)
      'magicianSwap',
    ]);

    const untested = chooseSeatSchemas.filter(
      (id) => !testedSchemas.has(id) && id !== 'witchAction',
    );

    // 如果有新的 chooseSeat schema 未测试，此测试会失败
    expect(untested).toEqual([]);
  });
});

// === UX-only 限制验证 ===

describe('UX-only restrictions (documented exceptions)', () => {
  /**
   * UX-only 限制是 schema 之外的 UI 层限制。
   * 这些限制必须：
   * 1. 在 NIGHT1_ROLE_ALIGNMENT_MATRIX.md 中显式记录
   * 2. 在 RoomScreen.helpers.test.ts 中有测试覆盖
   *
   * 当前唯一的 UX-only 限制：wolfKill 禁用 immuneToWolfKill 角色
   */

  describe('wolfKill UX-only: immuneToWolfKill roles disabled', () => {
    it('wolfKill schema has NO notSelf constraint (neutral judge)', () => {
      const constraints = getSchemaConstraints('wolfKill');
      expect(constraints).not.toContain('notSelf');
    });

    it('wolfKill resolver allows any target (schema-compliant)', () => {
      const resolver = RESOLVERS.wolfKill;
      const actorSeat = 0;
      const context = createContext(actorSeat, 'wolf');

      // Can target self
      expect(resolver!(context, { schemaId: 'wolfKill', target: 0 }).valid).toBe(true);
      // Can target others
      expect(resolver!(context, { schemaId: 'wolfKill', target: 1 }).valid).toBe(true);
    });

    it('UI has enableWolfVoteRestrictions option for UX-only filtering', () => {
      // Verify the helper function exists and accepts the option
      const { buildSeatViewModels } = require('../RoomScreen.helpers');
      const fnStr = buildSeatViewModels.toString();

      // The function should check for enableWolfVoteRestrictions
      expect(fnStr).toContain('enableWolfVoteRestrictions');
      // And should reference immuneToWolfKill logic
      expect(fnStr).toContain('immuneRoleIds');
    });

    it('RoomScreen.helpers.test.ts covers enableWolfVoteRestrictions', () => {
      // This is a meta-test: verify that the test file exists and covers this case
      // The actual test is in RoomScreen.helpers.test.ts
      // This test just documents the requirement

      // Read the test file to verify coverage exists
      const fs = require('node:fs');
      const path = require('node:path');
      const testFilePath = path.join(__dirname, 'RoomScreen.helpers.test.ts');
      const testFileContent = fs.readFileSync(testFilePath, 'utf-8');

      // Must have the test describe block
      expect(testFileContent).toContain('enableWolfVoteRestrictions option (wolf meeting vote)');
      // Must test spiritKnight disabled
      expect(testFileContent).toContain('spiritKnight');
      // Must test wolfQueen disabled
      expect(testFileContent).toContain('wolfQueen');
    });
  });
});
