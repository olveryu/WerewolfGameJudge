/**
 * gateContracts.contract.test.ts
 *
 * Fail-fast gate/contract tests for actionHandler invariants.
 * Each test locks a behavioral invariant that, if broken, would cause
 * silent failures or incorrect game state.
 *
 * Categories:
 * 1. Nightmare blocked reason stability (stable identifier, not Chinese text)
 * 2. Audio gate priority at handler level (forbidden_while_audio_playing beats other gates)
 * 3. Duplicate submit / already-acted idempotency (step_mismatch after progression)
 * 4. BLOCKED_UI_DEFAULTS.message is the single source of truth for nightmare rejection
 */

import {
  checkNightmareBlockGuard,
  handleSubmitAction,
  handleSubmitWolfVote,
} from '@werewolf/game-engine/engine/handlers/actionHandler';
import type { HandlerContext } from '@werewolf/game-engine/engine/handlers/types';
import type {
  SubmitActionIntent,
  SubmitWolfVoteIntent,
} from '@werewolf/game-engine/engine/intents/types';
import type { GameState } from '@werewolf/game-engine/engine/store/types';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { SchemaId } from '@werewolf/game-engine/models/roles/spec';
import { BLOCKED_UI_DEFAULTS, SCHEMAS } from '@werewolf/game-engine/models/roles/spec';

// =============================================================================
// Helpers
// =============================================================================

function createMinimalState(overrides?: Partial<GameState>): GameState {
  return {
    roomCode: 'TEST',
    hostUid: 'host-1',
    status: GameStatus.Ongoing,
    templateRoles: ['villager', 'wolf', 'seer'],
    players: {
      0: { uid: 'p1', seatNumber: 0, role: 'villager', hasViewedRole: true },
      1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
      2: { uid: 'p3', seatNumber: 2, role: 'seer', hasViewedRole: true },
    },
    currentStepIndex: 0,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    currentNightResults: {},
    ...overrides,
  };
}

function createContext(state: GameState, overrides?: Partial<HandlerContext>): HandlerContext {
  return {
    state,
    isHost: true,
    myUid: 'host-1',
    mySeat: 0,
    ...overrides,
  };
}

// =============================================================================
// 1. Nightmare Blocked Reason Stability
// =============================================================================

describe('Gate Contract: nightmare blocked reason stability', () => {
  /**
   * Invariant: checkNightmareBlockGuard returns BLOCKED_UI_DEFAULTS.message
   * as the reject reason (single source of truth).
   *
   * This ensures UI can match on a stable identifier rather than hard-coded
   * Chinese text. If BLOCKED_UI_DEFAULTS.message changes, all downstream
   * consumers automatically update.
   */

  it('blocked chooseSeat rejection reason === BLOCKED_UI_DEFAULTS.message (single source)', () => {
    const reason = checkNightmareBlockGuard(
      0,
      SCHEMAS.seerCheck,
      { schemaId: 'seerCheck', target: 1 },
      0, // blockedSeat
    );
    expect(reason).toBe(BLOCKED_UI_DEFAULTS.message);
    // Ensure it's a non-empty string (fail-fast if constant becomes empty)
    expect(typeof reason).toBe('string');
    expect(reason!.length).toBeGreaterThan(0);
  });

  it('blocked confirm rejection reason === BLOCKED_UI_DEFAULTS.message (single source)', () => {
    const reason = checkNightmareBlockGuard(
      0,
      SCHEMAS.hunterConfirm,
      { schemaId: 'hunterConfirm', confirmed: true },
      0,
    );
    expect(reason).toBe(BLOCKED_UI_DEFAULTS.message);
  });

  it('blocked swap rejection reason === BLOCKED_UI_DEFAULTS.message (single source)', () => {
    const reason = checkNightmareBlockGuard(
      0,
      SCHEMAS.magicianSwap,
      { schemaId: 'magicianSwap', targets: [1, 2] },
      0,
    );
    expect(reason).toBe(BLOCKED_UI_DEFAULTS.message);
  });

  it('blocked wolfVote rejection reason === BLOCKED_UI_DEFAULTS.message (single source)', () => {
    const reason = checkNightmareBlockGuard(
      0,
      SCHEMAS.wolfKill,
      { schemaId: 'wolfKill', target: 1 },
      0,
    );
    expect(reason).toBe(BLOCKED_UI_DEFAULTS.message);
  });

  it('non-blocked confirm skip rejection uses distinct reason (not BLOCKED_UI_DEFAULTS)', () => {
    const reason = checkNightmareBlockGuard(
      0,
      SCHEMAS.hunterConfirm,
      { schemaId: 'hunterConfirm', confirmed: false },
      99, // not blocked
    );
    // Must be a distinct reason from BLOCKED_UI_DEFAULTS.message
    expect(reason).not.toBe(BLOCKED_UI_DEFAULTS.message);
    expect(reason).toBe('当前无法跳过，请执行行动');
  });

  /**
   * Invariant: handleSubmitAction with blocked seat produces ACTION_REJECTED
   * with reason containing BLOCKED_UI_DEFAULTS.message — end-to-end contract
   */
  it('handleSubmitAction end-to-end: blocked seer → ACTION_REJECTED with stable reason', () => {
    const state = createMinimalState({
      currentStepId: 'seerCheck' as SchemaId,
      players: {
        0: { uid: 'p1', seatNumber: 0, role: 'seer', hasViewedRole: true },
        1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
      },
      currentNightResults: { blockedSeat: 0 },
    });
    const context = createContext(state);
    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 0, role: 'seer', target: 1, extra: {} },
    };

    const result = handleSubmitAction(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe(BLOCKED_UI_DEFAULTS.message);
    // Must produce ACTION_REJECTED action for UI broadcast
    const rejectedAction = result.actions.find((a) => a.type === 'ACTION_REJECTED');
    expect(rejectedAction).toBeTruthy();
    expect((rejectedAction as any).payload.reason).toBe(BLOCKED_UI_DEFAULTS.message);
  });

  /**
   * Invariant: blocked but skip → success (no rejection, progression allowed)
   */
  it('handleSubmitAction: blocked seer skip → success (progression continues)', () => {
    const state = createMinimalState({
      currentStepId: 'seerCheck' as SchemaId,
      players: {
        0: { uid: 'p1', seatNumber: 0, role: 'seer', hasViewedRole: true },
        1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
      },
      currentNightResults: { blockedSeat: 0 },
    });
    const context = createContext(state);
    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 0, role: 'seer', target: null, extra: {} },
    };

    const result = handleSubmitAction(intent, context);

    expect(result.success).toBe(true);
    // Must produce RECORD_ACTION so progression can advance
    expect(result.actions.some((a) => a.type === 'RECORD_ACTION')).toBe(true);
  });
});

