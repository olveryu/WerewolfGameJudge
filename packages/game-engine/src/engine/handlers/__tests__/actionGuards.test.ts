/**
 * actionGuards Unit Tests
 *
 * Covers: isBottomCardActorOverride, isSkipAction, checkNightmareBlockGuard, validateActionPreconditions
 */

import type { ActionSchema } from '../../../models';
import { GameStatus } from '../../../models/GameStatus';
import {
  checkNightmareBlockGuard,
  isBottomCardActorOverride,
  isSkipAction,
  validateActionPreconditions,
} from '../actionGuards';
import type { NonNullState } from '../types';
import { expectError } from './handlerTestUtils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMinimalState(overrides?: Partial<NonNullState>): NonNullState {
  return {
    roomCode: 'TEST',
    hostUserId: 'host-1',
    status: GameStatus.Ongoing,
    templateRoles: ['wolf', 'seer', 'villager'],
    players: {
      0: { userId: 'p0', seat: 0, displayName: 'P0', role: 'seer', hasViewedRole: true },
      1: { userId: 'p1', seat: 1, displayName: 'P1', role: 'wolf', hasViewedRole: true },
      2: { userId: 'p2', seat: 2, displayName: 'P2', role: 'villager', hasViewedRole: true },
    },
    currentStepIndex: 0,
    currentStepId: 'seerCheck',
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    roster: {},
    ...overrides,
  } as NonNullState;
}

// =============================================================================
// isBottomCardActorOverride
// =============================================================================

describe('isBottomCardActorOverride', () => {
  it('should return false when no bottom card chosen', () => {
    const state = createMinimalState();
    expect(isBottomCardActorOverride(state, 'seerCheck')).toBe(false);
  });

  it('should return true when treasureMasterChosenCard matches step roleId', () => {
    const state = createMinimalState({ treasureMasterChosenCard: 'seer' });
    // seerCheck step has roleId 'seer'
    expect(isBottomCardActorOverride(state, 'seerCheck')).toBe(true);
  });

  it('should return false when treasureMasterChosenCard does not match', () => {
    const state = createMinimalState({ treasureMasterChosenCard: 'witch' });
    expect(isBottomCardActorOverride(state, 'seerCheck')).toBe(false);
  });

  it('should return true when thiefChosenCard matches step roleId', () => {
    const state = createMinimalState({ thiefChosenCard: 'seer' });
    expect(isBottomCardActorOverride(state, 'seerCheck')).toBe(true);
  });

  it('should return false when thiefChosenCard does not match', () => {
    const state = createMinimalState({ thiefChosenCard: 'guard' });
    expect(isBottomCardActorOverride(state, 'seerCheck')).toBe(false);
  });
});

// =============================================================================
// isSkipAction
// =============================================================================

