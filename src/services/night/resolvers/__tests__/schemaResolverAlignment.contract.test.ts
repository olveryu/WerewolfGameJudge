/**
 * Schema-Resolver Alignment Contract Tests
 *
 * PR contract: resolver skip 行为必须逐 schema 对齐
 * - 如果 schema.canSkip === true，resolver 必须接受 null target
 * - 如果 schema.canSkip === false 或 undefined，resolver 必须拒绝 null target
 *
 * 这是防止 "一刀切" skip 行为的合约测试。
 */

import type { RoleId } from '@/models/roles';
import { type SchemaId,SCHEMAS } from '@/models/roles/spec';
import type { ChooseSeatSchema,CompoundSchema } from '@/models/roles/spec/schema.types';
import { RESOLVERS } from '@/services/night/resolvers/index';
import type { ActionInput, ResolverContext } from '@/services/night/resolvers/types';

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

describe('evaluateNightProgression idempotency (PR contract)', () => {
  /**
   * 合约：evaluateNightProgression 必须是幂等的
   * - 同一 {revision, currentStepId} 最多推进一次
   * - 重复调用应该返回 action: 'none', reason: 'already_processed'
   */

  it('returns none on repeated calls with same state (idempotent)', () => {
    const {
      evaluateNightProgression,
      createProgressionTracker,
    } = require('@/services/engine/handlers/progressionEvaluator');

    const state = {
      status: 'ongoing',
      isAudioPlaying: false,
      currentStepId: 'wolfKill',
      currentStepIndex: 0,
      players: {
        0: { role: 'wolf' },
        1: { role: 'villager' },
      },
      currentNightResults: { wolfVotesBySeat: { '0': 1 } }, // Wolf has voted
      actions: [],
      templateRoles: ['wolf', 'villager'],
    };

    const tracker = createProgressionTracker();

    // First call should return 'advance' (wolf vote complete)
    // revision=1, currentStepId='wolfKill'
    const result1 = evaluateNightProgression(state, 1, tracker, true);
    expect(result1.action).toBe('advance');
    expect(result1.reason).toBe('step_complete');

    // Second call with same state and revision should return 'none' (idempotent)
    const result2 = evaluateNightProgression(state, 1, tracker, true);
    expect(result2.action).toBe('none');
    expect(result2.reason).toBe('already_processed');
  });

  it('allows progression after state changes', () => {
    const {
      evaluateNightProgression,
      createProgressionTracker,
    } = require('@/services/engine/handlers/progressionEvaluator');

    const tracker = createProgressionTracker();

    const state1 = {
      status: 'ongoing',
      isAudioPlaying: false,
      currentStepId: 'wolfKill',
      currentStepIndex: 0,
      players: { 0: { role: 'wolf' } },
      currentNightResults: { wolfVotesBySeat: { '0': 1 } },
      actions: [],
      templateRoles: ['wolf'],
    };

    // First call with revision=1
    const result1 = evaluateNightProgression(state1, 1, tracker, true);
    expect(result1.action).toBe('advance');

    // State changed (new step, revision incremented after advanceNight)
    const state2 = {
      ...state1,
      currentStepId: undefined, // No more steps
      currentStepIndex: 1,
    };

    // Should allow new progression (different revision)
    const result2 = evaluateNightProgression(state2, 2, tracker, true);
    expect(result2.action).toBe('end_night');
    expect(result2.reason).toBe('no_more_steps');
  });

  it('returns none when not host', () => {
    const { evaluateNightProgression } = require('@/services/engine/handlers/progressionEvaluator');

    const state = {
      status: 'ongoing',
      isAudioPlaying: false,
      currentStepId: 'wolfKill',
      currentStepIndex: 0,
      players: {},
      actions: [],
      templateRoles: [],
    };

    // evaluateNightProgression(state, revision, tracker, isHost)
    const result = evaluateNightProgression(state, 1, undefined, false); // isHost = false
    expect(result.action).toBe('none');
    expect(result.reason).toBe('not_host');
  });

  it('returns none when audio is playing', () => {
    const { evaluateNightProgression } = require('@/services/engine/handlers/progressionEvaluator');

    const state = {
      status: 'ongoing',
      isAudioPlaying: true, // Audio playing
      currentStepId: 'wolfKill',
      currentStepIndex: 0,
      players: {},
      actions: [],
      templateRoles: [],
    };

    // evaluateNightProgression(state, revision, tracker, isHost)
    const result = evaluateNightProgression(state, 1, undefined, true);
    expect(result.action).toBe('none');
    expect(result.reason).toBe('audio_playing');
  });
});