// =============================================================================
// 2. Audio Gate Priority at Handler Level
// =============================================================================

describe('Gate Contract: audio gate priority (handler level)', () => {
  /**
   * Invariant: forbidden_while_audio_playing is Gate 4 in validateActionPreconditions.
   * It MUST fire before step validation, seat validation, role validation, and resolver.
   *
   * This ensures audio playback always blocks action submission, regardless of
   * other state conditions.
   */

  it('forbidden_while_audio_playing beats step_mismatch (submitAction)', () => {
    const state = createMinimalState({
      isAudioPlaying: true,
      currentStepId: 'seerCheck' as SchemaId,
      players: {
        0: { uid: 'p1', seatNumber: 0, role: 'guard', hasViewedRole: true }, // wrong role for step
      },
    });
    const context = createContext(state);
    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 0, role: 'guard', target: 1, extra: {} },
    };

    const result = handleSubmitAction(intent, context);

    expect(result.success).toBe(false);
    // Must be audio gate, NOT step_mismatch
    expect(result.reason).toBe('forbidden_while_audio_playing');
  });

  it('forbidden_while_audio_playing beats not_seated (submitAction)', () => {
    const state = createMinimalState({
      isAudioPlaying: true,
      currentStepId: 'seerCheck' as SchemaId,
      players: {
        0: null, // empty seat
        1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
      },
    });
    const context = createContext(state);
    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 0, role: 'seer', target: 1, extra: {} },
    };

    const result = handleSubmitAction(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('forbidden_while_audio_playing');
  });

  it('forbidden_while_audio_playing beats role_mismatch (submitAction)', () => {
    const state = createMinimalState({
      isAudioPlaying: true,
      currentStepId: 'seerCheck' as SchemaId,
      players: {
        2: { uid: 'p3', seatNumber: 2, role: 'villager', hasViewedRole: true }, // not seer
      },
    });
    const context = createContext(state);
    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 2, role: 'seer', target: 0, extra: {} },
    };

    const result = handleSubmitAction(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('forbidden_while_audio_playing');
  });

  it('forbidden_while_audio_playing beats nightmare block (submitAction)', () => {
    const state = createMinimalState({
      isAudioPlaying: true,
      currentStepId: 'seerCheck' as SchemaId,
      players: {
        0: { uid: 'p1', seatNumber: 0, role: 'seer', hasViewedRole: true },
      },
      currentNightResults: { blockedSeat: 0 },
    });
    const context = createContext(state);
    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 0, role: 'seer', target: 1, extra: {} },
    };

    const result = handleSubmitAction(intent, context);

    expect(result.success).toBe(false);
    // Audio gate must fire BEFORE nightmare block guard
    expect(result.reason).toBe('forbidden_while_audio_playing');
  });

  it('forbidden_while_audio_playing beats wolf-specific gates (submitWolfVote)', () => {
    const state = createMinimalState({
      isAudioPlaying: true,
      currentStepId: 'wolfKill' as SchemaId,
      players: {
        0: { uid: 'p1', seatNumber: 0, role: 'villager', hasViewedRole: true }, // not wolf
      },
    });
    const context = createContext(state);
    const intent: SubmitWolfVoteIntent = {
      type: 'SUBMIT_WOLF_VOTE',
      payload: { seat: 0, target: 1 },
    };

    const result = handleSubmitWolfVote(intent, context);

    expect(result.success).toBe(false);
    // Audio gate must fire before not_wolf_participant
    expect(result.reason).toBe('forbidden_while_audio_playing');
  });
});

