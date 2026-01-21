/**
 * NightFlowService - Manages night flow control and audio playback
 *
 * Single Responsibility: Night phase flow orchestration
 * - Manages NightFlowController state machine
 * - Handles audio playback sequencing
 * - Step advancement logic
 *
 * This is a Host-only service; it should only be instantiated when isHost === true.
 *
 * @module services/night/NightFlowService
 */

import { type RoleId } from '../../../models/roles';
import {
  buildNightPlan,
  getStepsByRoleStrict,
  isValidRoleId,
  getRoleSpec,
  type SchemaId,
} from '../../../models/roles/spec';
import type { LocalGameState } from '../types/GameStateTypes';
import { GameStatus } from '../types/GameStateTypes';
import {
  NightFlowController,
  NightPhase,
  NightEvent,
  InvalidNightTransitionError,
} from '../NightFlowController';
import AudioService from '../AudioService';
import { nightFlowLog } from '../../../utils/logger';

// Use nightFlowLog directly - react-native-logs doesn't allow re-extending
const serviceLog = nightFlowLog;

// =============================================================================
// Types
// =============================================================================

/**
 * Dependencies for NightFlowService
 */
export interface NightFlowServiceDeps {
  /** Get current game state */
  getState: () => LocalGameState | null;
  /** Update game state (partial updates) */
  updateState: (updates: Partial<LocalGameState>) => void;
  /** Get seats for a specific role */
  getSeatsForRole: (role: RoleId) => number[];

  // ===========================================================================
  // Callbacks - NightFlowService notifies the caller (GameStateService) of events
  // This keeps NightFlowService focused on flow control, not broadcasting
  // ===========================================================================

  /**
   * Called when a role's turn starts
   * The caller should broadcast ROLE_TURN and set role-specific context
   * @param role - The role whose turn is starting
   * @param pendingSeats - Seats that need to act
   * @param stepId - The schema step ID for UI
   */
  onRoleTurnStart?: (role: RoleId, pendingSeats: number[], stepId?: SchemaId) => Promise<void>;

  /**
   * Called when night ends
   * The caller should calculate deaths and broadcast NIGHT_END
   */
  onNightEnd?: () => Promise<void>;
}

/**
 * Result of starting the night phase
 */
export interface StartNightResult {
  success: boolean;
  error?: string;
}

/**
 * Info about the current step (for UI rendering)
 */
export interface CurrentStepInfo {
  role: RoleId | null;
  stepId: SchemaId | undefined;
  pendingSeats: number[];
  actionIndex: number;
}

/**
 * Info about night end
 */
export interface NightEndInfo {
  deaths: number[];
}

// =============================================================================
// NightFlowService
// =============================================================================

/**
 * NightFlowService manages the night phase flow and audio sequencing.
 *
 * Key responsibilities:
 * - Initialize and manage NightFlowController state machine
 * - Orchestrate audio playback (night begin, role begin/end, night end)
 * - Provide step advancement logic
 * - Report current step info for UI/broadcast
 *
 * Usage:
 * ```typescript
 * const nightFlowService = new NightFlowService({
 *   getState: () => this.state,
 *   updateState: (updates) => this.stateManager.batchUpdate(updates),
 *   getSeatsForRole: (role) => this.getSeatsForRole(role),
 * });
 *
 * // Start night
 * await nightFlowService.startNight();
 *
 * // After action submitted, advance to next step
 * await nightFlowService.advanceToNextAction();
 * ```
 */
export class NightFlowService {
  private nightFlow: NightFlowController | null = null;
  private readonly audioService: AudioService;

  constructor(private readonly deps: NightFlowServiceDeps) {
    this.audioService = AudioService.getInstance();
  }

  // ===========================================================================
  // Public API: Accessors
  // ===========================================================================

  /**
   * Get the current NightFlowController (for advanced usage)
   */
  getNightFlow(): NightFlowController | null {
    return this.nightFlow;
  }

  /**
   * Check if night flow is active (nightFlow exists and not in terminal state)
   */
  isActive(): boolean {
    return this.nightFlow !== null && !this.nightFlow.isTerminal();
  }

