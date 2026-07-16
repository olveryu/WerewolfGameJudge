/**
 * chooseSeat Batch Handler Contract Tests
 *
 * Uses describe.each to batch-verify the wire protocol for all chooseSeat schemas:
 * - UI sends { schemaId, target: number | null }
 * - Handler parses via buildActionInput into { schemaId, target }
 * - Resolver receives ActionInput, returns ResolverResult
 *
 * chooseSeat schemas covered:
 * - seerCheck, guardProtect, psychicCheck (good faction roles)
 * - nightmareBlock, gargoyleCheck, wolfRobotLearn, wolfQueenCharm (wolf roles)
 * - dreamcatcherDream, slackerChooseIdol (others)
 *
 * Note: witchAction.steps[1].poison is a compound-embedded inline step
 * that goes through the compound path and is out of scope here.
 */

import { handleSubmitAction as executeSubmitAction } from '@game-judge/game-engine/games/werewolf/domain/handlers/actionHandler';
import type { HandlerContext } from '@game-judge/game-engine/games/werewolf/domain/handlers/types';
import type { SubmitActionIntent } from '@game-judge/game-engine/games/werewolf/domain/intents/types';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/domain/models/GameStatus';
import type { RoleId } from '@game-judge/game-engine/games/werewolf/domain/models/roles';
import type { SchemaId } from '@game-judge/game-engine/games/werewolf/domain/models/roles/spec';
import {
  BLOCKED_UI_DEFAULTS,
  SCHEMAS,
} from '@game-judge/game-engine/games/werewolf/domain/models/roles/spec';
import { TargetConstraint } from '@game-judge/game-engine/games/werewolf/domain/models/roles/spec/schema.types';
import type { ApplyResolverResultAction } from '@game-judge/game-engine/games/werewolf/domain/reducer/types';
import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { WEREWOLF_STATE_IDENTITY } from '@game-judge/game-engine/games/werewolf/state/version';

import { expectRejection, expectSuccess, TEST_HANDLER_EXECUTION } from './handlerTestUtils';

function handleSubmitAction(intent: SubmitActionIntent, context: HandlerContext) {
  return executeSubmitAction(intent, context, TEST_HANDLER_EXECUTION);
}

// =============================================================================
// Test Data
// =============================================================================

/**
 * chooseSeat schema test data
 *
 * Each entry contains:
 * - schemaId: corresponding SchemaId
 * - role: role using this schema
 * - constraints: schema constraints (for validation)
 * - hasReveal: whether a reveal result is produced
 * - revealKey: key of the reveal result (if any)
 * - isRecordOnly: target is authoritative in ProtocolAction and needs no state mutation
 */
interface ChooseSeatTestCase {
  schemaId: SchemaId;
  role: RoleId;
  constraints: readonly (TargetConstraint | string)[];
  hasReveal: boolean;
  revealKey?: 'seerReveal' | 'psychicReveal' | 'gargoyleReveal' | 'wolfRobotReveal';
  isRecordOnly?: true;
}

const CHOOSE_SEAT_SCHEMAS: ChooseSeatTestCase[] = [
  {
    schemaId: 'seerCheck',
    role: 'seer',
    constraints: [TargetConstraint.NotSelf],
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
    constraints: [TargetConstraint.NotSelf],
    hasReveal: true,
    revealKey: 'psychicReveal',
  },
  {
    schemaId: 'dreamcatcherDream',
    role: 'dreamcatcher',
    constraints: [TargetConstraint.NotSelf],
    hasReveal: false,
  },

  // === Wolf roles ===
  {
    schemaId: 'nightmareBlock',
    role: 'nightmare',
    constraints: [],
    hasReveal: false,
  },
  {
    schemaId: 'gargoyleCheck',
    role: 'gargoyle',
    constraints: [TargetConstraint.NotSelf],
    hasReveal: true,
    revealKey: 'gargoyleReveal',
  },
  {
    schemaId: 'wolfRobotLearn',
    role: 'wolfRobot',
    constraints: [TargetConstraint.NotSelf],
    hasReveal: true,
    revealKey: 'wolfRobotReveal',
  },
  {
    schemaId: 'wolfQueenCharm',
    role: 'wolfQueen',
    constraints: [TargetConstraint.NotSelf],
    hasReveal: false,
  },

  // === Third-party ===
  {
    schemaId: 'slackerChooseIdol',
    role: 'slacker',
    constraints: [TargetConstraint.NotSelf],
    hasReveal: false,
    isRecordOnly: true,
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
    ...WEREWOLF_STATE_IDENTITY,
    roomCode: 'TEST',
    hostUserId: 'host-1',
    status: GameStatus.Ongoing,
    templateRoles: ['villager', role, 'wolf'],
    players: {
      0: { userId: 'p1', seat: 0, role: 'villager', hasViewedRole: true },
      1: { userId: 'p2', seat: 1, role, hasViewedRole: true },
      2: { userId: 'p3', seat: 2, role: 'wolf', hasViewedRole: true },
    },
    currentStepIndex: 1,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    hypnotizedSeats: [],
    piperRevealAcks: [],
    conversionRevealAcks: [],
    cupidLoversRevealAcks: [],
    roster: {},
    currentNightResults: {},
    currentStepId: schemaId,
    ...overrides,
  };
}

