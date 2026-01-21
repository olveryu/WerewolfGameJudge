/**
 * HostCoordinator - Coordinates Host-only game logic
 *
 * This module handles all Host-specific operations including:
 * - Room initialization and recovery
 * - Processing player messages (actions, votes, ACKs)
 * - Game flow control (start, restart, template updates)
 * - Night phase progression
 *
 * Extracted from GameStateService as part of the V2 refactoring.
 */

import { RoleId, isWolfRole } from '../../../models/roles';
import { GameTemplate, validateTemplateRoles } from '../../../models/Template';
import { getConfirmRoleCanShoot } from '../../../models/Room';
import { makeActionTarget, getActionTargetSeat } from '../../../models/actions';
import { type SchemaId, BLOCKED_UI_DEFAULTS } from '../../../models/roles/spec';
import { shuffleArray } from '../../../utils/shuffle';
import { hostLog } from '../../../utils/logger';
import { calculateDeaths, type RoleSeatMap } from '../DeathCalculator';
import { NightPhase, NightEvent, InvalidNightTransitionError } from '../NightFlowController';
import type { PlayerMessage } from '../BroadcastService';

import { StateManager } from '../state';
import { StatePersistence } from '../persistence';
import { BroadcastCoordinator } from '../broadcast';
import { SeatManager } from '../seat';
import { ActionProcessor, type ActionContext } from '../action';
import { NightFlowService } from '../night';
import AudioService from '../AudioService';

import { GameStatus, LocalGameState, LocalPlayer } from '../types/GameStateTypes';

// =============================================================================
// Types
// =============================================================================

export interface HostCoordinatorConfig {
  stateManager: StateManager;
  statePersistence: StatePersistence;
  broadcastCoordinator: BroadcastCoordinator;
  seatManager: SeatManager;
  actionProcessor: ActionProcessor;
  nightFlowService: NightFlowService;
  audioService: AudioService;

  // Callbacks
  getState: () => LocalGameState | null;
  getStateRevision: () => number;
  setStateRevision: (rev: number) => void;
  incrementStateRevision: () => number;
  setIsHost: (isHost: boolean) => void;
  setMyUid: (uid: string | null) => void;
  setMySeatNumber: (seat: number | null) => void;
  getMySeatNumber: () => number | null;
  notifyListeners: () => void;
}

// =============================================================================
// HostCoordinator Implementation
// =============================================================================

export class HostCoordinator {
  private readonly config: HostCoordinatorConfig;

  // Shorthand accessors
  private get stateManager(): StateManager {
    return this.config.stateManager;
  }
  private get statePersistence(): StatePersistence {
    return this.config.statePersistence;
  }
  private get broadcastCoordinator(): BroadcastCoordinator {
    return this.config.broadcastCoordinator;
  }
  private get seatManager(): SeatManager {
    return this.config.seatManager;
  }
  private get actionProcessor(): ActionProcessor {
    return this.config.actionProcessor;
  }
  private get nightFlowService(): NightFlowService {
    return this.config.nightFlowService;
  }
  private get audioService(): AudioService {
    return this.config.audioService;
  }

  private get state(): LocalGameState | null {
    return this.config.getState();
  }

  private get stateRevision(): number {
    return this.config.getStateRevision();
  }

  /**
   * Host-only: gate advancing after a reveal action until the revealer confirms.
   * Key format: `${revision}_${role}`
   */
  private readonly pendingRevealAcks: Set<string> = new Set();

  constructor(config: HostCoordinatorConfig) {
    this.config = config;
  }

  // ===========================================================================
  // Room Initialization
  // ===========================================================================

