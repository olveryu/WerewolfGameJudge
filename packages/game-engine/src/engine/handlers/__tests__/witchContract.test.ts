/**
 * Witch Handler Contract Tests
 *
 * Verifies the wire protocol for witch actions:
 * 1. `buildActionInput` correctly parses `extra.stepResults`
 * 2. `isSkipAction` correctly identifies skip for compound schema
 * 3. Handler produces correct `updates` (savedSeat/poisonedSeat)
 */

import {
  handleSubmitAction,
  isSkipAction,
} from '@werewolf/game-engine/engine/handlers/actionHandler';
import type { HandlerContext } from '@werewolf/game-engine/engine/handlers/types';
import type { SubmitActionIntent } from '@werewolf/game-engine/engine/intents/types';
import type { ApplyResolverResultAction } from '@werewolf/game-engine/engine/reducer/types';
import type { GameState } from '@werewolf/game-engine/engine/store/types';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { SchemaId } from '@werewolf/game-engine/models/roles/spec';
import { SCHEMAS } from '@werewolf/game-engine/models/roles/spec';

import { expectSuccess } from './handlerTestUtils';

// =============================================================================
// Test Helpers
// =============================================================================

function createMinimalState(overrides?: Partial<GameState>): GameState {
  return {
    roomCode: 'TEST',
    hostUserId: 'host-1',
    status: GameStatus.Ongoing,
    templateRoles: ['villager', 'wolf', 'witch'],
    players: {
      0: { userId: 'p0', seat: 0, role: 'villager', hasViewedRole: true },
      1: { userId: 'p1', seat: 1, role: 'wolf', hasViewedRole: true },
      2: { userId: 'p2', seat: 2, role: 'villager', hasViewedRole: true },
      3: { userId: 'p3', seat: 3, role: 'witch', hasViewedRole: true },
    },
    currentStepIndex: 0,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    roster: {},
    currentNightResults: {},
    currentStepId: 'witchAction' as SchemaId,
    witchContext: { killedSeat: 0, canSave: true, canPoison: true },
    ...overrides,
  };
}

function createContext(state: GameState, overrides?: Partial<HandlerContext>): HandlerContext {
  return {
    state,
    myUserId: 'host-1',
    mySeat: 3,
    ...overrides,
  };
}

function getApplyResolverResult(result: { actions: readonly { type: string }[] }) {
  const action = result.actions.find(
    (a): a is ApplyResolverResultAction => a.type === 'APPLY_RESOLVER_RESULT',
  );
  return action;
}

// =============================================================================
// buildActionInput + isSkipAction Tests
// =============================================================================

describe('Witch buildActionInput contract', () => {
  describe('stepResults parsing', () => {
    it('should parse stepResults.save correctly', () => {
      const state = createMinimalState({
        currentNightResults: { wolfVotesBySeat: { '1': 0 } }, // wolf killed seat 0
      });
      const context = createContext(state);
      const intent: SubmitActionIntent = {
        type: 'SUBMIT_ACTION',
        payload: {
          seat: 3,
          role: 'witch',
          target: null,
          extra: { stepResults: { save: 0, poison: null } },
        },
      };

      const result = handleSubmitAction(intent, context);

      const success = expectSuccess(result);
      const applyAction = getApplyResolverResult(success);
      expect(applyAction?.payload.updates?.savedSeat).toBe(0);
    });

    it('should parse stepResults.poison correctly', () => {
      const state = createMinimalState();
      const context = createContext(state);
      const intent: SubmitActionIntent = {
        type: 'SUBMIT_ACTION',
        payload: {
          seat: 3,
          role: 'witch',
          target: null,
          extra: { stepResults: { save: null, poison: 2 } },
        },
      };

      const result = handleSubmitAction(intent, context);

      const success = expectSuccess(result);
      const applyAction = getApplyResolverResult(success);
      expect(applyAction?.payload.updates?.poisonedSeat).toBe(2);
    });

    it('should parse stepResults with both null as skip', () => {
      const state = createMinimalState();
      const context = createContext(state);
      const intent: SubmitActionIntent = {
        type: 'SUBMIT_ACTION',
        payload: {
          seat: 3,
          role: 'witch',
          target: null,
          extra: { stepResults: { save: null, poison: null } },
        },
      };

      const result = handleSubmitAction(intent, context);

      const success = expectSuccess(result);
      const applyAction = getApplyResolverResult(success);
      // Skip means no updates to savedSeat/poisonedSeat
      expect(applyAction?.payload.updates?.savedSeat).toBeUndefined();
      expect(applyAction?.payload.updates?.poisonedSeat).toBeUndefined();
    });
  });
});

describe('isSkipAction for compound (witch)', () => {
  const witchSchema = SCHEMAS.witchAction;

  it('should return true when stepResults is undefined', () => {
    const actionInput = { schemaId: 'witchAction' as SchemaId };
    expect(isSkipAction(witchSchema, actionInput)).toBe(true);
  });

  it('should return true when all stepResults values are null', () => {
    const actionInput = {
      schemaId: 'witchAction' as SchemaId,
      stepResults: { save: null, poison: null },
    };
    expect(isSkipAction(witchSchema, actionInput)).toBe(true);
  });

  it('should return false when save has a value', () => {
    const actionInput = {
      schemaId: 'witchAction' as SchemaId,
      stepResults: { save: 0, poison: null },
    };
    expect(isSkipAction(witchSchema, actionInput)).toBe(false);
  });

  it('should return false when poison has a value', () => {
    const actionInput = {
      schemaId: 'witchAction' as SchemaId,
      stepResults: { save: null, poison: 2 },
    };
    expect(isSkipAction(witchSchema, actionInput)).toBe(false);
  });
});
