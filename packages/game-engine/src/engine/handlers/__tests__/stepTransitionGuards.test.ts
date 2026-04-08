/**
 * stepTransitionGuards Unit Tests
 *
 * Covers: validateNightFlowPreconditions, validateSetAudioPlayingPreconditions
 */

import { GameStatus } from '../../../models/GameStatus';
import { WOLF_ROBOT_GATE_ROLES } from '../revealPayload';
import {
  validateNightFlowPreconditions,
  validateSetAudioPlayingPreconditions,
} from '../stepTransitionGuards';
import type { HandlerContext, NonNullState } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMinimalState(overrides?: Partial<NonNullState>): NonNullState {
  return {
    roomCode: 'TEST',
    hostUid: 'host-1',
    status: GameStatus.Ongoing,
    templateRoles: ['wolf', 'seer', 'villager'],
    players: {},
    currentStepIndex: 0,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    ...overrides,
  } as NonNullState;
}

function createContext(state: NonNullState | null): HandlerContext {
  return { state, myUid: 'host-1', mySeat: 0 };
}

// =============================================================================
// validateNightFlowPreconditions
// =============================================================================

describe('validateNightFlowPreconditions', () => {
  it('should reject when state is null (Gate 1)', () => {
    const result = validateNightFlowPreconditions(createContext(null));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.result.reason).toBe('no_state');
  });

  it('should reject when status is not Ongoing (Gate 2)', () => {
    const state = createMinimalState({ status: GameStatus.Unseated });
    const result = validateNightFlowPreconditions(createContext(state));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.result.reason).toBe('invalid_status');
  });

  it('should reject when audio is playing (Gate 3)', () => {
    const state = createMinimalState({ isAudioPlaying: true });
    const result = validateNightFlowPreconditions(createContext(state));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.result.reason).toBe('forbidden_while_audio_playing');
  });

  it('should reject when wolfRobot learned a gate role but not viewed (Gate 4)', () => {
    const gateTriggerRole = WOLF_ROBOT_GATE_ROLES[0]; // e.g. 'hunter'
    const state = createMinimalState({
      currentStepId: 'wolfRobotLearn',
      wolfRobotReveal: {
        targetSeat: 3,
        result: gateTriggerRole as any,
        learnedRoleId: gateTriggerRole as any,
      },
      wolfRobotHunterStatusViewed: false,
    } as Partial<NonNullState>);
    const result = validateNightFlowPreconditions(createContext(state));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.result.reason).toBe('wolfrobot_hunter_status_not_viewed');
  });

  it('should pass when wolfRobot learned a gate role and already viewed', () => {
    const gateTriggerRole = WOLF_ROBOT_GATE_ROLES[0];
    const state = createMinimalState({
      currentStepId: 'wolfRobotLearn',
      wolfRobotReveal: {
        targetSeat: 3,
        result: gateTriggerRole as any,
        learnedRoleId: gateTriggerRole as any,
      },
      wolfRobotHunterStatusViewed: true,
    } as Partial<NonNullState>);
    const result = validateNightFlowPreconditions(createContext(state));
    expect(result.valid).toBe(true);
  });

  it('should pass when wolfRobot learned a non-gate role (no gate check)', () => {
    const state = createMinimalState({
      currentStepId: 'wolfRobotLearn',
      wolfRobotReveal: {
        targetSeat: 3,
        result: 'villager' as any,
        learnedRoleId: 'villager',
      },
      wolfRobotHunterStatusViewed: false,
    } as Partial<NonNullState>);
    const result = validateNightFlowPreconditions(createContext(state));
    expect(result.valid).toBe(true);
  });

  it('should pass when all gates satisfied', () => {
    const state = createMinimalState();
    const result = validateNightFlowPreconditions(createContext(state));
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.state).toBe(state);
  });
});

// =============================================================================
// validateSetAudioPlayingPreconditions
// =============================================================================

describe('validateSetAudioPlayingPreconditions', () => {
  it('should reject when state is null', () => {
    const result = validateSetAudioPlayingPreconditions(createContext(null));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.result.reason).toBe('no_state');
  });

  it('should reject when status is Unseated', () => {
    const state = createMinimalState({ status: GameStatus.Unseated });
    const result = validateSetAudioPlayingPreconditions(createContext(state));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.result.reason).toBe('invalid_status');
  });

  it('should pass when status is Ongoing', () => {
    const state = createMinimalState({ status: GameStatus.Ongoing });
    const result = validateSetAudioPlayingPreconditions(createContext(state));
    expect(result.valid).toBe(true);
  });

  it('should pass when status is Ended (for dawn audio)', () => {
    const state = createMinimalState({ status: GameStatus.Ended });
    const result = validateSetAudioPlayingPreconditions(createContext(state));
    expect(result.valid).toBe(true);
  });

  it('should not check isAudioPlaying (this handler sets it)', () => {
    const state = createMinimalState({ isAudioPlaying: true });
    const result = validateSetAudioPlayingPreconditions(createContext(state));
    expect(result.valid).toBe(true);
  });
});