  /**
   * Initialize a new game as Host
   */
  async initialize(
    roomCode: string,
    hostUid: string,
    template: GameTemplate,
  ): Promise<void> {
    // If already in a room, leave it first (clean up old state)
    if (this.state) {
      const oldRoomCode = this.state.roomCode;
      hostLog.info('Leaving old room before creating new one:', oldRoomCode);
      await this.broadcastCoordinator.leaveRoom();
    }

    this.config.setIsHost(true);
    this.config.setMyUid(hostUid);
    this.config.setMySeatNumber(null);

    // Create initial state
    const players = new Map<number, LocalPlayer | null>();
    for (let i = 0; i < template.numberOfPlayers; i++) {
      players.set(i, null);
    }

    // Initialize state via StateManager
    this.stateManager.initialize({
      roomCode,
      hostUid,
      status: GameStatus.unseated,
      template,
      players,
      actions: new Map(),
      wolfVotes: new Map(),
      currentActionerIndex: 0,
      currentStepId: undefined,
      isAudioPlaying: false,
      lastNightDeaths: [],
      currentNightResults: {},
    });

    // Join broadcast channel
    await this.broadcastCoordinator.joinRoom(roomCode, hostUid, {
      onHostBroadcast: (_msg) => {
        // Host ignores its own broadcasts (handled via local state)
      },
      onPlayerMessage: this.createAsyncHandler((msg, senderId) =>
        this.handlePlayerMessage(msg, senderId),
      ),
      onPresenceChange: this.createAsyncHandler(async (users) => {
        hostLog.info('Users in room:', users.length);
        if (this.state) {
          await this.broadcastState();
        }
      }),
    });

    // Broadcast initial state
    await this.broadcastState();
    this.config.notifyListeners();

    hostLog.info('Initialized as Host for room:', roomCode);
  }

  /**
   * Rejoin an existing room as Host (recovery scenario)
   */
  async rejoin(roomCode: string, hostUid: string): Promise<void> {
    this.config.setIsHost(true);
    this.config.setMyUid(hostUid);
    this.config.setMySeatNumber(null);

    // Try to recover state from storage
    const savedState = await this.statePersistence.loadState(roomCode);

    if (savedState) {
      this.stateManager.initialize(savedState);

      // Restore mySeatNumber if host was seated
      for (const [seatNum, player] of savedState.players.entries()) {
        if (player?.uid === hostUid) {
          this.config.setMySeatNumber(seatNum);
          break;
        }
      }

      hostLog.info('Host state recovered from storage for room:', roomCode);
    } else {
      // No saved state - create placeholder
      this.stateManager.initialize({
        roomCode,
        hostUid,
        status: GameStatus.unseated,
        template: {
          name: '恢复中...',
          numberOfPlayers: 0,
          roles: [],
        },
        players: new Map(),
        actions: new Map(),
        wolfVotes: new Map(),
        currentActionerIndex: 0,
        currentStepId: undefined,
        isAudioPlaying: false,
        lastNightDeaths: [],
        currentNightResults: {},
      });

      hostLog.warn('No saved state found, created placeholder for room:', roomCode);
    }

    // Join broadcast channel as Host
    await this.broadcastCoordinator.joinRoom(roomCode, hostUid, {
      onHostBroadcast: () => {},
      onPlayerMessage: this.createAsyncHandler((msg, senderId) =>
        this.handlePlayerMessage(msg, senderId),
      ),
      onPresenceChange: this.createAsyncHandler(async (users) => {
        hostLog.info('Users in room (rejoin):', users.length);
        if (this.state) {
          await this.broadcastState();
        }
      }),
    });

    await this.broadcastState();
    this.config.notifyListeners();

    if (savedState) {
      hostLog.info('Rejoined as Host with recovered state:', roomCode);
    } else {
      hostLog.warn('Rejoined as Host (state lost, game needs restart):', roomCode);
    }
  }

  // ===========================================================================
  // Player Message Handling
  // ===========================================================================

  /**
   * Route incoming player messages to appropriate handlers
   */
  async handlePlayerMessage(msg: PlayerMessage, senderId: string): Promise<void> {
    if (!this.state) return;

    hostLog.debug('Host received player message:', msg.type, 'from:', senderId.substring(0, 8));

    switch (msg.type) {
      case 'REQUEST_STATE':
        hostLog.info('Broadcasting state for new player:', msg.uid);
        await this.broadcastState();
        break;

      case 'JOIN':
        await this.seatManager.handlePlayerJoin(
          msg.seat,
          msg.uid,
          msg.displayName,
          msg.avatarUrl,
        );
        break;

      case 'LEAVE':
        await this.seatManager.handlePlayerLeave(msg.seat, msg.uid);
        break;

      case 'ACTION':
        await this.handlePlayerAction(msg.seat, msg.role, msg.target, msg.extra);
        break;

      case 'REVEAL_ACK':
        await this.handleRevealAck(msg.seat, msg.role, msg.revision);
        break;

      case 'WOLF_VOTE':
        await this.handleWolfVote(msg.seat, msg.target);
        break;

      case 'VIEWED_ROLE':
        await this.handlePlayerViewedRole(msg.seat);
        break;

      case 'SEAT_ACTION_REQUEST':
        await this.seatManager.handleSeatActionRequest(msg);
        break;

      case 'SNAPSHOT_REQUEST':
        await this.handleSnapshotRequest(msg);
        break;

      default:
        hostLog.warn('Unknown player message type:', (msg as any).type);
        break;
    }
  }

