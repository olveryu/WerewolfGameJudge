/**
 * NightEngine - 夜晚流程控制引擎 (完整状态机实现)
 *
 * 职责：
 * - 夜晚状态机管理 (显式 Phase + Event)
 * - 步骤序列控制 (基于 NightPlan)
 * - 行动记录
 *
 * 不做的事：
 * - 音频播放 (Audio 职责)
 * - 状态广播 (HostEngine 职责)
 * - 行动解析 (Resolver 职责)
 *
 * 设计原则：
 * - 纯函数：无副作用 (无音频，无广播，无 DB)
 * - 可测试：所有状态转换同步且确定性
 * - 显式状态机：清晰的 Phase 定义
 */

import { buildNightPlan } from '../../../models/roles';
import type { RoleId } from '../../../models/roles';
import type { NightPlan, NightPlanStep } from '../../../models/roles/spec/plan.types';
import { nightFlowLog } from '../../../utils/logger';
import type { LocalGameState } from '../infra/StateStore';

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
// Re-export types
// =============================================================================

export type { NightPlanStep } from '../../../models/roles/spec/plan.types';

// =============================================================================
// Types
// =============================================================================

/** Night step info for UI/audio */
export interface NightStepInfo {
  /** Step index (0-based) */
  index: number;
  /** Role for this step */
  roleId: RoleId;
  /** Schema ID for action */
  schemaId: string;
  /** Audio key for this step */
  audioKey?: string;
}

// =============================================================================
// NightEngine (完整状态机实现)
// =============================================================================

export class NightEngine {
  // State machine internals
  private _phase: NightPhase = NightPhase.Idle;
  private _nightPlan: NightPlan | null = null;
  private _currentActionIndex: number = 0;
  private _actions: Map<RoleId, number> = new Map();

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Initialize night from game state
   * Builds night plan from template roles
   */
  start(state: LocalGameState): NightStepInfo | null {
    const roles = state.template.roles;
    const plan = buildNightPlan(roles);
    return this.startWithPlan(plan);
  }

  /**
   * Start night with a pre-built plan (for testing)
   */
  startWithPlan(plan: NightPlan): NightStepInfo | null {
    this._nightPlan = plan;
    this._currentActionIndex = 0;
    this._actions = new Map();
    this._phase = NightPhase.NightBeginAudio;
    nightFlowLog.info('Night started', { steps: plan.steps.length });
    return this.getCurrentStepInfo();
  }

  /**
   * Reset to idle state
   */
  reset(): void {
    nightFlowLog.debug('Reset', { fromPhase: this._phase });
    this._phase = NightPhase.Idle;
    this._currentActionIndex = 0;
    this._actions = new Map();
    this._nightPlan = null;
  }

  // ---------------------------------------------------------------------------
  // State Accessors
  // ---------------------------------------------------------------------------

  /** Get current phase */
  getPhase(): NightPhase {
    return this._phase;
  }

  /** Check if night is active */
  isActive(): boolean {
    return this._phase !== NightPhase.Idle && this._phase !== NightPhase.Ended;
  }

  /** Check if night has ended */
  isEnded(): boolean {
    return this._phase === NightPhase.Ended;
  }

  /** Get current role */
  getCurrentRole(): RoleId | null {
    const step = this.getCurrentStep();
    return step ? step.roleId : null;
  }

  /** Get current step from plan */
  private getCurrentStep(): NightPlanStep | null {
    if (!this._nightPlan) return null;
    if (this._currentActionIndex >= this._nightPlan.steps.length) {
      return null;
    }
    return this._nightPlan.steps[this._currentActionIndex];
  }

  /** Get current step info for UI/audio */
  getCurrentStepInfo(): NightStepInfo | null {
    const step = this.getCurrentStep();
    if (!step) return null;

    return {
      index: this._currentActionIndex,
      roleId: step.roleId,
      schemaId: step.stepId,
      audioKey: step.audioKey,
    };
  }