// =============================================================================
// 3. Duplicate Submit / Step Mismatch Idempotency
// =============================================================================

describe('Gate Contract: duplicate submit idempotency', () => {
  /**
   * Invariant: After a successful action, if progression advances currentStepId,
   * a second submit for the same role/step MUST be rejected with step_mismatch.
   *
   * This is the primary dedup mechanism: RECORD_ACTION → progression → step advances
   * → subsequent submit hits step_mismatch gate.
   */

  it('second submit after step advances → step_mismatch', () => {
    // First submit: seer checks seat 1 (success)
    const state1 = createMinimalState({
      currentStepId: 'seerCheck' as SchemaId,
      players: {
        0: { uid: 'p1', seatNumber: 0, role: 'seer', hasViewedRole: true },
        1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
      },
    });
    const context1 = createContext(state1);
    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 0, role: 'seer', target: 1, extra: {} },
    };

    const result1 = handleSubmitAction(intent, context1);
    expect(result1.success).toBe(true);

    // After progression: currentStepId has changed to next step
    const state2 = createMinimalState({
      currentStepId: 'witchAction' as SchemaId, // advanced past seerCheck
      players: {
        0: { uid: 'p1', seatNumber: 0, role: 'seer', hasViewedRole: true },
        1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
        3: { uid: 'p4', seatNumber: 3, role: 'witch', hasViewedRole: true },
      },
    });
    const context2 = createContext(state2);

    // Second submit for seer (same role, but step has advanced)
    const result2 = handleSubmitAction(intent, context2);
    expect(result2.success).toBe(false);
    expect(result2.reason).toBe('step_mismatch');
  });

  it('same-step re-submit (pre-progression) → resolver processes again (no handler-level dedup)', () => {
    // This tests the invariant that the handler does NOT have its own already_acted gate.
    // Dedup is achieved through progression (step advancement), not handler-level tracking.
    // If resolver is idempotent (produces same result), this is safe.
    const state = createMinimalState({
      currentStepId: 'seerCheck' as SchemaId,
      players: {
        0: { uid: 'p1', seatNumber: 0, role: 'seer', hasViewedRole: true },
        1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
      },
    });
    const context = createContext(state);
    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 0, role: 'seer', target: 1, extra: {} },
    };

    // First submit
    const result1 = handleSubmitAction(intent, context);
    expect(result1.success).toBe(true);

    // Same-step re-submit (progression hasn't happened yet)
    // Handler has no already_acted gate; resolver processes again
    const result2 = handleSubmitAction(intent, context);
    expect(result2.success).toBe(true);

    // Both produce RECORD_ACTION (idempotent at resolver level)
    expect(result1.actions.some((a) => a.type === 'RECORD_ACTION')).toBe(true);
    expect(result2.actions.some((a) => a.type === 'RECORD_ACTION')).toBe(true);
  });

  it('wolf vote after step advances → step_mismatch', () => {
    // Wolf vote succeeds
    const state1 = createMinimalState({
      currentStepId: 'wolfKill' as SchemaId,
      players: {
        0: { uid: 'p1', seatNumber: 0, role: 'villager', hasViewedRole: true },
        1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
      },
    });
    const context1 = createContext(state1);
    const intent1: SubmitWolfVoteIntent = {
      type: 'SUBMIT_WOLF_VOTE',
      payload: { seat: 1, target: 0 },
    };

    const result1 = handleSubmitWolfVote(intent1, context1);
    expect(result1.success).toBe(true);

    // After progression: step advanced to seerCheck
    const state2 = createMinimalState({
      currentStepId: 'seerCheck' as SchemaId,
      players: {
        0: { uid: 'p1', seatNumber: 0, role: 'villager', hasViewedRole: true },
        1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
        2: { uid: 'p3', seatNumber: 2, role: 'seer', hasViewedRole: true },
      },
    });
    const context2 = createContext(state2);

    // Second wolf vote (step has advanced past wolfKill)
    const result2 = handleSubmitWolfVote(intent1, context2);
    expect(result2.success).toBe(false);
    expect(result2.reason).toBe('step_mismatch');
  });

  /**
   * Invariant: invalid_status gate prevents submit after game ends
   * (another form of "post-game duplicate")
   */
  it('submit after game ended → invalid_status', () => {
    const state = createMinimalState({
      status: GameStatus.Ended,
      currentStepId: 'seerCheck' as SchemaId,
    });
    const context = createContext(state);
    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 2, role: 'seer', target: 0, extra: {} },
    };

    const result = handleSubmitAction(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_status');
  });
});