  // ===========================================================================
  // Action Handling
  // ===========================================================================

  /**
   * Handle player action submission
   */
  async handlePlayerAction(
    seat: number,
    role: RoleId,
    target: number | null,
    extra?: unknown,
  ): Promise<void> {
    if (!this.state || this.state.status !== GameStatus.ongoing) return;

    // STRICT INVARIANT: nightFlow must exist when status === ongoing
    if (!this.nightFlowService.isActive()) {
      hostLog.error(
        '[HostCoordinator] STRICT INVARIANT VIOLATION: handlePlayerAction() called but nightFlow is null.',
        'seat:', seat, 'role:', role,
      );
      throw new Error('handlePlayerAction: nightFlow is null - strict invariant violation');
    }

    // Verify this is the correct role's turn
    const currentRole = this.nightFlowService.getCurrentActionRole();
    if (currentRole !== role) {
      hostLog.info('Wrong role acting:', role, 'expected:', currentRole);
      return;
    }

    // NightFlow guard: only allow action in WaitingForAction phase
    if (!this.nightFlowService.canAcceptAction(role)) {
      const phase = this.nightFlowService.getCurrentPhase();
      const currentNightRole = this.nightFlowService.getNightFlow()?.currentRole;
      if (phase === NightPhase.WaitingForAction) {
        hostLog.info('NightFlow role mismatch:', role, 'expected:', currentNightRole);
      } else {
        hostLog.info('NightFlow not in WaitingForAction phase, ignoring action');
      }
      return;
    }

    // Check nightmare block
    const blockResult = await this.checkNightmareBlock(seat, role, target, extra);
    if (blockResult === 'blocked') return;

    // Process action via ActionProcessor
    const schemaId = this.nightFlowService.getCurrentStepInfo()?.stepId;
    if (schemaId) {
      const context = this.buildActionContext();
      const result = this.actionProcessor.processAction(
        schemaId,
        seat,
        role,
        target,
        extra,
        context,
      );

      if (!result.valid) {
        await this.rejectAction(seat, 'submitAction', result.rejectReason ?? '行动无效');
        hostLog.info('Action rejected by resolver:', result.rejectReason);
        return;
      }

      // Apply valid result
      this.applyActionResult(role, target, result);
    }

    // Reveal roles require ACK before advancing
    if (this.actionProcessor.isRevealRole(role) && target !== null) {
      await this.broadcastState();
      this.pendingRevealAcks.add(this.makeRevealAckKey(this.stateRevision, role));
      return;
    }

    // Non-reveal roles proceed immediately
    await this.dispatchActionSubmittedAndAdvance();
  }

  /**
   * Handle wolf vote submission
   */
  async handleWolfVote(seat: number, target: number): Promise<void> {
    if (!this.state || this.state.status !== GameStatus.ongoing) {
      hostLog.debug('handleWolfVote: early return - status not ongoing or no state');
      return;
    }

    if (!this.nightFlowService.isActive()) {
      hostLog.error(
        '[HostCoordinator] STRICT INVARIANT VIOLATION: handleWolfVote() called but nightFlow is null.',
        'seat:', seat,
      );
      throw new Error('handleWolfVote: nightFlow is null - strict invariant violation');
    }

    const currentRole = this.nightFlowService.getCurrentActionRole();
    if (currentRole !== 'wolf') {
      hostLog.debug('handleWolfVote: rejected - currentRole is not wolf:', currentRole);
      return;
    }

    // Verify this is a wolf
    const player = this.state.players.get(seat);
    if (!player?.role || !isWolfRole(player.role)) return;

    // Validate target via ActionProcessor
    const context = this.buildActionContext();
    const validation = this.actionProcessor.validateWolfVote(target, context);

    if (!validation.valid) {
      await this.rejectAction(seat, 'submitWolfVote', validation.rejectReason ?? '无效目标');
      return;
    }

    // Record vote via StateManager
    this.stateManager.recordWolfVote(seat, target);

    // Check if all voting wolves have voted
    const allVotingWolfSeats = this.stateManager.getVotingWolfSeats();
    const allVoted = allVotingWolfSeats.every((s) => this.state!.wolfVotes.has(s));

    if (allVoted) {
      await this.finalizeWolfVote();
    } else {
      await this.broadcastState();
      this.config.notifyListeners();
    }
  }

