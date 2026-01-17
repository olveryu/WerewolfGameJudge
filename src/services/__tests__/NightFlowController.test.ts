/**
 * NightFlowController Unit Tests
 *
 * Tests the night phase state machine transitions:
 * - Happy path: complete night flow
 * - Invalid transitions: error handling
 * - Edge cases: empty action order, reset
 */

import {
  NightFlowController,
  NightPhase,
  NightEvent,
  InvalidNightTransitionError,
} from '../NightFlowController';
import { buildNightPlan, type NightPlan } from '../../models/roles/spec/plan';

/** Helper: build NightPlan from role list for testing */
const buildTestPlan = (roles: string[]): NightPlan => {
  return buildNightPlan(roles);
};

/** Helper: create minimal NightPlan for unit tests (bypass ROLE_SPECS validation) - kept for future use */
const _createMinimalPlan = (roleIds: string[]): NightPlan => {
  return {
    steps: roleIds.map((roleId, idx) => ({
      roleId: roleId as any,
      stepId: `${roleId}Action` as any,
      order: idx,
      displayName: roleId,
      audioKey: roleId,
      actsSolo: false,
    })),
    length: roleIds.length,
  };
};

describe('NightFlowController', () => {
  // ===========================================================================
  // Happy Path Tests
  // ===========================================================================

  describe('Happy Path - Complete Night Flow', () => {
    it('should start in Idle phase', () => {
      const plan = buildTestPlan(['wolf', 'witch', 'seer']);
      const controller = new NightFlowController(plan);
      expect(controller.phase).toBe(NightPhase.Idle);
      expect(controller.currentRole).toBe('wolf');
      expect(controller.currentActionIndex).toBe(0);
    });

    it('should expose currentStep from NightPlan', () => {
      const plan = buildTestPlan(['wolf', 'witch', 'seer']);
      const controller = new NightFlowController(plan);

      const step = controller.currentStep;
      expect(step).not.toBeNull();
      expect(step?.roleId).toBe('wolf');
      expect(step?.stepId).toBe('wolfKill');
    });

    it('should complete full night flow with 3 roles', () => {
      const plan = buildTestPlan(['wolf', 'witch', 'seer']);
      const controller = new NightFlowController(plan);

      // Start night
      controller.dispatch(NightEvent.StartNight);
      expect(controller.phase).toBe(NightPhase.NightBeginAudio);

      // Night begin audio done -> first role (wolf)
      controller.dispatch(NightEvent.NightBeginAudioDone);
      expect(controller.phase).toBe(NightPhase.RoleBeginAudio);
      expect(controller.currentRole).toBe('wolf');

      // Wolf turn
      controller.dispatch(NightEvent.RoleBeginAudioDone);
      expect(controller.phase).toBe(NightPhase.WaitingForAction);

      controller.recordAction('wolf', 3); // Wolf kills seat 3
      controller.dispatch(NightEvent.ActionSubmitted);
      expect(controller.phase).toBe(NightPhase.RoleEndAudio);

      controller.dispatch(NightEvent.RoleEndAudioDone);
      expect(controller.phase).toBe(NightPhase.RoleBeginAudio);
      expect(controller.currentRole).toBe('witch');

      // Witch turn
      controller.dispatch(NightEvent.RoleBeginAudioDone);
      expect(controller.phase).toBe(NightPhase.WaitingForAction);

      controller.recordAction('witch', -1); // Witch does nothing
      controller.dispatch(NightEvent.ActionSubmitted);
      expect(controller.phase).toBe(NightPhase.RoleEndAudio);

      controller.dispatch(NightEvent.RoleEndAudioDone);
      expect(controller.phase).toBe(NightPhase.RoleBeginAudio);
      expect(controller.currentRole).toBe('seer');

      // Seer turn
      controller.dispatch(NightEvent.RoleBeginAudioDone);
      expect(controller.phase).toBe(NightPhase.WaitingForAction);

      controller.recordAction('seer', 5); // Seer checks seat 5
      controller.dispatch(NightEvent.ActionSubmitted);
      expect(controller.phase).toBe(NightPhase.RoleEndAudio);

      controller.dispatch(NightEvent.RoleEndAudioDone);
      // No more roles -> night end audio
      expect(controller.phase).toBe(NightPhase.NightEndAudio);

      // Night end
      controller.dispatch(NightEvent.NightEndAudioDone);
      expect(controller.phase).toBe(NightPhase.Ended);
      expect(controller.isTerminal()).toBe(true);

      // Verify actions were recorded
      expect(controller.actions.get('wolf')).toBe(3);
      expect(controller.actions.get('witch')).toBe(-1);
      expect(controller.actions.get('seer')).toBe(5);
    });

    it('should handle empty action order (no roles with night actions)', () => {
      const emptyPlan: NightPlan = { steps: [], length: 0 };
      const controller = new NightFlowController(emptyPlan);

      controller.dispatch(NightEvent.StartNight);
      expect(controller.phase).toBe(NightPhase.NightBeginAudio);

      // No roles -> go directly to night end audio
      controller.dispatch(NightEvent.NightBeginAudioDone);
      expect(controller.phase).toBe(NightPhase.NightEndAudio);
      expect(controller.hasMoreRoles()).toBe(false);

      controller.dispatch(NightEvent.NightEndAudioDone);
      expect(controller.phase).toBe(NightPhase.Ended);
    });

    it('should handle single role night', () => {
      const plan = buildTestPlan(['wolf']);
      const controller = new NightFlowController(plan);

      controller.dispatch(NightEvent.StartNight);
      controller.dispatch(NightEvent.NightBeginAudioDone);
      expect(controller.currentRole).toBe('wolf');

      controller.dispatch(NightEvent.RoleBeginAudioDone);
      controller.recordAction('wolf', 2);
      controller.dispatch(NightEvent.ActionSubmitted);
      controller.dispatch(NightEvent.RoleEndAudioDone);

      // After wolf, no more roles
      expect(controller.phase).toBe(NightPhase.NightEndAudio);
      expect(controller.hasMoreRoles()).toBe(false);
    });
  });

  // ===========================================================================
  // Invalid Transition Tests
  // ===========================================================================

  describe('Invalid Transitions', () => {
    it('should throw when StartNight called in non-Idle phase', () => {
      const plan = buildTestPlan(['wolf']);
      const controller = new NightFlowController(plan);
      controller.dispatch(NightEvent.StartNight);
      expect(controller.phase).toBe(NightPhase.NightBeginAudio);

      expect(() => {
        controller.dispatch(NightEvent.StartNight);
      }).toThrow(InvalidNightTransitionError);
    });

    it('should throw when NightBeginAudioDone called in wrong phase', () => {
      const plan = buildTestPlan(['wolf']);
      const controller = new NightFlowController(plan);
      // Still in Idle

      expect(() => {
        controller.dispatch(NightEvent.NightBeginAudioDone);
      }).toThrow(InvalidNightTransitionError);
    });

    it('should throw when ActionSubmitted called outside WaitingForAction', () => {
      const plan = buildTestPlan(['wolf']);
      const controller = new NightFlowController(plan);
      controller.dispatch(NightEvent.StartNight);
      // In NightBeginAudio, not WaitingForAction

      expect(() => {
        controller.dispatch(NightEvent.ActionSubmitted);
      }).toThrow(InvalidNightTransitionError);
    });

    it('should throw when recording action for wrong role', () => {
      const plan = buildTestPlan(['wolf', 'witch']);
      const controller = new NightFlowController(plan);
      controller.dispatch(NightEvent.StartNight);
      controller.dispatch(NightEvent.NightBeginAudioDone);
      controller.dispatch(NightEvent.RoleBeginAudioDone);
      // Now waiting for wolf action

      expect(() => {
        controller.recordAction('witch', 1); // Wrong role!
      }).toThrow('Cannot record action for witch: current role is wolf');
    });

    it('should throw when recording action outside WaitingForAction phase', () => {
      const plan = buildTestPlan(['wolf']);
      const controller = new NightFlowController(plan);
      controller.dispatch(NightEvent.StartNight);
      // In NightBeginAudio phase

      expect(() => {
        controller.recordAction('wolf', 1);
      }).toThrow(InvalidNightTransitionError);
    });
  });

  // ===========================================================================
  // Reset Tests
  // ===========================================================================

  describe('Reset', () => {
    it('should reset from any phase to Idle', () => {
      const plan = buildTestPlan(['wolf', 'witch']);
      const controller = new NightFlowController(plan);

      // Go to middle of night
      controller.dispatch(NightEvent.StartNight);
      controller.dispatch(NightEvent.NightBeginAudioDone);
      controller.dispatch(NightEvent.RoleBeginAudioDone);
      controller.recordAction('wolf', 1);
      expect(controller.actions.size).toBe(1);

      // Reset
      controller.dispatch(NightEvent.Reset);
      expect(controller.phase).toBe(NightPhase.Idle);
      expect(controller.currentActionIndex).toBe(0);
      expect(controller.actions.size).toBe(0);
    });

    it('should allow starting new night after reset', () => {
      const plan = buildTestPlan(['wolf']);
      const controller = new NightFlowController(plan);

      // Complete a night
      controller.dispatch(NightEvent.StartNight);
      controller.dispatch(NightEvent.NightBeginAudioDone);
      controller.dispatch(NightEvent.RoleBeginAudioDone);
      controller.recordAction('wolf', 1);
      controller.dispatch(NightEvent.ActionSubmitted);
      controller.dispatch(NightEvent.RoleEndAudioDone);
      controller.dispatch(NightEvent.NightEndAudioDone);
      expect(controller.phase).toBe(NightPhase.Ended);

      // Reset and start again
      controller.dispatch(NightEvent.Reset);
      expect(controller.phase).toBe(NightPhase.Idle);

      controller.dispatch(NightEvent.StartNight);
      expect(controller.phase).toBe(NightPhase.NightBeginAudio);
    });
  });

  // ===========================================================================
  // State Snapshot Tests
  // ===========================================================================

  describe('State Snapshot', () => {
    it('should return immutable state snapshot', () => {
      const plan = buildTestPlan(['wolf', 'witch']);
      const controller = new NightFlowController(plan);
      controller.dispatch(NightEvent.StartNight);
      controller.dispatch(NightEvent.NightBeginAudioDone);
      controller.dispatch(NightEvent.RoleBeginAudioDone);
      controller.recordAction('wolf', 3);

      const state = controller.getState();

      expect(state.phase).toBe(NightPhase.WaitingForAction);
      // Phase 5: actionOrder removed, verify via currentStep.roleId instead
      expect(state.currentStep?.roleId).toBe('wolf');
      expect(state.currentActionIndex).toBe(0);
      expect(state.actions.get('wolf')).toBe(3);

      // Verify it's a copy (modifying doesn't affect controller)
      (state.actions as Map<string, number>).set('wolf', 999);
      expect(controller.actions.get('wolf')).toBe(3);
    });

    it('should correctly report hasMoreRoles', () => {
      const plan = buildTestPlan(['wolf']);
      const controller = new NightFlowController(plan);
      expect(controller.hasMoreRoles()).toBe(true);

      controller.dispatch(NightEvent.StartNight);
      controller.dispatch(NightEvent.NightBeginAudioDone);
      expect(controller.hasMoreRoles()).toBe(true);

      controller.dispatch(NightEvent.RoleBeginAudioDone);
      controller.recordAction('wolf', 1);
      controller.dispatch(NightEvent.ActionSubmitted);
      controller.dispatch(NightEvent.RoleEndAudioDone);

      expect(controller.hasMoreRoles()).toBe(false);
    });

    it('should correctly report isTerminal', () => {
      const plan = buildTestPlan(['wolf']);
      const controller = new NightFlowController(plan);
      expect(controller.isTerminal()).toBe(true); // Idle is terminal

      controller.dispatch(NightEvent.StartNight);
      expect(controller.isTerminal()).toBe(false);

      // Complete night
      controller.dispatch(NightEvent.NightBeginAudioDone);
      controller.dispatch(NightEvent.RoleBeginAudioDone);
      controller.recordAction('wolf', 1);
      controller.dispatch(NightEvent.ActionSubmitted);
      controller.dispatch(NightEvent.RoleEndAudioDone);
      controller.dispatch(NightEvent.NightEndAudioDone);

      expect(controller.isTerminal()).toBe(true); // Ended is terminal
    });
  });
});