  /**
   * Get current phase of the night flow
   */
  getCurrentPhase(): NightPhase | null {
    return this.nightFlow?.phase ?? null;
  }

  /**
   * Get current action role
   */
  getCurrentActionRole(): RoleId | null {
    const state = this.deps.getState();
    if (!state) return null;

    const { currentActionerIndex } = state;
    const nightPlan = buildNightPlan(state.template.roles);

    if (currentActionerIndex >= nightPlan.steps.length) return null;
    return nightPlan.steps[currentActionerIndex].roleId;
  }

  /**
   * Get current step info (for UI/broadcast)
   */
  getCurrentStepInfo(): CurrentStepInfo | null {
    const state = this.deps.getState();
    if (!state) return null;

    const currentRole = this.getCurrentActionRole();
    if (!currentRole) return null;

    // Get stepId from NIGHT_STEPS
    let stepId: SchemaId | undefined;
    if (isValidRoleId(currentRole)) {
      const spec = getRoleSpec(currentRole);
      if (spec.night1.hasAction) {
        const [step] = getStepsByRoleStrict(currentRole);
        stepId = step?.id;
      }
    }

    const pendingSeats = this.deps.getSeatsForRole(currentRole);

    return {
      role: currentRole,
      stepId,
      pendingSeats,
      actionIndex: state.currentActionerIndex,
    };
  }

  // ===========================================================================
  // Public API: Night Flow Control
  // ===========================================================================

  /**
   * Start the night phase
   *
   * Prerequisites:
   * - State must exist
   * - State status must be 'ready'
   *
   * This method:
   * 1. Builds night plan from template roles
   * 2. Initializes NightFlowController
   * 3. Resets night-specific state
   * 4. Plays night begin audio
   * 5. Starts first role's turn
   *
   * @param roles - The roles in the game (from template)
   * @returns StartNightResult with success flag
   */
  async startNight(roles: RoleId[]): Promise<StartNightResult> {
    const state = this.deps.getState();
    if (!state) {
      return { success: false, error: 'No state' };
    }

    if (state.status !== GameStatus.ready) {
      return { success: false, error: `Invalid status: ${state.status}` };
    }

    // Build night plan from template roles
    const nightPlan = buildNightPlan(roles);
    serviceLog.info('Built night plan with steps:', nightPlan.steps.length);

    // Initialize NightFlowController
    this.nightFlow = new NightFlowController(nightPlan);

    // Dispatch StartNight event (STRICT: fail-fast on error)
    try {
      this.nightFlow.dispatch(NightEvent.StartNight);
    } catch (err) {
      if (err instanceof InvalidNightTransitionError) {
        serviceLog.error('NightFlow StartNight failed:', err.message);
        return { success: false, error: `StartNight failed: ${err.message}` };
      }
      throw err;
    }

    // Reset night state
    this.deps.updateState({
      actions: new Map(),
      wolfVotes: new Map(),
      currentActionerIndex: 0,
      isAudioPlaying: true,
      // Reset nightmare block flags
      wolfKillDisabled: undefined,
      nightmareBlockedSeat: undefined,
      // Reset accumulated night results
      currentNightResults: {},
      // Reset role-specific context
      witchContext: undefined,
      seerReveal: undefined,
      psychicReveal: undefined,
      gargoyleReveal: undefined,
      wolfRobotReveal: undefined,
      confirmStatus: undefined,
      actionRejected: undefined,
    });

    // Play night begin audio
    serviceLog.info('Playing night begin audio...');
    await this.audioService.playNightBeginAudio();

    // Wait 5 seconds
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Dispatch NightBeginAudioDone (STRICT)
    try {
      this.nightFlow.dispatch(NightEvent.NightBeginAudioDone);
      // Sync currentActionerIndex from nightFlow
      this.deps.updateState({
        currentActionerIndex: this.nightFlow.currentActionIndex,
      });
    } catch (err) {
      if (err instanceof InvalidNightTransitionError) {
        serviceLog.error('NightFlow NightBeginAudioDone failed:', err.message);
        return { success: false, error: `NightBeginAudioDone failed: ${err.message}` };
      }
      throw err;
    }

    // Set status to ongoing
    this.deps.updateState({
      status: GameStatus.ongoing,
    });

    // Start first role's turn (uses onRoleTurnStart callback for ROLE_TURN broadcast)
    await this.playCurrentRoleAudio();

    return { success: true };
  }

