/**
 * NightFlowController - Explicit State Machine for Night Phase Flow
 *
 * This controller manages the night phase state transitions independently
 * of GameStateService. It is designed to be:
 * - Pure: No side effects (no audio, no broadcast, no DB)
 * - Testable: All state transitions are synchronous and deterministic
 * - Explicit: State machine with clear phase definitions
 *
 * Integration with GameStateService will be done in a separate step.
 */

import { RoleId } from '../models/roles';
import { type NightPlan, type NightPlanStep } from '../models/roles/spec/plan.types';
import { nightFlowLog } from '../utils/logger';

// =============================================================================
// Night Phase State Machine
// =============================================================================

/**
 * Phases of the night flow state machine
 */
export enum NightPhase {
  /** Night has not started yet */
  Idle = 'Idle',
  /** Playing night begin audio */
  NightBeginAudio = 'NightBeginAudio',
  /** Playing role's beginning audio */
  RoleBeginAudio = 'RoleBeginAudio',
  /** Waiting for role action input */
  WaitingForAction = 'WaitingForAction',
  /** Playing role's ending audio */
  RoleEndAudio = 'RoleEndAudio',
  /** Playing night end audio */
  NightEndAudio = 'NightEndAudio',
  /** Night has ended, results ready */
  Ended = 'Ended',
}

/**
 * Events that can trigger state transitions
 */
export enum NightEvent {
  /** Start the night (from Idle) */
  StartNight = 'StartNight',
  /** Night begin audio finished */
  NightBeginAudioDone = 'NightBeginAudioDone',
  /** Role begin audio finished */
  RoleBeginAudioDone = 'RoleBeginAudioDone',
  /** Action submitted for current role */
  ActionSubmitted = 'ActionSubmitted',
  /** Role end audio finished */
  RoleEndAudioDone = 'RoleEndAudioDone',
  /** Night end audio finished */
  NightEndAudioDone = 'NightEndAudioDone',
  /** Reset to idle state */
  Reset = 'Reset',
}

/**
 * Immutable state snapshot of the night flow
 * Phase 5: actionOrder removed, use currentStep.roleId for current role
 */
export interface NightFlowState {
  readonly phase: NightPhase;
  readonly currentActionIndex: number;
  readonly actions: ReadonlyMap<RoleId, number>;
  /** Current step from NightPlan (null if no more steps) */
  readonly currentStep: NightPlanStep | null;
}

/**
 * Error thrown when an invalid state transition is attempted
 */
export class InvalidNightTransitionError extends Error {
  constructor(
    public readonly currentPhase: NightPhase,
    public readonly event: NightEvent,
  ) {
    super(`Invalid transition: cannot handle ${event} in phase ${currentPhase}`);
    this.name = 'InvalidNightTransitionError';
  }
}

// =============================================================================
// Controller Implementation
// =============================================================================

/**
 * NightFlowController - Manages night phase state machine
 *
 * Usage:
 * ```typescript
 * const controller = new NightFlowController(['wolf', 'witch', 'seer']);
 * controller.dispatch(NightEvent.StartNight);
 * // ... after audio plays ...
 * controller.dispatch(NightEvent.NightBeginAudioDone);
 * // ... etc
 * ```
 */
export class NightFlowController {
  private _phase: NightPhase = NightPhase.Idle;
  private readonly _nightPlan: NightPlan;
  private _currentActionIndex: number = 0;
  private _actions: Map<RoleId, number> = new Map();

  /**
   * Create a new NightFlowController from a NightPlan.
   * @param nightPlan - The night plan (table-driven action sequence)
   */
  constructor(nightPlan: NightPlan) {
    this._nightPlan = nightPlan;
  }

  // ===========================================================================
  // State Accessors (Read-only)
  // ===========================================================================

  get phase(): NightPhase {
    return this._phase;
  }

  /** Current NightPlanStep (null if no more steps) */
  get currentStep(): NightPlanStep | null {
    if (this._currentActionIndex >= this._nightPlan.steps.length) {
      return null;
    }
    return this._nightPlan.steps[this._currentActionIndex];
  }

  get currentRole(): RoleId | null {
    const step = this.currentStep;
    return step ? step.roleId : null;
  }

  get currentActionIndex(): number {
    return this._currentActionIndex;
  }

  get actions(): ReadonlyMap<RoleId, number> {
    return this._actions;
  }

  /**
   * Get immutable state snapshot
   * Phase 5: actionOrder removed, use currentStep.roleId instead
   */
  getState(): NightFlowState {
    return {
      phase: this._phase,
      currentActionIndex: this._currentActionIndex,
      actions: new Map(this._actions),
      currentStep: this.currentStep,
    };
  }