  /**
   * Handle reveal acknowledgment
   */
  async handleRevealAck(seat: number, role: RoleId, revision: number): Promise<void> {
    if (!this.state || this.state.status !== GameStatus.ongoing) return;
    if (!this.nightFlowService.isActive()) return;

    if (!this.actionProcessor.isRevealRole(role)) return;

    const player = this.state.players.get(seat);
    if (!player) return;

    if (player.role !== role) return;
    if (revision !== this.stateRevision) return;
    if (!this.nightFlowService.canAcceptAction(role)) return;

    const key = this.makeRevealAckKey(revision, role);
    if (!this.pendingRevealAcks.has(key)) return;

    this.pendingRevealAcks.delete(key);

    try {
      this.nightFlowService.dispatchEvent(NightEvent.ActionSubmitted);
    } catch (err) {
      if (err instanceof InvalidNightTransitionError) {
        hostLog.debug('REVEAL_ACK ignored (phase mismatch):', (err as Error).message);
        return;
      }
      throw err;
    }

    await this.advanceToNextAction();
  }

  /**
   * Handle player viewed role
   */
  async handlePlayerViewedRole(seat: number): Promise<void> {
    if (!this.state || this.state.status !== GameStatus.assigned) return;

    const player = this.state.players.get(seat);
    if (!player) return;

    this.stateManager.markPlayerViewedRole(seat);

    await this.broadcastState();
  }

  /**
   * Handle snapshot request (for reconnection)
   */
  private async handleSnapshotRequest(msg: {
    requestId: string;
    uid: string;
    lastRevision?: number;
  }): Promise<void> {
    if (!this.state) return;

    hostLog.info(
      `Snapshot request from ${msg.uid.substring(0, 8)}, lastRev: ${msg.lastRevision ?? 'none'}`,
    );

    const broadcastState = this.stateManager.toBroadcastState();
    await this.broadcastCoordinator.broadcastSnapshotResponse({
      requestId: msg.requestId,
      toUid: msg.uid,
      state: broadcastState,
      revision: this.stateRevision,
    });
  }

  // ===========================================================================
  // Game Flow Control
  // ===========================================================================

  /**
   * Start the game (begin first night)
   */
  async startGame(): Promise<void> {
    if (!this.state || this.state.status !== GameStatus.ready) return;

    const result = await this.nightFlowService.startNight(this.state.template.roles);
    if (!result.success) {
      hostLog.error('NightFlowService.startNight failed:', result.error);
      throw new Error(`[NightFlow] startGame failed: ${result.error}`);
    }

    await this.broadcastState();
    this.config.notifyListeners();
  }

  /**
   * Restart game with same template
   */
  async restartGame(): Promise<boolean> {
    if (!this.state) {
      hostLog.warn('restartGame: no state');
      return false;
    }

    if (this.state.status === GameStatus.unseated) {
      hostLog.warn('restartGame: cannot restart in unseated status');
      return false;
    }

    this.nightFlowService.reset();
    this.stateManager.resetForGameRestart();

    await this.broadcastCoordinator.broadcastGameRestarted();
    await this.broadcastState();

    hostLog.info('Game restarted');
    return true;
  }

  /**
   * Assign roles to players
   */
  async assignRoles(): Promise<void> {
    if (!this.state) return;
    if (this.state.status !== GameStatus.seated) return;

    const shuffledRoles = shuffleArray([...this.state.template.roles]);
    this.stateManager.assignRolesToPlayers(shuffledRoles);

    await this.broadcastState();
    hostLog.info('Roles assigned');
  }

  /**
   * Update template (before game starts)
   */
  async updateTemplate(newTemplate: GameTemplate): Promise<void> {
    if (!this.state) return;

    if (this.state.status !== GameStatus.unseated && this.state.status !== GameStatus.seated) {
      hostLog.warn('Cannot update template after game starts');
      return;
    }

    const validationError = validateTemplateRoles(newTemplate.roles);
    if (validationError) {
      hostLog.warn('updateTemplate rejected: invalid roles -', validationError);
      return;
    }

    this.stateManager.updateTemplate(newTemplate);

    await this.broadcastState();
    hostLog.info('Template updated:', newTemplate.name);
  }

  // ===========================================================================
  // Night Phase Callbacks
  // ===========================================================================