  /**
   * Advance to the next action step
   *
   * This method:
   * 1. Plays role ending audio
   * 2. Dispatches RoleEndAudioDone event
   * 3. Clears wolf votes
   * 4. Plays next role's audio (or ends night)
   */
  async advanceToNextAction(): Promise<void> {
    const state = this.deps.getState();
    if (!state) return;

    // STRICT INVARIANT: nightFlow must exist when status === ongoing
    if (state.status === GameStatus.ongoing && !this.nightFlow) {
      serviceLog.error(
        'STRICT INVARIANT VIOLATION: advanceToNextAction() called but nightFlow is null.',
        'status:',
        state.status,
      );
      throw new Error('advanceToNextAction: nightFlow is null - strict invariant violation');
    }

    if (!this.nightFlow) {
      return;
    }

    const currentRole = this.getCurrentActionRole();

    // Play role ending audio if available
    if (currentRole) {
      this.deps.updateState({ isAudioPlaying: true });

      // Ending audio is optional, ignore errors
      await this.audioService.playRoleEndingAudio(currentRole).catch(() => {});

      this.deps.updateState({ isAudioPlaying: false });
    }

    // Dispatch RoleEndAudioDone to advance state machine
    // STRICT: Only dispatch if nightFlow is in RoleEndAudio phase
    if (this.nightFlow.phase === NightPhase.RoleEndAudio) {
      this.nightFlow.dispatch(NightEvent.RoleEndAudioDone);
      // Sync currentActionerIndex from nightFlow
      this.deps.updateState({
        currentActionerIndex: this.nightFlow.currentActionIndex,
      });
    } else {
      // Phase mismatch - duplicate/stale callback, ignore silently (idempotent)
      serviceLog.debug(
        'RoleEndAudioDone ignored (idempotent): phase is',
        this.nightFlow.phase,
        '- not RoleEndAudio',
      );
      return;
    }

    // Clear wolf votes for next role
    this.deps.updateState({ wolfVotes: new Map() });

    // Play next role's audio
    await this.playCurrentRoleAudio();
  }

  /**
   * End the night phase
   *
   * This method:
   * 1. Plays night end audio
   * 2. Dispatches NightEndAudioDone event
   * 3. Returns deaths for caller to process
   *
   * Note: Death calculation is NOT done here - it's the caller's responsibility
   * to call their own death calculation logic
   *
   * @returns Whether night end was successfully processed
   */
  async endNight(): Promise<boolean> {
    const state = this.deps.getState();
    if (!state) return false;

    // STRICT INVARIANT: nightFlow must exist when status === ongoing
    if (state.status === GameStatus.ongoing && !this.nightFlow) {
      serviceLog.error(
        'STRICT INVARIANT VIOLATION: endNight() called but nightFlow is null.',
        'status:',
        state.status,
      );
      throw new Error('endNight: nightFlow is null - strict invariant violation');
    }

    if (!this.nightFlow) {
      return false;
    }

    // Play night end audio
    serviceLog.info('Playing night end audio...');
    await this.audioService.playNightEndAudio();

    // Dispatch NightEndAudioDone
    // STRICT: Only dispatch if nightFlow is in NightEndAudio phase
    if (this.nightFlow.phase === NightPhase.NightEndAudio) {
      this.nightFlow.dispatch(NightEvent.NightEndAudioDone);
      return true;
    } else {
      // Phase mismatch - duplicate/stale callback
      serviceLog.debug(
        'endNight() ignored (strict no-op): phase is',
        this.nightFlow.phase,
        '- not NightEndAudio. No death calc, no status change.',
      );
      return false;
    }
  }

  /**
   * Reset/restart the night flow
   *
   * Used when restarting the game
   */
  reset(): void {
    if (this.nightFlow) {
      try {
        this.nightFlow.dispatch(NightEvent.Reset);
      } catch (err) {
        serviceLog.warn('NightFlow Reset failed:', err);
      }
      this.nightFlow = null;
    }
  }

