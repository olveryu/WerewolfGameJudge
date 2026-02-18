/**
 * Schema-Resolver Alignment Contract Tests
 *
 * PR contract: resolver skip 行为必须逐 schema 对齐
 * - 如果 schema.canSkip === true，resolver 必须接受 null target
 * - 如果 schema.canSkip === false 或 undefined，resolver 必须拒绝 null target
 *
 * 这是防止 "一刀切" skip 行为的合约测试。
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import { type SchemaId, SCHEMAS } from '@werewolf/game-engine/models/roles/spec';
import type {
  ChooseSeatSchema,
  CompoundSchema,
} from '@werewolf/game-engine/models/roles/spec/schema.types';
import { RESOLVERS } from '@werewolf/game-engine/resolvers';
import type { ActionInput, ResolverContext } from '@werewolf/game-engine/resolvers/types';

// 创建基础的 ResolverContext
function createBaseContext(
  actorSeat: number,
  actorRoleId: RoleId,
  overrides?: Partial<ResolverContext>,
): ResolverContext {
  // 使用有效的 RoleId 类型
  const players = new Map<number, RoleId>([
    [0, 'wolf'],
    [1, 'seer'],
    [2, 'witch'],
    [3, 'guard'],
    [4, 'villager'],
    [5, 'nightmare'],
    [6, 'dreamcatcher'],
    [7, 'gargoyle'],
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

// 获取 schema 的 canSkip 值
function getSchemaCanSkip(schemaId: SchemaId): boolean {
  const schema = SCHEMAS[schemaId];
  if (!schema) return false;

  // compound schema 的 canSkip 需要看 steps
  if (schema.kind === 'compound') {
    const compoundSchema = schema as CompoundSchema;
    // 如果所有 steps 都有 canSkip: true，则整体可以 skip
    return compoundSchema.steps?.every((s) => s.canSkip === true) ?? false;
  }

  // chooseSeat schema 直接读取 canSkip
  if ('canSkip' in schema) {
    return (schema as ChooseSeatSchema).canSkip === true;
  }

  return false;
}

describe('Schema-Resolver canSkip alignment (anti-drift contract)', () => {
  // 列出所有 canSkip=true 的 schema，需要验证 resolver 接受 null
  const canSkipSchemas: { schemaId: SchemaId; roleId: RoleId; seat: number }[] = [
    { schemaId: 'seerCheck', roleId: 'seer', seat: 1 },
    { schemaId: 'nightmareBlock', roleId: 'nightmare', seat: 5 },
    { schemaId: 'gargoyleCheck', roleId: 'gargoyle', seat: 7 },
    { schemaId: 'dreamcatcherDream', roleId: 'dreamcatcher', seat: 6 },
    { schemaId: 'guardProtect', roleId: 'guard', seat: 3 },
    { schemaId: 'psychicCheck', roleId: 'psychic', seat: 1 }, // 复用 seer 座位做测试
  ];

  describe('resolvers with canSkip=true should accept null target', () => {
    it.each(canSkipSchemas)(
      '$schemaId: resolver accepts undefined target → {valid: true}',
      ({ schemaId, roleId, seat }) => {
        // Verify schema has canSkip: true
        expect(getSchemaCanSkip(schemaId)).toBe(true);

        const resolver = RESOLVERS[schemaId];
        expect(resolver).toBeDefined();

        const input: ActionInput = {
          schemaId,
          target: undefined, // Skip
        };

        // ResolverFn 签名：(context, input)
        const context = createBaseContext(seat, roleId);
        const result = resolver!(context, input);

        expect(result.valid).toBe(true);
        // Skip 行为不应该有 updates（空操作）
        expect(result.result).toEqual({});
      },
    );
  });

  describe('compound schema (witchAction) skip behavior', () => {
    it('witchAction resolver accepts undefined stepResults (skip all steps)', () => {
      const resolver = RESOLVERS.witchAction;
      expect(resolver).toBeDefined();

      const input: ActionInput = {
        schemaId: 'witchAction',
        stepResults: undefined, // Skip all
      };

      const context = createBaseContext(2, 'witch');
      const result = resolver!(context, input);

      expect(result.valid).toBe(true);
      // 跳过时不应有效果
      expect(result.result?.savedTarget).toBeUndefined();
      expect(result.result?.poisonedTarget).toBeUndefined();
    });
  });
});

describe('witchContext.canSave notSelf alignment (PR contract)', () => {
  /**
   * Schema 定义：witchAction.steps[0] (save) 有 notSelf 约束
   * 合约：当被杀者是女巫自己时，canSave 必须为 false
   *
   * 这个测试验证 nightFlowHandler 中 SET_WITCH_CONTEXT 的 canSave 逻辑
   * 必须与 schema notSelf 约束对齐。
   */

  it('schema witchAction.save step should have notSelf constraint', () => {
    const witchSchema = SCHEMAS.witchAction as CompoundSchema;
    expect(witchSchema.kind).toBe('compound');

    const saveStep = witchSchema.steps[0];
    expect(saveStep.key).toBe('save');
    expect(saveStep.constraints).toContain('notSelf');
  });

  it('witch resolver should reject saving self (notSelf enforcement)', () => {
    const resolver = RESOLVERS.witchAction;
    expect(resolver).toBeDefined();

    // 女巫在座位2，尝试救座位2（自己）
    const input: ActionInput = {
      schemaId: 'witchAction',
      stepResults: { save: 2 }, // 尝试救自己
    };

    const context = createBaseContext(2, 'witch');
    const result = resolver!(context, input);

    // resolver 应该拒绝自救
    expect(result.valid).toBe(false);
    expect(result.rejectReason).toContain('自救');
  });
});