describe('isSkipAction', () => {
  describe('confirm kind', () => {
    const schema = { kind: 'confirm' } as ActionSchema;

    it('should return true when confirmed is not true', () => {
      expect(isSkipAction(schema, { schemaId: 'hunterConfirm' })).toBe(true);
      expect(isSkipAction(schema, { schemaId: 'hunterConfirm', confirmed: false })).toBe(true);
    });

    it('should return false when confirmed is true', () => {
      expect(isSkipAction(schema, { schemaId: 'hunterConfirm', confirmed: true })).toBe(false);
    });
  });

  describe('chooseSeat kind', () => {
    const schema = { kind: 'chooseSeat' } as ActionSchema;

    it('should return true when target is undefined', () => {
      expect(isSkipAction(schema, { schemaId: 'seerCheck' })).toBe(true);
      expect(isSkipAction(schema, { schemaId: 'seerCheck', target: undefined })).toBe(true);
    });

    it('should return false when target is a seat number', () => {
      expect(isSkipAction(schema, { schemaId: 'seerCheck', target: 0 })).toBe(false);
      expect(isSkipAction(schema, { schemaId: 'seerCheck', target: 3 })).toBe(false);
    });
  });

  describe('wolfVote kind', () => {
    const schema = { kind: 'wolfVote' } as ActionSchema;

    it('should return true when target is null', () => {
      expect(isSkipAction(schema, { schemaId: 'wolfKill' })).toBe(true);
    });

    it('should return false when target is set', () => {
      expect(isSkipAction(schema, { schemaId: 'wolfKill', target: 2 })).toBe(false);
    });
  });

  describe('multiChooseSeat kind', () => {
    const schema = { kind: 'multiChooseSeat' } as ActionSchema;

    it('should return true when targets is empty or missing', () => {
      expect(isSkipAction(schema, { schemaId: 'piperHypnotize' })).toBe(true);
      expect(isSkipAction(schema, { schemaId: 'piperHypnotize', targets: [] })).toBe(true);
    });

    it('should return false when targets has values', () => {
      expect(isSkipAction(schema, { schemaId: 'piperHypnotize', targets: [1, 2] })).toBe(false);
    });
  });

  describe('swap kind', () => {
    const schema = { kind: 'swap' } as ActionSchema;

    it('should return true when targets is empty or missing', () => {
      expect(isSkipAction(schema, { schemaId: 'magicianSwap' })).toBe(true);
      expect(isSkipAction(schema, { schemaId: 'magicianSwap', targets: [] })).toBe(true);
    });

    it('should return false when targets has values', () => {
      expect(isSkipAction(schema, { schemaId: 'magicianSwap', targets: [0, 3] })).toBe(false);
    });
  });

  describe('compound kind', () => {
    const schema = { kind: 'compound' } as ActionSchema;

    it('should return true when stepResults is missing', () => {
      expect(isSkipAction(schema, { schemaId: 'witchAction' })).toBe(true);
    });

    it('should return true when all stepResults are null', () => {
      expect(
        isSkipAction(schema, {
          schemaId: 'witchAction',
          stepResults: { save: null, poison: null },
        }),
      ).toBe(true);
    });

    it('should return true when stepResults is empty object', () => {
      expect(isSkipAction(schema, { schemaId: 'witchAction', stepResults: {} })).toBe(true);
    });

    it('should return false when any stepResult is non-null', () => {
      expect(
        isSkipAction(schema, {
          schemaId: 'witchAction',
          stepResults: { save: 0, poison: null },
        }),
      ).toBe(false);
    });
  });

  describe('groupConfirm kind', () => {
    const schema = { kind: 'groupConfirm' } as ActionSchema;

    it('should always return false', () => {
      expect(isSkipAction(schema, { schemaId: 'wolfKill' })).toBe(false);
    });
  });

  describe('chooseCard kind', () => {
    const schema = { kind: 'chooseCard' } as ActionSchema;

    it('should return true when cardIndex is undefined', () => {
      expect(isSkipAction(schema, { schemaId: 'treasureMasterChoose' })).toBe(true);
      expect(
        isSkipAction(schema, {
          schemaId: 'treasureMasterChoose',
          cardIndex: undefined,
        }),
      ).toBe(true);
    });

    it('should return false when cardIndex is set', () => {
      expect(isSkipAction(schema, { schemaId: 'treasureMasterChoose', cardIndex: 0 })).toBe(false);
      expect(isSkipAction(schema, { schemaId: 'treasureMasterChoose', cardIndex: 2 })).toBe(false);
    });
  });
});

// =============================================================================
// checkNightmareBlockGuard
// =============================================================================