  /**
   * Handle role turn start callback from NightFlowService
   */
  async handleRoleTurnStart(
    role: RoleId,
    pendingSeats: number[],
    stepId?: SchemaId,
  ): Promise<void> {
    if (!this.state) return;

    // For witch, set killedIndex in state
    if (role === 'witch') {
      const witchSeat = this.stateManager.findSeatByRole('witch');
      const nightmareAction = this.state.actions.get('nightmare');
      const isWitchBlocked =
        nightmareAction?.kind === 'target' && nightmareAction.targetSeat === witchSeat;

      if (isWitchBlocked) {
        hostLog.info('Witch is blocked by nightmare, not setting witchContext');
      } else {
        const wolfAction = this.state.actions.get('wolf');
        const killedIndex = getActionTargetSeat(wolfAction) ?? -1;
        const canSave = killedIndex !== -1 && killedIndex !== witchSeat;
        this.stateManager.setWitchContext({
          killedIndex,
          canSave,
          canPoison: true,
        });
      }
    }

    // For hunter/darkWolfKing, set canShoot status
    if (role === 'hunter' || role === 'darkWolfKing') {
      const canShoot = getConfirmRoleCanShoot(this.state, role);
      this.stateManager.setConfirmStatus({ role, canShoot });
    }

    // Broadcast role turn
    await this.broadcastCoordinator.broadcastRoleTurn(role, pendingSeats, { stepId });

    if (stepId) {
      this.stateManager.batchUpdate({ currentStepId: stepId });
    }

    await this.broadcastState();
  }

  /**
   * End the night phase
   */
  async endNight(): Promise<void> {
    if (!this.state) return;

    if (this.state.status === GameStatus.ongoing && !this.nightFlowService.isActive()) {
      hostLog.error(
        '[HostCoordinator] STRICT INVARIANT VIOLATION: endNight() called but nightFlow is null.',
      );
      throw new Error('endNight: nightFlow is null - strict invariant violation');
    }

    if (!this.nightFlowService.isActive()) return;

    hostLog.info('Playing night end audio...');
    await this.audioService.playNightEndAudio();

    if (this.nightFlowService.getCurrentPhase() === NightPhase.NightEndAudio) {
      this.nightFlowService.dispatchEvent(NightEvent.NightEndAudioDone);
    } else {
      hostLog.debug(
        '[HostCoordinator] endNight() ignored: phase is',
        this.nightFlowService.getCurrentPhase(),
      );
      return;
    }

    // Calculate deaths
    const deaths = this.calculateDeaths();
    this.stateManager.batchUpdate({
      lastNightDeaths: deaths,
      status: GameStatus.ended,
    });

    await this.broadcastCoordinator.broadcastNightEnd(deaths);
    await this.broadcastState();
    this.config.notifyListeners();

    hostLog.info('Night ended. Deaths:', deaths);
  }

  // ===========================================================================
  // State Broadcasting
  // ===========================================================================

