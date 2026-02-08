/**
 * chooseSeat Batch Handler Contract Tests
 *
 * 使用 describe.each 批量验证所有 chooseSeat 类 schema 的 wire protocol：
 * - UI 发送 { schemaId, target: number | null }
 * - Handler 通过 buildActionInput 解析为 { schemaId, target }
 * - Resolver 接收 ActionInput，返回 ResolverResult
 *
 * 涵盖的 chooseSeat schemas:
 * - seerCheck, guardProtect, psychicCheck (神职)
 * - nightmareBlock, gargoyleCheck, wolfRobotLearn, wolfQueenCharm (狼职)
 * - dreamcatcherDream, slackerChooseIdol (其他)
 *
 * 注意：witchAction.steps[1].poison 是 compound 内嵌的 inline step，
 * 走 compound 路径，不在此测试范围。
 */

import { handleSubmitAction } from '@/services/engine/handlers/actionHandler';
import { SCHEMAS, BLOCKED_UI_DEFAULTS } from '@/models/roles/spec';
import type { SchemaId } from '@/models/roles/spec';
import type { HandlerContext } from '@/services/engine/handlers/types';
import type { SubmitActionIntent } from '@/services/engine/intents/types';
import type { GameState } from '@/services/engine/store/types';
import type { RoleId } from '@/models/roles';
import type { ApplyResolverResultAction } from '@/services/engine/reducer/types';

// =============================================================================
// Test Data
// =============================================================================

/**
 * chooseSeat schema 测试数据
 *
 * 每个条目包含：
 * - schemaId: 对应的 SchemaId
 * - role: 使用该 schema 的角色
 * - constraints: schema 约束（用于验证）
 * - hasReveal: 是否有 reveal 结果
 * - revealKey: reveal 结果的 key（如果有）
 */
interface ChooseSeatTestCase {
  schemaId: SchemaId;
  role: RoleId;
  constraints: readonly string[];
  hasReveal: boolean;
  revealKey?: 'seerReveal' | 'psychicReveal' | 'gargoyleReveal' | 'wolfRobotReveal';
}

const CHOOSE_SEAT_SCHEMAS: ChooseSeatTestCase[] = [
  // === 神职 ===
  {
    schemaId: 'seerCheck',
    role: 'seer',
    constraints: [],
    hasReveal: true,
    revealKey: 'seerReveal',
  },
  {
    schemaId: 'guardProtect',
    role: 'guard',
    constraints: [],
    hasReveal: false,
  },
  {
    schemaId: 'psychicCheck',
    role: 'psychic',
    constraints: [],
    hasReveal: true,
    revealKey: 'psychicReveal',
  },
  {
    schemaId: 'dreamcatcherDream',
    role: 'dreamcatcher',
    constraints: ['notSelf'],
    hasReveal: false,
  },

  // === 狼职 ===
  {
    schemaId: 'nightmareBlock',
    role: 'nightmare',
    constraints: [],
    hasReveal: false,
  },
  {
    schemaId: 'gargoyleCheck',
    role: 'gargoyle',
    constraints: [],
    hasReveal: true,
    revealKey: 'gargoyleReveal',
  },
  {
    schemaId: 'wolfRobotLearn',
    role: 'wolfRobot',
    constraints: ['notSelf'],
    hasReveal: true,
    revealKey: 'wolfRobotReveal',
  },
  {
    schemaId: 'wolfQueenCharm',
    role: 'wolfQueen',
    constraints: ['notSelf'],
    hasReveal: false,
  },

  // === 第三方 ===
  {
    schemaId: 'slackerChooseIdol',
    role: 'slacker',
    constraints: ['notSelf'],
    hasReveal: false,
  },
];

// =============================================================================
// Test Helpers
// =============================================================================

function createMinimalState(
  schemaId: SchemaId,
  role: RoleId,
  overrides?: Partial<GameState>,
): GameState {
  return {
    roomCode: 'TEST',
    hostUid: 'host-1',
    status: 'ongoing',
    templateRoles: ['villager', role, 'wolf'],
    players: {
      0: { uid: 'p1', seatNumber: 0, role: 'villager', hasViewedRole: true },
      1: { uid: 'p2', seatNumber: 1, role, hasViewedRole: true },
      2: { uid: 'p3', seatNumber: 2, role: 'wolf', hasViewedRole: true },
    },
    currentStepIndex: 1,
    isAudioPlaying: false,
    actions: [],
    currentNightResults: {},
    currentStepId: schemaId,
    ...overrides,
  };
}