  // ===========================================================================
  // Public API: State Machine Events
  // ===========================================================================

  /**
   * Dispatch an event to the night flow state machine
   *
   * Use this for events that need to be dispatched directly:
   * - ActionSubmitted (after player submits action)
   * - RoleBeginAudioDone (after role audio finishes playing)
   *
   * @param event - The night event to dispatch
   * @throws InvalidNightTransitionError if transition is invalid
   */
  dispatchEvent(event: NightEvent): void {
    if (!this.nightFlow) {
      serviceLog.warn('dispatchEvent: nightFlow is null, ignoring event:', event);
      return;
    }
    this.nightFlow.dispatch(event);

    // Sync currentActionerIndex after state change
    this.deps.updateState({
      currentActionerIndex: this.nightFlow.currentActionIndex,
    });
  }

  /**
   * Record an action for the current role
   *
   * @param role - The role making the action
   * @param target - The target seat number
   */
  recordAction(role: RoleId, target: number): void {
    if (!this.nightFlow) {
      serviceLog.warn('recordAction: nightFlow is null');
      return;
    }
    this.nightFlow.recordAction(role, target);
  }

  /**
   * Check if nightFlow is in WaitingForAction phase and role matches
   *
   * @param role - The role to check
   * @returns true if action can be accepted for this role
   */
  canAcceptAction(role: RoleId): boolean {
    if (!this.nightFlow) return false;
    return (
      this.nightFlow.phase === NightPhase.WaitingForAction && this.nightFlow.currentRole === role
    );
  }

  // ===========================================================================
  // Private: Audio Playback
  // ===========================================================================

  /**
   * Play current role's beginning audio and notify callback
   *
   * This method:
   * 1. Gets current action role
   * 2. If no role, ends night (via callback)
   * 3. Plays role beginning audio
   * 4. Dispatches RoleBeginAudioDone event
   * 5. Notifies onRoleTurnStart callback (for broadcasting ROLE_TURN)
   * 6. Updates state
   */
  async playCurrentRoleAudio(): Promise<void> {
    const state = this.deps.getState();
    if (!state) return;

    const currentRole = this.getCurrentActionRole();

    if (!currentRole) {
      // Night has ended - notify via callback
      if (this.deps.onNightEnd) {
        await this.deps.onNightEnd();
      } else {
        // Fallback: call internal endNight (for backwards compatibility in tests)
        await this.endNight();
      }
      return;
    }

    this.deps.updateState({ isAudioPlaying: true });

    // Play role audio
    serviceLog.info('Playing audio for role:', currentRole);
    await this.audioService.playRoleBeginningAudio(currentRole);

    // Audio finished - dispatch RoleBeginAudioDone (STRICT)
    try {
      this.nightFlow?.dispatch(NightEvent.RoleBeginAudioDone);
    } catch (err) {
      if (err instanceof InvalidNightTransitionError) {
        serviceLog.error('NightFlow RoleBeginAudioDone failed:', err.message);
        throw new Error(`RoleBeginAudioDone failed: ${err.message}`);
      }
      throw err;
    }

    this.deps.updateState({ isAudioPlaying: false });

    // Get pending seats and stepId for callback
    const pendingSeats = this.deps.getSeatsForRole(currentRole);
    let stepId: SchemaId | undefined;
    if (isValidRoleId(currentRole)) {
      const spec = getRoleSpec(currentRole);
      if (spec.night1.hasAction) {
        const [step] = getStepsByRoleStrict(currentRole);
        stepId = step?.id;
      }
    }

    // Notify callback (GameStateService handles ROLE_TURN broadcast and context setup)
    if (this.deps.onRoleTurnStart) {
      await this.deps.onRoleTurnStart(currentRole, pendingSeats, stepId);
    }

    // Update currentStepId for UI (also done via callback, but keep for internal consistency)
    if (stepId) {
      this.deps.updateState({ currentStepId: stepId });
    }
  }
}

export default NightFlowService;