// =============================================================================
// 4. BLOCKED_UI_DEFAULTS Single Source of Truth
// =============================================================================

describe('Gate Contract: BLOCKED_UI_DEFAULTS is non-empty and structured', () => {
  /**
   * Fail-fast: BLOCKED_UI_DEFAULTS must have all required fields with non-empty values.
   * If any field is accidentally emptied, this catches it immediately.
   */

  it('BLOCKED_UI_DEFAULTS.message is a non-empty string', () => {
    expect(typeof BLOCKED_UI_DEFAULTS.message).toBe('string');
    expect(BLOCKED_UI_DEFAULTS.message.length).toBeGreaterThan(0);
  });

  it('BLOCKED_UI_DEFAULTS.title is a non-empty string', () => {
    expect(typeof BLOCKED_UI_DEFAULTS.title).toBe('string');
    expect(BLOCKED_UI_DEFAULTS.title.length).toBeGreaterThan(0);
  });

  it('BLOCKED_UI_DEFAULTS.skipButtonText is a non-empty string', () => {
    expect(typeof BLOCKED_UI_DEFAULTS.skipButtonText).toBe('string');
    expect(BLOCKED_UI_DEFAULTS.skipButtonText.length).toBeGreaterThan(0);
  });

  it('BLOCKED_UI_DEFAULTS.dismissButtonText is a non-empty string', () => {
    expect(typeof BLOCKED_UI_DEFAULTS.dismissButtonText).toBe('string');
    expect(BLOCKED_UI_DEFAULTS.dismissButtonText.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// 5. Gate Ordering Contract
// =============================================================================

describe('Gate Contract: validateActionPreconditions gate ordering', () => {
  /**
   * Invariant: gates are evaluated in strict order.
   * Lower-numbered gates MUST fire before higher-numbered gates.
   * This prevents confusing error messages when multiple conditions fail.
   */

  it('host_only fires before no_state', () => {
    const context = createContext(null as unknown as GameState, { isHost: false });
    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 0, role: 'seer', target: 1, extra: {} },
    };

    const result = handleSubmitAction(intent, context);
    expect(result.reason).toBe('host_only');
  });

  it('no_state fires before invalid_status', () => {
    const context: HandlerContext = {
      state: null as unknown as GameState,
      isHost: true,
      myUid: 'host-1',
      mySeat: 0,
    };
    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 0, role: 'seer', target: 1, extra: {} },
    };

    const result = handleSubmitAction(intent, context);
    expect(result.reason).toBe('no_state');
  });

  it('invalid_status fires before forbidden_while_audio_playing', () => {
    const state = createMinimalState({
      status: GameStatus.Ended,
      isAudioPlaying: true,
    });
    const context = createContext(state);
    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 0, role: 'seer', target: 1, extra: {} },
    };

    const result = handleSubmitAction(intent, context);
    expect(result.reason).toBe('invalid_status');
  });

  it('forbidden_while_audio_playing fires before invalid_step', () => {
    const state = createMinimalState({
      isAudioPlaying: true,
      currentStepId: undefined,
    });
    const context = createContext(state);
    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 0, role: 'seer', target: 1, extra: {} },
    };

    const result = handleSubmitAction(intent, context);
    expect(result.reason).toBe('forbidden_while_audio_playing');
  });

  it('invalid_step fires before not_seated', () => {
    const state = createMinimalState({
      currentStepId: undefined,
      players: { 0: null },
    });
    const context = createContext(state);
    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 0, role: 'seer', target: 1, extra: {} },
    };

    const result = handleSubmitAction(intent, context);
    expect(result.reason).toBe('invalid_step');
  });
});