function createContext(state: GameState, overrides?: Partial<HandlerContext>): HandlerContext {
  return {
    state,
    myUserId: 'host-1',
    mySeat: 1,
    ...overrides,
  };
}

function getApplyResolverResult(result: { actions: readonly { type: string }[] }) {
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
      '$schemaId - valid target: should emit its canonical action sequence',
      ({ schemaId, role, hasReveal, isRecordOnly }) => {
        const state = createMinimalState(schemaId, role);
        const context = createContext(state);

        // target = 0 (selects villager)
        const intent: SubmitActionIntent = {
          type: 'SUBMIT_ACTION',
          payload: { seat: 1, role: role, actionInput: { schemaId, target: 0 } },
        };

        const result = handleSubmitAction(intent, context);

        const success = expectSuccess(result);
        const expectedActionTypes = hasReveal
          ? ['RECORD_ACTION', 'APPLY_RESOLVER_RESULT', 'ADD_REVEAL_ACK']
          : isRecordOnly
            ? ['RECORD_ACTION']
            : ['RECORD_ACTION', 'APPLY_RESOLVER_RESULT'];
        expect(success.actions.map((action) => action.type)).toEqual(expectedActionTypes);
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
          payload: { seat: 1, role: role, actionInput: { schemaId } },
        };

        const result = handleSubmitAction(intent, context);

        expectSuccess(result);
      },
    );
  });

  describe('Constraint: notSelf', () => {
    const notSelfSchemas = CHOOSE_SEAT_SCHEMAS.filter((c) =>
      c.constraints.includes(TargetConstraint.NotSelf),
    );
    const allowSelfSchemas = CHOOSE_SEAT_SCHEMAS.filter(
      (c) => !c.constraints.includes(TargetConstraint.NotSelf),
    );

    it.each(notSelfSchemas)(
      '$schemaId - should reject self-target when notSelf constraint exists',
      ({ schemaId, role }) => {
        const state = createMinimalState(schemaId, role);
        const context = createContext(state);

        // target = 1 (self, seat 1)
        const intent: SubmitActionIntent = {
          type: 'SUBMIT_ACTION',
          payload: { seat: 1, role: role, actionInput: { schemaId, target: 1 } },
        };

        const result = handleSubmitAction(intent, context);

        // assert only failure, not specific text (avoid Chinese dependency)
        const rej = expectRejection(result);
        expect(rej.reason).toBeDefined();
      },
    );

    it.each(allowSelfSchemas)(
      '$schemaId - should allow self-target when no notSelf constraint (neutral judge)',
      ({ schemaId, role }) => {
        const state = createMinimalState(schemaId, role);
        const context = createContext(state);

        // target = 1 (self)
        const intent: SubmitActionIntent = {
          type: 'SUBMIT_ACTION',
          payload: { seat: 1, role: role, actionInput: { schemaId, target: 1 } },
        };

        const result = handleSubmitAction(intent, context);

        expectSuccess(result);
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
          payload: { seat: 1, role: role, actionInput: { schemaId, target: 0 } },
        };

        const result = handleSubmitAction(intent, context);

        const rej = expectRejection(result);
        // assert against constant to avoid Chinese text dependency
        expect(rej.reason).toBe(BLOCKED_UI_DEFAULTS.message);
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
          payload: { seat: 1, role: role, actionInput: { schemaId } },
        };

        const result = handleSubmitAction(intent, context);

        expectSuccess(result);
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
          payload: { seat: 1, role: role, actionInput: { schemaId, target: 0 } },
        };

        const result = handleSubmitAction(intent, context);

        const success = expectSuccess(result);
        const applyAction = getApplyResolverResult(success);
        expect(applyAction).toBeDefined();

        // verify reveal result exists
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
          payload: { seat: 1, role: role, actionInput: { schemaId, target: 0 } },
        };

        const result = handleSubmitAction(intent, context);

        const success = expectSuccess(result);
        expect(success.sideEffects).toContainEqual({ type: 'BROADCAST_STATE' });
        expect(success.sideEffects).toContainEqual({ type: 'SAVE_STATE' });
      },
    );
  });
});

describe('chooseSeat canSkip=false edge case', () => {
  // slackerChooseIdol is the only canSkip=false chooseSeat
  it('slackerChooseIdol - should reject skip (target=null) when canSkip=false', () => {
    const state = createMinimalState('slackerChooseIdol', 'slacker');
    const context = createContext(state);

    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 1, role: 'slacker', actionInput: { schemaId: 'slackerChooseIdol' } },
    };

    const result = handleSubmitAction(intent, context);

    // skip should fail when canSkip=false
    // Note: current handler may allow skip; this verifies expected behavior
    // If handler does not validate canSkip, this test fails and handler must be fixed
    expectRejection(result);
  });
});