describe('checkNightmareBlockGuard', () => {
  describe('confirm schema', () => {
    const schema = { kind: 'confirm' } as ActionSchema;

    it('should reject skip when not blocked', () => {
      const reason = checkNightmareBlockGuard(0, schema, { schemaId: 'hunterConfirm' }, undefined);
      expect(reason).toBeDefined();
    });

    it('should allow confirmed action when not blocked', () => {
      const reason = checkNightmareBlockGuard(
        0,
        schema,
        { schemaId: 'hunterConfirm', confirmed: true },
        undefined,
      );
      expect(reason).toBeUndefined();
    });

    it('should reject confirmed action when blocked', () => {
      const reason = checkNightmareBlockGuard(
        0,
        schema,
        { schemaId: 'hunterConfirm', confirmed: true },
        0,
      );
      expect(reason).toBeDefined();
    });

    it('should allow skip when blocked', () => {
      const reason = checkNightmareBlockGuard(0, schema, { schemaId: 'hunterConfirm' }, 0);
      expect(reason).toBeUndefined();
    });
  });

  describe('chooseSeat schema', () => {
    const schema = { kind: 'chooseSeat' } as ActionSchema;

    it('should reject action when blocked', () => {
      const reason = checkNightmareBlockGuard(1, schema, { schemaId: 'seerCheck', target: 2 }, 1);
      expect(reason).toBeDefined();
    });

    it('should allow skip when blocked', () => {
      const reason = checkNightmareBlockGuard(1, schema, { schemaId: 'seerCheck' }, 1);
      expect(reason).toBeUndefined();
    });

    it('should allow action when not blocked', () => {
      const reason = checkNightmareBlockGuard(
        1,
        schema,
        { schemaId: 'seerCheck', target: 2 },
        undefined,
      );
      expect(reason).toBeUndefined();
    });

    it('should allow action when different seat is blocked', () => {
      const reason = checkNightmareBlockGuard(1, schema, { schemaId: 'seerCheck', target: 2 }, 3);
      expect(reason).toBeUndefined();
    });
  });
});

// =============================================================================
// validateActionPreconditions
// =============================================================================

describe('validateActionPreconditions', () => {
  it('should reject when state is null (Gate 1)', () => {
    const result = validateActionPreconditions(null, 0, 'seer');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      const err = expectError(result.result);
      expect(err.reason).toBe('no_state');
    }
  });

  it('should reject when status is not Ongoing (Gate 2)', () => {
    const state = createMinimalState({ status: GameStatus.Unseated });
    const result = validateActionPreconditions(state, 0, 'seer');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      const err = expectError(result.result);
      expect(err.reason).toBe('invalid_status');
    }
  });

  it('should reject when audio is playing (Gate 3)', () => {
    const state = createMinimalState({ isAudioPlaying: true });
    const result = validateActionPreconditions(state, 0, 'seer');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      const err = expectError(result.result);
      expect(err.reason).toBe('forbidden_while_audio_playing');
    }
  });

  it('should reject when currentStepId is null (Gate 4)', () => {
    const state = createMinimalState({ currentStepId: undefined });
    const result = validateActionPreconditions(state, 0, 'seer');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      const err = expectError(result.result);
      expect(err.reason).toBe('invalid_step');
    }
  });

  it('should reject when role does not match step (Gate 4b step_mismatch)', () => {
    // currentStepId is seerCheck, but submitting as wolf
    const state = createMinimalState({ currentStepId: 'seerCheck' });
    const result = validateActionPreconditions(state, 1, 'wolf');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      const err = expectError(result.result);
      expect(err.reason).toBe('step_mismatch');
    }
  });

  it('should reject when actor seat has no player (Gate 5)', () => {
    const state = createMinimalState({
      currentStepId: 'seerCheck',
      players: {
        0: null,
        1: { userId: 'p1', seat: 1, role: 'wolf', hasViewedRole: true },
      },
    });
    const result = validateActionPreconditions(state, 0, 'seer');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      const err = expectError(result.result);
      expect(err.reason).toBe('not_seated');
    }
  });

  it('should reject when player role does not match (Gate 5b)', () => {
    // Seat 0 has role 'seer', but submitting as 'witch'
    const state = createMinimalState({ currentStepId: 'seerCheck' });
    const result = validateActionPreconditions(state, 0, 'witch');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      const err = expectError(result.result);
      expect(err.reason).toMatch(/mismatch/);
    }
  });

  it('should succeed when all gates pass', () => {
    const state = createMinimalState({ currentStepId: 'seerCheck' });
    const result = validateActionPreconditions(state, 0, 'seer');
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.schemaId).toBe('seerCheck');
    }
  });
});
