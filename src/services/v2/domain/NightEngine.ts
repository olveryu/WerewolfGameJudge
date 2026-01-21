/**
 * NightEngine - 夜晚流程控制引擎
 *
 * 职责：
 * - 夜晚状态机管理
 * - 步骤序列控制
 * - 行动记录
 *
 * 不做的事：
 * - 音频播放 (Audio 职责)
 * - 状态广播 (HostEngine 职责)
 * - 行动解析 (Resolver 职责)
 *
 * Note: This wraps legacy NightFlowController which is already a clean
 * state machine implementation. The wrapper provides a simplified API
 * and better integration with v2 architecture.
 */

import NightFlowController, {
  NightPhase,
  NightEvent,
  type NightFlowState,
} from '../../legacy/NightFlowController';
import { buildNightPlan } from '../../../models/roles';
import type { RoleId } from '../../../models/roles';
import type { NightPlan } from '../../../models/roles/spec/plan.types';
import type { LocalGameState } from '../infra/StateStore';

// =============================================================================
// Re-export types
// =============================================================================

export { NightPhase, NightEvent } from '../../legacy/NightFlowController';
export type { NightFlowState } from '../../legacy/NightFlowController';
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
// NightEngine
// =============================================================================

export class NightEngine {
  private controller: NightFlowController | null = null;
  private currentPlan: NightPlan | null = null;

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
    this.currentPlan = plan;
    this.controller = new NightFlowController(plan);

    // Start night
    this.controller.dispatch(NightEvent.StartNight);

    return this.getCurrentStepInfo();
  }

  /**
   * Start night with a pre-built plan (for testing)
   */
  startWithPlan(plan: NightPlan): NightStepInfo | null {
    this.currentPlan = plan;
    this.controller = new NightFlowController(plan);
    this.controller.dispatch(NightEvent.StartNight);
    return this.getCurrentStepInfo();
  }

  /**
   * Reset to idle state
   */
  reset(): void {
    if (this.controller) {
      this.controller.dispatch(NightEvent.Reset);
    }
    this.controller = null;
    this.currentPlan = null;
  }

  // ---------------------------------------------------------------------------
  // State Accessors
  // ---------------------------------------------------------------------------

  /** Get current phase */
  getPhase(): NightPhase {
    return this.controller?.phase ?? NightPhase.Idle;
  }

  /** Check if night is active */
  isActive(): boolean {
    const phase = this.getPhase();
    return phase !== NightPhase.Idle && phase !== NightPhase.Ended;
  }

  /** Check if night has ended */
  isEnded(): boolean {
    return this.getPhase() === NightPhase.Ended;
  }

  /** Get current role */
  getCurrentRole(): RoleId | null {
    return this.controller?.currentRole ?? null;
  }

  /** Get current step info */
  getCurrentStepInfo(): NightStepInfo | null {
    if (!this.controller) return null;
    const step = this.controller.currentStep;
    if (!step) return null;

    return {
      index: this.controller.currentActionIndex,
      roleId: step.roleId,
      schemaId: step.stepId,
      audioKey: step.audioKey,
    };
  }

  /** Get full state snapshot */
  getState(): NightFlowState | null {
    return this.controller?.getState() ?? null;
  }

  /** Check if there are more roles */
  hasMoreRoles(): boolean {
    return this.controller?.hasMoreRoles() ?? false;
  }

  /** Get total step count */
  getTotalSteps(): number {
    return this.currentPlan?.steps.length ?? 0;
  }

  // ---------------------------------------------------------------------------
  // Event Dispatch
  // ---------------------------------------------------------------------------

  /**
   * Signal that night begin audio is done
   */
  onNightBeginAudioDone(): NightStepInfo | null {
    if (!this.controller) return null;
    this.controller.dispatch(NightEvent.NightBeginAudioDone);
    return this.getCurrentStepInfo();
  }

  /**
   * Signal that role begin audio is done
   */
  onRoleBeginAudioDone(): void {
    this.controller?.dispatch(NightEvent.RoleBeginAudioDone);
  }

  /**
   * Submit an action for current role
   * Returns next step info (or null if night ended)
   */
  submitAction(target: number): NightStepInfo | null {
    if (!this.controller) return null;

    const currentRole = this.controller.currentRole;
    if (currentRole) {
      this.controller.recordAction(currentRole, target);
    }
    this.controller.dispatch(NightEvent.ActionSubmitted);

    return this.getCurrentStepInfo();
  }

  /**
   * Signal that role end audio is done
   * Returns next step info (or null if night ended)
   */
  onRoleEndAudioDone(): NightStepInfo | null {
    if (!this.controller) return null;
    this.controller.dispatch(NightEvent.RoleEndAudioDone);
    return this.getCurrentStepInfo();
  }

  /**
   * Signal that night end audio is done
   */
  onNightEndAudioDone(): void {
    this.controller?.dispatch(NightEvent.NightEndAudioDone);
  }

  // ---------------------------------------------------------------------------
  // Query: Recorded Actions
  // ---------------------------------------------------------------------------

  /** Get all recorded actions */
  getRecordedActions(): ReadonlyMap<RoleId, number> {
    return this.controller?.actions ?? new Map();
  }

  /** Get action for a specific role */
  getActionForRole(role: RoleId): number | undefined {
    return this.controller?.actions.get(role);
  }
}

export default NightEngine;