  /** Get full state snapshot */
  getState(): NightFlowState | null {
    if (!this._nightPlan) return null;
    return {
      phase: this._phase,
      currentActionIndex: this._currentActionIndex,
      actions: new Map(this._actions),
      currentStep: this.getCurrentStep(),
    };
  }

  /** Check if there are more roles */
  hasMoreRoles(): boolean {
    if (!this._nightPlan) return false;
    return this._currentActionIndex < this._nightPlan.steps.length;
  }

  /** Get total step count */
  getTotalSteps(): number {
    return this._nightPlan?.steps.length ?? 0;
  }

  // ---------------------------------------------------------------------------
  // Event Dispatch
  // ---------------------------------------------------------------------------

  /**
   * Signal that night begin audio is done
   */
  onNightBeginAudioDone(): NightStepInfo | null {
    if (this._phase !== NightPhase.NightBeginAudio) {
      throw new InvalidNightTransitionError(this._phase, NightEvent.NightBeginAudioDone);
    }
    this.transitionToNextRole();
    return this.getCurrentStepInfo();
  }

  /**
   * Signal that role begin audio is done
   */
  onRoleBeginAudioDone(): void {
    if (this._phase !== NightPhase.RoleBeginAudio) {
      throw new InvalidNightTransitionError(this._phase, NightEvent.RoleBeginAudioDone);
    }
    this._phase = NightPhase.WaitingForAction;
    nightFlowLog.debug('Waiting for action', {
      role: this.getCurrentRole(),
      index: this._currentActionIndex,
    });
  }

  /**
   * Submit an action for current role
   * Returns next step info (or null if night ended)
   */
  submitAction(target: number): NightStepInfo | null {
    if (this._phase !== NightPhase.WaitingForAction) {
      throw new InvalidNightTransitionError(this._phase, NightEvent.ActionSubmitted);
    }

    const currentRole = this.getCurrentRole();
    if (currentRole) {
      this._actions.set(currentRole, target);
      nightFlowLog.info('Action recorded', { role: currentRole, target });
    }
    this._phase = NightPhase.RoleEndAudio;

    return this.getCurrentStepInfo();
  }

  /**
   * Signal that role end audio is done
   * Returns next step info (or null if night ended)
   */
  onRoleEndAudioDone(): NightStepInfo | null {
    if (this._phase !== NightPhase.RoleEndAudio) {
      throw new InvalidNightTransitionError(this._phase, NightEvent.RoleEndAudioDone);
    }
    // Advance to next role
    this._currentActionIndex++;
    this.transitionToNextRole();
    return this.getCurrentStepInfo();
  }

  /**
   * Signal that night end audio is done
   */
  onNightEndAudioDone(): void {
    if (this._phase !== NightPhase.NightEndAudio) {
      throw new InvalidNightTransitionError(this._phase, NightEvent.NightEndAudioDone);
    }
    this._phase = NightPhase.Ended;
    nightFlowLog.info('Night ended', { actionsCount: this._actions.size });
  }

  // ---------------------------------------------------------------------------
  // Query: Recorded Actions
  // ---------------------------------------------------------------------------

  /** Get all recorded actions */
  getRecordedActions(): ReadonlyMap<RoleId, number> {
    return this._actions;
  }

  /** Get action for a specific role */
  getActionForRole(role: RoleId): number | undefined {
    return this._actions.get(role);
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  /**
   * Transition to the next role or end night if no more roles
   */
  private transitionToNextRole(): void {
    if (this.hasMoreRoles()) {
      this._phase = NightPhase.RoleBeginAudio;
      nightFlowLog.debug('Next role', {
        role: this.getCurrentRole(),
        index: this._currentActionIndex,
      });
    } else {
      this._phase = NightPhase.NightEndAudio;
      nightFlowLog.debug('All roles done, playing night end audio');
    }
  }
}