  /**
   * Check if night has more roles to process
   */
  hasMoreRoles(): boolean {
    return this._currentActionIndex < this._nightPlan.steps.length;
  }

  /**
   * Check if night is in a terminal state (Idle or Ended)
   */
  isTerminal(): boolean {
    return this._phase === NightPhase.Idle || this._phase === NightPhase.Ended;
  }

  // ===========================================================================
  // State Transitions
  // ===========================================================================

  /**
   * Dispatch an event to trigger state transition
   * @throws InvalidNightTransitionError if transition is not valid
   */
  dispatch(event: NightEvent): void {
    switch (event) {
      case NightEvent.StartNight:
        this.handleStartNight();
        break;
      case NightEvent.NightBeginAudioDone:
        this.handleNightBeginAudioDone();
        break;
      case NightEvent.RoleBeginAudioDone:
        this.handleRoleBeginAudioDone();
        break;
      case NightEvent.ActionSubmitted:
        this.handleActionSubmitted();
        break;
      case NightEvent.RoleEndAudioDone:
        this.handleRoleEndAudioDone();
        break;
      case NightEvent.NightEndAudioDone:
        this.handleNightEndAudioDone();
        break;
      case NightEvent.Reset:
        this.handleReset();
        break;
      default:
        throw new Error(`Unknown event: ${event}`);
    }
  }

  /**
   * Record an action for a role
   * Can only be called in WaitingForAction phase
   */
  recordAction(role: RoleId, target: number): void {
    if (this._phase !== NightPhase.WaitingForAction) {
      throw new InvalidNightTransitionError(this._phase, NightEvent.ActionSubmitted);
    }
    if (role !== this.currentRole) {
      throw new Error(`Cannot record action for ${role}: current role is ${this.currentRole}`);
    }
    this._actions.set(role, target);
    nightFlowLog.info('Action recorded', { role, target });
  }

  // ===========================================================================
  // Private Transition Handlers
  // ===========================================================================

  private handleStartNight(): void {
    if (this._phase !== NightPhase.Idle) {
      throw new InvalidNightTransitionError(this._phase, NightEvent.StartNight);
    }
    // Reset state for new night
    this._currentActionIndex = 0;
    this._actions = new Map();
    this._phase = NightPhase.NightBeginAudio;
    nightFlowLog.info('Night started', { steps: this._nightPlan.steps.length });
  }

  private handleNightBeginAudioDone(): void {
    if (this._phase !== NightPhase.NightBeginAudio) {
      throw new InvalidNightTransitionError(this._phase, NightEvent.NightBeginAudioDone);
    }
    this.transitionToNextRole();
  }

  private handleRoleBeginAudioDone(): void {
    if (this._phase !== NightPhase.RoleBeginAudio) {
      throw new InvalidNightTransitionError(this._phase, NightEvent.RoleBeginAudioDone);
    }
    this._phase = NightPhase.WaitingForAction;
    nightFlowLog.debug('Waiting for action', {
      role: this.currentRole,
      index: this._currentActionIndex,
    });
  }

  private handleActionSubmitted(): void {
    if (this._phase !== NightPhase.WaitingForAction) {
      throw new InvalidNightTransitionError(this._phase, NightEvent.ActionSubmitted);
    }
    this._phase = NightPhase.RoleEndAudio;
  }

  private handleRoleEndAudioDone(): void {
    if (this._phase !== NightPhase.RoleEndAudio) {
      throw new InvalidNightTransitionError(this._phase, NightEvent.RoleEndAudioDone);
    }
    // Advance to next role
    this._currentActionIndex++;
    this.transitionToNextRole();
  }

  private handleNightEndAudioDone(): void {
    if (this._phase !== NightPhase.NightEndAudio) {
      throw new InvalidNightTransitionError(this._phase, NightEvent.NightEndAudioDone);
    }
    this._phase = NightPhase.Ended;
    nightFlowLog.info('Night ended', { actionsCount: this._actions.size });
  }

  private handleReset(): void {
    // Reset is always allowed
    nightFlowLog.debug('Reset', { fromPhase: this._phase });
    this._phase = NightPhase.Idle;
    this._currentActionIndex = 0;
    this._actions = new Map();
  }

  /**
   * Transition to the next role or end night if no more roles
   */
  private transitionToNextRole(): void {
    if (this.hasMoreRoles()) {
      this._phase = NightPhase.RoleBeginAudio;
      nightFlowLog.debug('Next role', { role: this.currentRole, index: this._currentActionIndex });
    } else {
      this._phase = NightPhase.NightEndAudio;
      nightFlowLog.debug('All roles done, playing night end audio');
    }
  }
}

export default NightFlowController;