  /**
   * Broadcast current state to all players
   */
  async broadcastState(): Promise<void> {
    if (!this.state) return;

    const broadcastState = this.stateManager.toBroadcastState();
    const revision = this.config.incrementStateRevision();

    await this.broadcastCoordinator.broadcastState(broadcastState, revision);

    // Save state to storage (fire and forget)
    this.statePersistence.saveState(this.state.roomCode, this.state).catch((err) => {
      hostLog.warn('Failed to save state:', err);
    });
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  private async advanceToNextAction(): Promise<void> {
    if (!this.state) return;

    if (this.state.status === GameStatus.ongoing && !this.nightFlowService.isActive()) {
      hostLog.error('[HostCoordinator] STRICT INVARIANT VIOLATION: advanceToNextAction()');
      throw new Error('advanceToNextAction: nightFlow is null');
    }

    if (!this.nightFlowService.isActive()) return;

    await this.nightFlowService.advanceToNextAction();
    this.stateManager.clearWolfVotes();
  }

  private async finalizeWolfVote(): Promise<void> {
    if (!this.state) return;

    if (this.stateManager.hasAction('wolf')) {
      hostLog.debug('[HostCoordinator] handleWolfVote finalize skipped: wolf action already recorded.');
      return;
    }

    const finalTarget = this.actionProcessor.resolveWolfVotes(this.state.wolfVotes);
    if (finalTarget !== null) {
      this.stateManager.recordAction('wolf', makeActionTarget(finalTarget));
      try {
        this.nightFlowService.recordAction('wolf', finalTarget);
      } catch (err) {
        hostLog.debug('[HostCoordinator] NightFlow recordAction (wolf) failed:', err);
      }
    }

    try {
      this.nightFlowService.dispatchEvent(NightEvent.ActionSubmitted);
    } catch (err) {
      if (err instanceof InvalidNightTransitionError) {
        hostLog.debug('[HostCoordinator] NightFlow ActionSubmitted (wolf) rejected');
      } else {
        throw err;
      }
    }

    await this.advanceToNextAction();
  }

  private async dispatchActionSubmittedAndAdvance(): Promise<void> {
    try {
      this.nightFlowService.dispatchEvent(NightEvent.ActionSubmitted);
    } catch (err) {
      if (err instanceof InvalidNightTransitionError) {
        hostLog.error('NightFlow ActionSubmitted failed:', (err as Error).message);
        throw err;
      }
      throw err;
    }

    await this.advanceToNextAction();
  }

  private async checkNightmareBlock(
    seat: number,
    role: RoleId,
    target: number | null,
    extra?: unknown,
  ): Promise<'blocked' | 'allowed'> {
    if (!this.state) return 'allowed';

    const nightmareAction = this.state.actions.get('nightmare');
    if (nightmareAction?.kind !== 'target' || nightmareAction.targetSeat !== seat) {
      return 'allowed';
    }

    if (target === null && extra === undefined) {
      return 'allowed';
    }

    hostLog.info('Rejecting non-skip action from nightmare-blocked seat:', seat);

    const playerUid = this.state.players.get(seat)?.uid;
    if (playerUid) {
      this.stateManager.batchUpdate({
        actionRejected: {
          action: 'submitAction',
          reason: BLOCKED_UI_DEFAULTS.message,
          targetUid: playerUid,
        },
      });
      await this.broadcastState();
    }
    return 'blocked';
  }

  private async rejectAction(
    seat: number,
    action: 'submitAction' | 'submitWolfVote',
    reason: string,
  ): Promise<boolean> {
    const playerUid = this.state?.players.get(seat)?.uid;
    if (!playerUid) return false;

    this.stateManager.batchUpdate({
      actionRejected: { action, reason, targetUid: playerUid },
    });
    await this.broadcastState();
    return true;
  }

  private applyActionResult(
    role: RoleId,
    target: number | null,
    result: { updates?: Record<string, unknown>; reveal?: any; actionToRecord?: any },
  ): void {
    if (result.updates) {
      this.stateManager.applyNightResultUpdates(result.updates);
    }

    if (result.reveal && target !== null) {
      this.stateManager.applyReveal(result.reveal);
    }

    if (result.actionToRecord && target !== null) {
      this.stateManager.recordAction(role, result.actionToRecord);

      try {
        this.nightFlowService.recordAction(role, target);
      } catch (err) {
        hostLog.error('NightFlow recordAction failed:', err);
        throw err;
      }
    }
  }

  private makeRevealAckKey(revision: number, role: RoleId): string {
    return `${revision}_${role}`;
  }

  private buildActionContext(): ActionContext {
    if (!this.state) {
      return {
        players: new Map(),
        currentNightResults: {},
        actions: new Map(),
        wolfVotes: new Map(),
      };
    }
    return {
      players: this.stateManager.buildRoleMap(),
      currentNightResults: (this.state.currentNightResults ?? {}) as Record<string, unknown>,
      witchContext: this.state.witchContext,
      actions: this.state.actions,
      wolfVotes: this.state.wolfVotes,
    };
  }

  private buildRoleSeatMap(): RoleSeatMap {
    return {
      witcher: this.stateManager.findSeatByRole('witcher'),
      wolfQueen: this.stateManager.findSeatByRole('wolfQueen'),
      dreamcatcher: this.stateManager.findSeatByRole('dreamcatcher'),
      spiritKnight: this.stateManager.findSeatByRole('spiritKnight'),
      seer: this.stateManager.findSeatByRole('seer'),
      witch: this.stateManager.findSeatByRole('witch'),
      guard: this.stateManager.findSeatByRole('guard'),
    };
  }

  private calculateDeaths(): number[] {
    if (!this.state) return [];

    const nightActions = this.actionProcessor.buildNightActions(
      this.state.actions,
      this.state.players,
    );
    const roleSeatMap = this.buildRoleSeatMap();

    return calculateDeaths(nightActions, roleSeatMap);
  }

  private createAsyncHandler<T extends (...args: any[]) => Promise<void>>(fn: T) {
    return (...args: Parameters<T>): void => {
      fn(...args).catch((err) => hostLog.error('Async handler error', err));
    };
  }
}