function createContext(state: GameState, overrides?: Partial<HandlerContext>): HandlerContext {
  return {
    state,
    isHost: true,
    myUid: 'host-1',
    mySeat: 1,
    ...overrides,
  };
}

function getApplyResolverResult(result: ReturnType<typeof handleSubmitAction>) {
  return result.actions.find(
    (a): a is ApplyResolverResultAction => a.type === 'APPLY_RESOLVER_RESULT',
  );
}

// =============================================================================
// Batch Tests
// =============================================================================

describe('chooseSeat Batch Handler Contract', () => {
  describe('Schema Registry Validation', () => {
    it.each(CHOOSE_SEAT_SCHEMAS)(
      '$schemaId should be registered and have kind=chooseSeat',
      ({ schemaId }) => {
        const schema = SCHEMAS[schemaId];
        expect(schema).toBeDefined();
        expect(schema.kind).toBe('chooseSeat');
      },
    );

    it.each(CHOOSE_SEAT_SCHEMAS)(
      '$schemaId should have constraints matching test data',
      ({ schemaId, constraints }) => {
        const schema = SCHEMAS[schemaId];
        expect(schema.kind).toBe('chooseSeat');
        if (schema.kind === 'chooseSeat') {
          expect(schema.constraints).toEqual(constraints);
        }
      },
    );
  });

  describe('Wire Protocol: target field', () => {
    it.each(CHOOSE_SEAT_SCHEMAS)(
      '$schemaId - valid target: should accept and produce RECORD_ACTION + APPLY_RESOLVER_RESULT',
      ({ schemaId, role, hasReveal }) => {
        const state = createMinimalState(schemaId, role);
        const context = createContext(state);

        // target = 0（选择 villager）
        const intent: SubmitActionIntent = {
          type: 'SUBMIT_ACTION',
          payload: { seat: 1, role, target: 0, extra: {} },
        };

        const result = handleSubmitAction(intent, context);

        expect(result.success).toBe(true);
        // 有 reveal 的 schema 会额外产生 ADD_REVEAL_ACK action
        const expectedLength = hasReveal ? 3 : 2;
        expect(result.actions).toHaveLength(expectedLength);
        expect(result.actions[0].type).toBe('RECORD_ACTION');
        expect(result.actions[1].type).toBe('APPLY_RESOLVER_RESULT');
        if (hasReveal) {
          expect(result.actions[2].type).toBe('ADD_REVEAL_ACK');
        }
      },
    );

    // Filter schemas that have canSkip=true
    const canSkipSchemas = CHOOSE_SEAT_SCHEMAS.filter(({ schemaId }) => {
      const schema = SCHEMAS[schemaId];
      return 'canSkip' in schema && schema.canSkip === true;
    });

    it.each(canSkipSchemas)(
      '$schemaId - skip (target=null): should succeed when canSkip=true',
      ({ schemaId, role }) => {
        const state = createMinimalState(schemaId, role);
        const context = createContext(state);

        const intent: SubmitActionIntent = {
          type: 'SUBMIT_ACTION',
          payload: { seat: 1, role, target: null, extra: {} },
        };

        const result = handleSubmitAction(intent, context);

        expect(result.success).toBe(true);
      },
    );
  });

  describe('Constraint: notSelf', () => {
    const notSelfSchemas = CHOOSE_SEAT_SCHEMAS.filter((c) => c.constraints.includes('notSelf'));
    const allowSelfSchemas = CHOOSE_SEAT_SCHEMAS.filter((c) => !c.constraints.includes('notSelf'));

    it.each(notSelfSchemas)(
      '$schemaId - should reject self-target when notSelf constraint exists',
      ({ schemaId, role }) => {
        const state = createMinimalState(schemaId, role);
        const context = createContext(state);

        // target = 1（自己，座位 1）
        const intent: SubmitActionIntent = {
          type: 'SUBMIT_ACTION',
          payload: { seat: 1, role, target: 1, extra: {} },
        };

        const result = handleSubmitAction(intent, context);

        // 只断言失败，不断言具体文案（避免中文依赖）
        expect(result.success).toBe(false);
        expect(result.reason).toBeDefined();
      },
    );

    it.each(allowSelfSchemas)(
      '$schemaId - should allow self-target when no notSelf constraint (neutral judge)',
      ({ schemaId, role }) => {
        const state = createMinimalState(schemaId, role);
        const context = createContext(state);

        // target = 1（自己）
        const intent: SubmitActionIntent = {
          type: 'SUBMIT_ACTION',
          payload: { seat: 1, role, target: 1, extra: {} },
        };

        const result = handleSubmitAction(intent, context);

        expect(result.success).toBe(true);
      },
    );
  });

  describe('Nightmare Block Guard', () => {
    it.each(CHOOSE_SEAT_SCHEMAS)(
      '$schemaId - should reject blocked player with non-skip action',
      ({ schemaId, role }) => {
        const state = createMinimalState(schemaId, role, {
          currentNightResults: { blockedSeat: 1 }, // seat 1 (actor) is blocked
        });
        const context = createContext(state);

        const intent: SubmitActionIntent = {
          type: 'SUBMIT_ACTION',
          payload: { seat: 1, role, target: 0, extra: {} },
        };

        const result = handleSubmitAction(intent, context);

        expect(result.success).toBe(false);
        // 使用常量断言，避免中文文案依赖
        expect(result.reason).toBe(BLOCKED_UI_DEFAULTS.message);
      },
    );

    // Filter schemas that have canSkip=true
    const canSkipSchemas = CHOOSE_SEAT_SCHEMAS.filter(({ schemaId }) => {
      const schema = SCHEMAS[schemaId];
      return 'canSkip' in schema && schema.canSkip === true;
    });

    it.each(canSkipSchemas)(
      '$schemaId - should allow blocked player to skip',
      ({ schemaId, role }) => {
        const state = createMinimalState(schemaId, role, {
          currentNightResults: { blockedSeat: 1 },
        });
        const context = createContext(state);

        const intent: SubmitActionIntent = {
          type: 'SUBMIT_ACTION',
          payload: { seat: 1, role, target: null, extra: {} },
        };

        const result = handleSubmitAction(intent, context);

        expect(result.success).toBe(true);
      },
    );
  });

  describe('Reveal Results', () => {
    const revealSchemas = CHOOSE_SEAT_SCHEMAS.filter((c) => c.hasReveal);

    it.each(revealSchemas)(
      '$schemaId - should produce $revealKey in APPLY_RESOLVER_RESULT',
      ({ schemaId, role, revealKey }) => {
        const state = createMinimalState(schemaId, role);
        const context = createContext(state);

        const intent: SubmitActionIntent = {
          type: 'SUBMIT_ACTION',
          payload: { seat: 1, role, target: 0, extra: {} },
        };

        const result = handleSubmitAction(intent, context);

        expect(result.success).toBe(true);
        const applyAction = getApplyResolverResult(result);
        expect(applyAction).toBeDefined();

        // 验证 reveal 结果存在
        if (revealKey) {
          expect(applyAction!.payload[revealKey]).toBeDefined();
          expect(applyAction!.payload[revealKey]!.targetSeat).toBe(0);
        }
      },
    );
  });

  describe('Side Effects', () => {
    it.each(CHOOSE_SEAT_SCHEMAS)(
      '$schemaId - should produce BROADCAST_STATE and SAVE_STATE side effects',
      ({ schemaId, role }) => {
        const state = createMinimalState(schemaId, role);
        const context = createContext(state);

        const intent: SubmitActionIntent = {
          type: 'SUBMIT_ACTION',
          payload: { seat: 1, role, target: 0, extra: {} },
        };

        const result = handleSubmitAction(intent, context);

        expect(result.success).toBe(true);
        expect(result.sideEffects).toContainEqual({ type: 'BROADCAST_STATE' });
        expect(result.sideEffects).toContainEqual({ type: 'SAVE_STATE' });
      },
    );
  });
});

describe('chooseSeat canSkip=false edge case', () => {
  // slackerChooseIdol 是唯一 canSkip=false 的 chooseSeat
  it('slackerChooseIdol - should reject skip (target=null) when canSkip=false', () => {
    const state = createMinimalState('slackerChooseIdol', 'slacker');
    const context = createContext(state);

    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 1, role: 'slacker', target: null, extra: {} },
    };

    const result = handleSubmitAction(intent, context);

    // canSkip=false 时跳过应该失败
    // 注意：当前 handler 可能允许 skip，这里验证预期行为
    // 如果 handler 不校验 canSkip，此测试会失败，需要修复 handler
    expect(result.success).toBe(false);
  });
});
