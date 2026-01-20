/**
 * GameStateService - Manages local game state (Host is authoritative)
 *
 * This service maintains the game state entirely in memory on the Host device.
 * All state changes are broadcast to other players via BroadcastService.
 *
 * Key Principles:
 * 1. Host device is the Single Source of Truth
 * 2. No game state is stored in Supabase database
 * 3. Players receive state updates via Realtime Broadcast
 * 4. Death calculations happen locally on Host
 */

import { RoleId, isWolfRole, doesRoleParticipateInWolfVote } from '../models/roles';
import { GameTemplate, createTemplateFromRoles, validateTemplateRoles } from '../models/Template';
import {
  BroadcastGameState,
  BroadcastPlayer,
  HostBroadcast,
  PlayerMessage,
} from './BroadcastService';
import AudioService from './AudioService';
import { NightPhase, NightEvent, InvalidNightTransitionError } from './NightFlowController';
import { shuffleArray } from '../utils/shuffle';
import { hostLog, playerLog } from '../utils/logger';
import { calculateDeaths, type RoleSeatMap } from './DeathCalculator';
import { resolveWolfVotes } from './WolfVoteResolver';
import { makeActionTarget, getActionTargetSeat } from '../models/actions';
import {
  isValidRoleId,
  ROLE_SPECS,
  type SchemaId,
  buildNightPlan,
  BLOCKED_UI_DEFAULTS,
} from '../models/roles/spec';
import {
  type ActionInput,
  type ResolverResult,
} from './night/resolvers/types';
import {
  wolfVoteResolver,
  type WolfVoteContext,
  type WolfVoteInput,
} from './night/resolvers/wolfVote';
import { getConfirmRoleCanShoot } from '../models/Room';
import { StateManager } from './state';
import { StatePersistence } from './persistence';
import { BroadcastCoordinator } from './broadcast';
import { SeatManager } from './seat';
import { ActionProcessor } from './action';
import { NightFlowService } from './night';

// Import types/enums needed internally
import { GameStatus, LocalPlayer, LocalGameState } from './types/GameStateTypes';

// Import type-only imports
import type { GameStateListener } from './types/GameStateTypes';

// Re-export types for convenience
// (consumers can import from either GameStateService or types/GameStateTypes)
export { GameStatus, LocalPlayer, LocalGameState, GameStateListener } from './types/GameStateTypes';

/** Async handler wrapper to avoid unhandled promise rejection */
const asyncHandler = <T extends (...args: any[]) => Promise<void>>(fn: T) => {
  return (...args: Parameters<T>): void => {
    fn(...args).catch((err) => hostLog.error('Async handler error', err));
  };
};

// =============================================================================
// Service Implementation
// =============================================================================

export class GameStateService {
  private static instance: GameStateService;

  /**
   * StateManager: Pure state management module (Phase 1 extraction)
   * Currently used for state conversion only, will gradually take over
   * state storage and listener management.
   */
  private readonly stateManager: StateManager;

  /**
   * StatePersistence: State persistence module (Phase 2 extraction)
   * Handles saving/loading state to/from AsyncStorage.
   * ✅ Phase 2 migration complete - all persistence delegated to this module.
   */
  private readonly statePersistence: StatePersistence;

  /**
   * BroadcastCoordinator: Broadcast communication module (Phase 3 extraction)
   * Handles sending/receiving messages via BroadcastService.
   * ✅ Phase 3 migration complete - all broadcast calls use broadcastCoordinator.
   */
  private readonly broadcastCoordinator: BroadcastCoordinator;

  /**
   * SeatManager: Seat management module (Phase 4 extraction)
   * Handles sit/standup operations for both Host and Player.
   * ✅ Phase 4 migration complete - SeatManager uses broadcastCoordinator.
   */
  private readonly seatManager: SeatManager;

  /**
   * ActionProcessor: Action processing module (Phase 5 extraction)
   * Handles night action validation, resolver invocation, and death calculation.
   */
  private readonly actionProcessor: ActionProcessor;

  private state: LocalGameState | null = null;
  private isHost: boolean = false;
  private myUid: string | null = null;
  private mySeatNumber: number | null = null;

  /** State revision counter (Host: incremented on each change, Player: received from Host) */
  private stateRevision: number = 0;

  /** Pending snapshot request (Player: waiting for response) */
  private pendingSnapshotRequest: {
    requestId: string;
    timestamp: number;
    timeoutHandle: ReturnType<typeof setTimeout>;
  } | null = null;

  /**
   * NightFlowService: manages night flow control and audio playback (Host only)
   * ✅ Phase 6 migration complete - all nightFlow access now via this service.
   */
  private readonly nightFlowService: NightFlowService;

  /**
   * Host-only: gate advancing after a reveal action until the revealer confirms.
   * Key format: `${revision}_${role}`
   */
  private readonly pendingRevealAcks: Set<string> = new Set();

  private readonly audioService: AudioService;

  // NOTE: listeners moved to StateManager (Phase 8 migration)

  private constructor() {
    this.stateManager = new StateManager();
    this.statePersistence = new StatePersistence();
    this.actionProcessor = new ActionProcessor();
    this.audioService = AudioService.getInstance();

    // Initialize BroadcastCoordinator with config callbacks
    this.broadcastCoordinator = new BroadcastCoordinator({
      isHost: () => this.isHost,
      getMyUid: () => this.myUid,
      getRevision: () => this.stateRevision,
      toBroadcastState: () => (this.state ? this.toBroadcastState() : null),
    });

    // Initialize SeatManager with config callbacks
    this.seatManager = new SeatManager({
      isHost: () => this.isHost,
      getMyUid: () => this.myUid,
      getState: () => this.state,
      setMySeatNumber: (seat) => {
        this.mySeatNumber = seat;
      },
      getMySeatNumber: () => this.mySeatNumber,
      broadcastState: () => this.broadcastState(),
      notifyListeners: () => this.notifyListeners(),
      broadcastCoordinator: this.broadcastCoordinator,
    });

    // Initialize NightFlowService with config callbacks
    this.nightFlowService = new NightFlowService({
      getState: () => this.state,
      updateState: (updates) => {
        if (this.state) {
          Object.assign(this.state, updates);
        }
      },
      getSeatsForRole: (role) => this.getSeatsForRole(role),
      // Callback: NightFlowService notifies us when a role's turn starts
      onRoleTurnStart: async (role, pendingSeats, stepId) => {
        await this.handleRoleTurnStart(role, pendingSeats, stepId);
      },
      // Callback: NightFlowService notifies us when night ends
      onNightEnd: async () => {
        await this.endNight();
      },
    });
  }

  static getInstance(): GameStateService {
    if (!GameStateService.instance) {
      GameStateService.instance = new GameStateService();
    }
    return GameStateService.instance;
  }

  // ===========================================================================
  // State Access
  // ===========================================================================

  getState(): LocalGameState | null {
    return this.state;
  }

  isHostPlayer(): boolean {
    return this.isHost;
  }

  getMyUid(): string | null {
    return this.myUid;
  }

  getMySeatNumber(): number | null {
    return this.mySeatNumber;
  }

  getMyRole(): RoleId | null {
    if (this.mySeatNumber === null || !this.state) return null;
    return this.state.players.get(this.mySeatNumber)?.role ?? null;
  }

  getLastSeatError(): { seat: number; reason: 'seat_taken' } | null {
    return this.seatManager.getLastSeatError();
  }

  clearLastSeatError(): void {
    this.seatManager.clearLastSeatError();
  }

  // ===========================================================================
  // State Listeners (delegated to StateManager for Phase 8 migration)
  // ===========================================================================

  addListener(listener: GameStateListener): () => void {
    // Delegate to StateManager, but handle the case where state is in GameStateService
    // TODO(Phase 8): After full migration, this becomes just stateManager.subscribe(listener)
    
    // For now, we need to sync StateManager's state with our state before subscribing
    if (this.state && !this.stateManager.hasState()) {
      this.stateManager.initialize(this.state);
    }
    
    return this.stateManager.subscribe(listener);
  }

  private notifyListeners(): void {
    // Sync state to StateManager before notifying
    // TODO(Phase 8): After full migration, remove this - StateManager auto-notifies on updateState
    if (this.state) {
      if (!this.stateManager.hasState()) {
        this.stateManager.initialize(this.state);
      } else {
        // Force StateManager to use our state reference and notify
        // This is a migration workaround - eventually all state updates go through StateManager
        this.syncStateToManager();
      }
    }
  }

  /**
   * Migration helper: sync GameStateService's state to StateManager
   * TODO(Phase 8): Remove after full migration to StateManager.updateState()
   */
  private syncStateToManager(): void {
    if (!this.state) return;
    // Use batchUpdate with full state to sync and notify listeners
    this.stateManager.batchUpdate({ ...this.state });
  }

  // ===========================================================================
  // State Persistence (Host only) - delegated to StatePersistence module
  // ===========================================================================

  /**
   * Clear saved state for a room (called when game ends or room is deleted)
   */
  async clearSavedState(roomCode: string): Promise<void> {
    await this.statePersistence.clearState(roomCode);
  }

  // ===========================================================================
  // Room Initialization (Host)
  // ===========================================================================

  /**
   * Initialize a new game as Host
   */
  async initializeAsHost(roomCode: string, hostUid: string, template: GameTemplate): Promise<void> {
    // If already in a room, leave it first (clean up old state)
    if (this.state) {
      const oldRoomCode = this.state.roomCode;
      hostLog.info('Leaving old room before creating new one:', oldRoomCode);
      await this.broadcastCoordinator.leaveRoom();
      // Note: We don't clear saved state here - it can be recovered if needed
    }

    this.isHost = true;
    this.myUid = hostUid;
    this.mySeatNumber = null;

    // Create initial state
    const players = new Map<number, LocalPlayer | null>();
    for (let i = 0; i < template.numberOfPlayers; i++) {
      players.set(i, null);
    }

    this.state = {
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
    };

    // Join broadcast channel
    await this.broadcastCoordinator.joinRoom(roomCode, hostUid, {
      // Host must also receive its own host broadcasts (broadcast.self=true),
      // including PRIVATE_EFFECT messages addressed to hostUid.
      // Otherwise, reveal roles won't work when the host is the actioner.
      onHostBroadcast: (msg) => this.handleHostBroadcast(msg),
      onPlayerMessage: asyncHandler((msg, senderId) => this.handlePlayerMessage(msg, senderId)),
      onPresenceChange: asyncHandler(async (users) => {
        hostLog.info('Users in room:', users.length);
        // Broadcast state when new users join so they receive current state
        if (this.state) {
          await this.broadcastState();
        }
      }),
    });

    // Broadcast initial state
    await this.broadcastState();
    this.notifyListeners();

    hostLog.info('Initialized as Host for room:', roomCode);
  }

  /**
   * Rejoin an existing room as Host (recovery scenario)
   *
   * This is used when the Host app restarts and tries to rejoin via room code.
   * First tries to recover state from AsyncStorage, otherwise creates placeholder state.
   */
  async rejoinAsHost(roomCode: string, hostUid: string): Promise<void> {
    this.isHost = true;
    this.myUid = hostUid;
    this.mySeatNumber = null;

    // Try to recover state from storage
    const savedState = await this.statePersistence.loadState(roomCode);

    if (savedState) {
      // Recovered! Use saved state
      this.state = savedState;

      // Restore mySeatNumber if host was seated
      for (const [seatNum, player] of savedState.players.entries()) {
        if (player?.uid === hostUid) {
          this.mySeatNumber = seatNum;
          break;
        }
      }

      hostLog.info('Host state recovered from storage for room:', roomCode);
    } else {
      // No saved state - create placeholder
      this.state = {
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
      };

      hostLog.warn('No saved state found, created placeholder for room:', roomCode);
    }

    // Join broadcast channel as Host
    await this.broadcastCoordinator.joinRoom(roomCode, hostUid, {
      onHostBroadcast: (msg) => this.handleHostBroadcast(msg),
      onPlayerMessage: asyncHandler((msg, senderId) => this.handlePlayerMessage(msg, senderId)),
      onPresenceChange: asyncHandler(async (users) => {
        hostLog.info('Users in room (rejoin):', users.length);
        if (this.state) {
          await this.broadcastState();
        }
      }),
    });

    // Broadcast state so players receive current state
    await this.broadcastState();
    this.notifyListeners();

    if (savedState) {
      hostLog.info('Rejoined as Host with recovered state:', roomCode);
    } else {
      hostLog.warn('Rejoined as Host (state lost, game needs restart):', roomCode);
    }
  }

  /**
   * Join an existing game as Player
   */
  async joinAsPlayer(
    roomCode: string,
    playerUid: string,
    _displayName?: string,
    _avatarUrl?: string,
  ): Promise<void> {
    this.isHost = false;
    this.myUid = playerUid;
    this.mySeatNumber = null;
    // Reset state revision to accept fresh state from Host on reconnect
    this.stateRevision = 0;

    // Join broadcast channel
    await this.broadcastCoordinator.joinRoom(roomCode, playerUid, {
      onHostBroadcast: (msg) => this.handleHostBroadcast(msg),
      onPresenceChange: (users) => hostLog.info('Users in room:', users.length),
    });

    // Request current state from host
    await this.broadcastCoordinator.requestState(playerUid);

    hostLog.info('Joined as Player for room:', roomCode);
  }

  /**
   * Leave the current room
   */
  async leaveRoom(): Promise<void> {
    // Save roomCode before clearing state (needed for storage cleanup)
    const roomCode = this.state?.roomCode;

    // If seated, notify host
    if (!this.isHost && this.mySeatNumber !== null && this.myUid) {
      await this.broadcastCoordinator.sendToHost({
        type: 'LEAVE',
        seat: this.mySeatNumber,
        uid: this.myUid,
      });
    }

    // If host, clear saved state
    if (this.isHost && roomCode) {
      await this.clearSavedState(roomCode);
    }

    await this.broadcastCoordinator.leaveRoom();
    this.state = null;
    this.isHost = false;
    this.myUid = null;
    this.mySeatNumber = null;
    this.notifyListeners();

    hostLog.info('Left room');
  }

  // ===========================================================================
  // Host: Handle Player Messages
  // ===========================================================================

  private async handlePlayerMessage(msg: PlayerMessage, _senderId: string): Promise<void> {
    if (!this.isHost || !this.state) return;

    hostLog.info('Received player message:', msg.type);

    switch (msg.type) {
      case 'REQUEST_STATE':
        // Player requesting current state - broadcast it
        hostLog.info('Broadcasting state for new player:', msg.uid);
        await this.broadcastState();
        break;
      case 'JOIN':
        await this.handlePlayerJoin(msg.seat, msg.uid, msg.displayName, msg.avatarUrl);
        break;
      case 'LEAVE':
        await this.handlePlayerLeave(msg.seat, msg.uid);
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
        await this.handleSeatActionRequest(msg);
        break;
      case 'SNAPSHOT_REQUEST':
        await this.handleSnapshotRequest(msg);
        break;
    }
  }

  private makeRevealAckKey(revision: number, role: RoleId): string {
    return `${revision}_${role}`;
  }

  private async handleRevealAck(seat: number, role: RoleId, revision: number): Promise<void> {
    if (!this.isHost || !this.state) return;
    if (this.state.status !== GameStatus.ongoing) return;
    if (!this.nightFlowService.isActive()) return;

    // Only relevant for reveal roles
    if (!this.actionProcessor.isRevealRole(role)) return;

    const player = this.state.players.get(seat);
    if (!player) return;

    // Must match role and revision; otherwise ignore (idempotent/no-op)
    if (player.role !== role) return;
    if (revision !== this.stateRevision) return;
    if (!this.nightFlowService.canAcceptAction(role)) return;

    const key = this.makeRevealAckKey(revision, role);
    if (!this.pendingRevealAcks.has(key)) return;

    this.pendingRevealAcks.delete(key);

    // Now we can finish the step just like a normal action-submitted flow.
    try {
      this.nightFlowService.dispatchEvent(NightEvent.ActionSubmitted);
    } catch (err) {
      if (err instanceof InvalidNightTransitionError) {
        hostLog.debug('REVEAL_ACK ignored (phase mismatch):', err.message);
        return;
      }
      throw err;
    }

    await this.advanceToNextAction();
  }

  /**
   * Host: Handle seat action request with ACK
   * Delegated to SeatManager (Phase 8 migration)
   */
  private async handleSeatActionRequest(msg: {
    requestId: string;
    action: 'sit' | 'standup';
    seat: number;
    uid: string;
    displayName?: string;
    avatarUrl?: string;
  }): Promise<void> {
    // Delegate to SeatManager
    await this.seatManager.handleSeatActionRequest({
      type: 'SEAT_ACTION_REQUEST',
      ...msg,
    });
  }

  /**
   * Host: Handle snapshot request (for reconnection/state recovery)
   */
  private async handleSnapshotRequest(msg: {
    requestId: string;
    uid: string;
    lastRevision?: number;
  }): Promise<void> {
    if (!this.state) return;

    hostLog.info(
      ` Snapshot request from ${msg.uid.substring(0, 8)}, lastRev: ${msg.lastRevision ?? 'none'}`,
    );

    const broadcastState = this.toBroadcastState();
    await this.broadcastCoordinator.broadcastSnapshotResponse({
      requestId: msg.requestId,
      toUid: msg.uid,
      state: broadcastState,
      revision: this.stateRevision,
    });
  }

  private async handlePlayerJoin(
    seat: number,
    uid: string,
    displayName?: string,
    avatarUrl?: string,
  ): Promise<void> {
    return this.seatManager.handlePlayerJoin(seat, uid, displayName, avatarUrl);
  }

  private async handlePlayerLeave(seat: number, uid: string): Promise<void> {
    return this.seatManager.handlePlayerLeave(seat, uid);
  }

  private async handlePlayerAction(
    seat: number,
    role: RoleId,
    target: number | null,
    extra?: any,
  ): Promise<void> {
    if (!this.state || this.state.status !== GameStatus.ongoing) return;

    // STRICT INVARIANT: nightFlow must exist when status === ongoing
    if (!this.nightFlowService.isActive()) {
      hostLog.error(
        '[GameStateService] STRICT INVARIANT VIOLATION: handlePlayerAction() called but nightFlow is null.',
        'seat:',
        seat,
        'role:',
        role,
      );
      throw new Error('handlePlayerAction: nightFlow is null - strict invariant violation');
    }

    // Verify this is the correct role's turn
    const currentRole = this.getCurrentActionRole();
    if (currentRole !== role) {
      hostLog.info('Wrong role acting:', role, 'expected:', currentRole);
      return;
    }

    // NightFlow guard: only allow action in WaitingForAction phase and matching role
    if (!this.nightFlowService.canAcceptAction(role)) {
      const phase = this.nightFlowService.getCurrentPhase();
      const currentNightRole = this.nightFlowService.getNightFlow()?.currentRole;
      if (phase !== NightPhase.WaitingForAction) {
        hostLog.info('NightFlow not in WaitingForAction phase, ignoring action');
      } else {
        hostLog.info('NightFlow role mismatch:', role, 'expected:', currentNightRole);
      }
      return;
    }

    // Authoritative gate: reject action if player is blocked by nightmare
    // Blocked players can ONLY skip (target=null, extra=undefined). Any other action is rejected.
    const nightmareAction = this.state.actions.get('nightmare');
    if (nightmareAction?.kind === 'target' && nightmareAction.targetSeat === seat) {
      if (target !== null || extra !== undefined) {
        hostLog.info(
          'Rejecting non-skip action from nightmare-blocked seat:',
          seat,
          'role:',
          role,
          'target:',
          target,
          'extra:',
          extra,
        );
        // Set actionRejected in state for the blocked player
        const playerUid = this.state.players.get(seat)?.uid;
        if (playerUid) {
          this.state.actionRejected = {
            action: 'submitAction',
            reason: BLOCKED_UI_DEFAULTS.message,
            targetUid: playerUid,
          };
          await this.broadcastState();
        }
        return;
      }
      // target === null && extra === undefined: allowed (skip)
    }

    // =========================================================================
    // Action Processing via ActionProcessor
    // =========================================================================
    const schemaId = this.getCurrentSchemaId();
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
        // Reject action
        const playerUid = this.state.players.get(seat)?.uid;
        if (playerUid) {
          this.state.actionRejected = {
            action: 'submitAction',
            reason: result.rejectReason ?? '行动无效',
            targetUid: playerUid,
          };
          await this.broadcastState();
        }
        hostLog.info('Action rejected by resolver:', result.rejectReason);
        return;
      }

      // Apply updates to currentNightResults
      if (result.updates) {
        this.state.currentNightResults = {
          ...this.state.currentNightResults,
          ...result.updates,
        };

        // Sync fields that need to be broadcast
        if (result.updates.blockedSeat !== undefined) {
          this.state.nightmareBlockedSeat = result.updates.blockedSeat as number;
        }
        if (result.updates.wolfKillDisabled !== undefined) {
          this.state.wolfKillDisabled = result.updates.wolfKillDisabled as boolean;
        }
      }

      // Apply reveal result
      if (result.reveal && target !== null) {
        this.applyRevealFromProcessResult(result.reveal);
      }

      // Record action using actionToRecord from processor
      if (result.actionToRecord && target !== null) {
        this.state.actions.set(role, result.actionToRecord);

        // Record action in nightFlow (raw target only for logging/debug)
        try {
          this.nightFlowService.recordAction(role, target);
        } catch (err) {
          hostLog.error('NightFlow recordAction failed:', err);
          throw err; // STRICT: propagate error, don't continue
        }
      }
    }

    // Reveal roles require an explicit "I read it" ACK before advancing.
    // This prevents the next narration ("闭眼") from cutting off the popup.
    if (this.actionProcessor.isRevealRole(role) && target !== null) {
      // Broadcast the reveal result to UI before waiting for ACK
      // NOTE: broadcastState() increments stateRevision, so we must add the ACK key AFTER broadcast
      await this.broadcastState();
      this.pendingRevealAcks.add(this.makeRevealAckKey(this.stateRevision, role));
      // Stay in WaitingForAction until REVEAL_ACK arrives.
      return;
    }

    // Non-reveal roles proceed immediately
    try {
      this.nightFlowService.dispatchEvent(NightEvent.ActionSubmitted);
    } catch (err) {
      if (err instanceof InvalidNightTransitionError) {
        hostLog.error('NightFlow ActionSubmitted failed:', err.message);
        throw err; // STRICT: propagate error
      } else {
        throw err;
      }
    }

    await this.advanceToNextAction();
  }

  private async handleWolfVote(seat: number, target: number): Promise<void> {
    if (!this.state || this.state.status !== GameStatus.ongoing) {
      hostLog.debug('handleWolfVote: early return - status not ongoing or no state');
      return;
    }

    // STRICT INVARIANT: nightFlow must exist when status === ongoing
    if (!this.nightFlowService.isActive()) {
      hostLog.error(
        '[GameStateService] STRICT INVARIANT VIOLATION: handleWolfVote() called but nightFlow is null.',
        'seat:',
        seat,
      );
      throw new Error('handleWolfVote: nightFlow is null - strict invariant violation');
    }

    const currentRole = this.getCurrentActionRole();
    hostLog.debug('handleWolfVote:', {
      seat,
      target,
      currentRole,
      currentActionerIndex: this.state.currentActionerIndex,
      nightFlowPhase: this.nightFlowService.getCurrentPhase(),
    });
    if (currentRole !== 'wolf') {
      hostLog.debug('handleWolfVote: rejected - currentRole is not wolf:', currentRole);
      return;
    }

    // Verify this is a wolf
    const player = this.state.players.get(seat);
    if (!player?.role || !isWolfRole(player.role)) return;

    const playerUid = player.uid;

    // === Delegate to wolfVoteValidator for immuneToWolfKill check ===
    const resolverContext: WolfVoteContext = {
      players: new Map(
        Array.from(this.state.players.entries())
          .filter(([, p]) => p?.role)
          .map(([s, p]) => [s, p!.role as RoleId]),
      ),
    };
    const resolverInput: WolfVoteInput = { targetSeat: target };
    const resolverResult = wolfVoteResolver(resolverContext, resolverInput);

    if (!resolverResult.valid) {
      if (playerUid) {
        this.state.actionRejected = {
          action: 'submitWolfVote',
          reason: resolverResult.rejectReason ?? '无效目标',
          targetUid: playerUid,
        };
        await this.broadcastState();
      }
      return;
    }
    // === End wolfVoteValidator check ===

    // Record vote
    this.state.wolfVotes.set(seat, target);

    // Check if all voting wolves have voted (excludes gargoyle, wolfRobot, etc.)
    const allVotingWolfSeats = this.getVotingWolfSeats();
    const allVoted = allVotingWolfSeats.every((s) => this.state!.wolfVotes.has(s));

    if (allVoted) {
      // ONCE-GUARD: If wolf action already recorded, this is a duplicate finalize - skip
      if (this.state.actions.has('wolf')) {
        hostLog.debug(
          '[GameStateService] handleWolfVote finalize skipped (once-guard): wolf action already recorded.',
          'phase:',
          this.nightFlowService.getCurrentPhase(),
          'currentActionerIndex:',
          this.state.currentActionerIndex,
        );
        return;
      }

      // [Bridge: WolfVoteResolver] Resolve final kill target from wolf votes
      const finalTarget = resolveWolfVotes(this.state.wolfVotes);
      if (finalTarget !== null) {
        this.state.actions.set('wolf', makeActionTarget(finalTarget));
        // Record action in nightFlow
        try {
          this.nightFlowService.recordAction('wolf', finalTarget);
        } catch (err) {
          hostLog.debug(
            '[GameStateService] NightFlow recordAction (wolf) failed:',
            err,
            'phase:',
            this.nightFlowService.getCurrentPhase(),
          );
        }
      }

      // Dispatch ActionSubmitted to nightFlow (required before advanceToNextAction)
      try {
        this.nightFlowService.dispatchEvent(NightEvent.ActionSubmitted);
      } catch (err) {
        if (err instanceof InvalidNightTransitionError) {
          // This should NOT happen with proper once-guard above
          // If it does, it indicates a bug in the call chain
          hostLog.debug(
            '[GameStateService] NightFlow ActionSubmitted (wolf) rejected:',
            'phase:',
            this.nightFlowService.getCurrentPhase(),
            '(expected WaitingForAction). This may indicate a call chain bug.',
          );
        } else {
          throw err;
        }
      }

      await this.advanceToNextAction();
    } else {
      // Broadcast vote status update
      await this.broadcastState();
      this.notifyListeners();
    }
  }

  private async handlePlayerViewedRole(seat: number): Promise<void> {
    if (!this.state || this.state.status !== GameStatus.assigned) return;

    const player = this.state.players.get(seat);
    if (!player) return;

    player.hasViewedRole = true;

    // Check if all players have viewed
    const allViewed = Array.from(this.state.players.values())
      .filter((p): p is LocalPlayer => p !== null)
      .every((p) => p.hasViewedRole);

    if (allViewed) {
      this.state.status = GameStatus.ready;
    }

    await this.broadcastState();
    this.notifyListeners();
  }

  // ===========================================================================
  // Player: Handle Host Broadcasts
  // ===========================================================================

  private handleHostBroadcast(msg: HostBroadcast): void {
    // Legacy PRIVATE_EFFECT messages are no longer used (removed in refactor)
    // Type guard for any unexpected message types
    if ((msg as { type: string }).type === 'PRIVATE_EFFECT') {
      playerLog.debug('Ignoring legacy PRIVATE_EFFECT message');
      return;
    }

    playerLog.info('Received host broadcast:', msg.type);

    switch (msg.type) {
      case 'STATE_UPDATE':
        // Host is authoritative - should not overwrite local state from broadcast
        if (this.isHost) {
          hostLog.info('Ignoring own STATE_UPDATE broadcast');
          return;
        }
        this.applyStateUpdate(msg.state, msg.revision);
        break;
      case 'ROLE_TURN':
        // UI-only: stash current stepId for schema-driven UI mapping.
        // Logic continues to come from STATE_UPDATE (Host is authoritative).
        if (!this.isHost && this.state) {
          this.state.currentStepId = msg.stepId;
          this.notifyListeners();
        }
        break;
      case 'NIGHT_END':
        // Update local deaths
        if (this.state) {
          this.state.lastNightDeaths = msg.deaths;
          this.state.status = GameStatus.ended;
          this.notifyListeners();
        }
        break;
      case 'SEAT_REJECTED':
        // Only the player who requested the seat should handle this
        if (msg.requestUid === this.myUid) {
          playerLog.info('My seat request rejected:', msg.seat, msg.reason);
          this.seatManager.setLastSeatError({ seat: msg.seat, reason: msg.reason });
          this.notifyListeners();
        }
        break;
      case 'SEAT_ACTION_ACK':
        // Handle ACK for pending seat action
        this.handleSeatActionAck(msg);
        break;
      case 'SNAPSHOT_RESPONSE':
        // Handle snapshot response (only if we requested it)
        this.handleSnapshotResponse(msg);
        break;
      case 'GAME_RESTARTED':
        // Reset local state
        if (this.state) {
          this.state.status = GameStatus.seated;
          this.state.actions = new Map();
          this.state.wolfVotes = new Map();
          this.state.currentActionerIndex = 0;
          this.state.lastNightDeaths = [];
          this.state.currentStepId = undefined;
          // Clear role-specific context on game restart
          this.state.witchContext = undefined;
          this.state.seerReveal = undefined;
          this.state.psychicReveal = undefined;
          this.state.gargoyleReveal = undefined;
          this.state.wolfRobotReveal = undefined;
          this.state.confirmStatus = undefined;
          this.state.actionRejected = undefined;
          // Clear roles
          this.state.players.forEach((p, _seat) => {
            if (p) {
              p.role = null;
              p.hasViewedRole = false;
            }
          });
          this.notifyListeners();
        }
        break;
    }
  }

  /**
   * Player: Handle seat action ACK from Host
   * Delegated to SeatManager (Phase 8 migration)
   */
  private handleSeatActionAck(msg: {
    requestId: string;
    success: boolean;
    seat: number;
    toUid: string;
    reason?: string;
  }): void {
    this.seatManager.handleSeatActionAck({
      type: 'SEAT_ACTION_ACK',
      ...msg,
    });
  }

  /**
   * Player: Handle snapshot response from Host
   */
  private handleSnapshotResponse(msg: {
    requestId: string;
    toUid: string;
    state: BroadcastGameState;
    revision: number;
  }): void {
    // Only handle if addressed to us
    if (msg.toUid !== this.myUid) {
      return;
    }

    // Only handle if we have a pending request with matching ID
    if (!this.pendingSnapshotRequest || this.pendingSnapshotRequest.requestId !== msg.requestId) {
      playerLog.info(` Ignoring snapshot - no matching pending request`);
      return;
    }

    playerLog.info(` Snapshot received, revision: ${msg.revision}`);

    // Clear timeout
    clearTimeout(this.pendingSnapshotRequest.timeoutHandle);
    this.pendingSnapshotRequest = null;

    // Apply state unconditionally (snapshot is always authoritative)
    this.applyStateUpdate(msg.state, msg.revision);

    // Mark connection as live
    this.broadcastCoordinator.markAsLive();
  }

  private applyStateUpdate(broadcastState: BroadcastGameState, revision?: number): void {
    // Update revision if provided
    if (revision !== undefined) {
      // Skip if we've already seen a newer revision
      if (revision <= this.stateRevision) {
        playerLog.info(` Skipping stale update (rev ${revision} <= ${this.stateRevision})`);
        return;
      }
      this.stateRevision = revision;
    }

    // Mark connection as live after receiving state
    this.broadcastCoordinator.markAsLive();
    // Create or update local state from broadcast
    const template = createTemplateFromRoles(broadcastState.templateRoles);

    playerLog.info(
      `applyStateUpdate: myUid=${this.myUid?.substring(0, 8)}, players count=${Object.keys(broadcastState.players).length}`,
    );

    const players = new Map<number, LocalPlayer | null>();
    Object.entries(broadcastState.players).forEach(([seatStr, bp]) => {
      const seat = Number.parseInt(seatStr);
      if (bp) {
        playerLog.debug(
          `  seat ${seat}: uid=${bp.uid?.substring(0, 8)}, match=${bp.uid === this.myUid}`,
        );
        players.set(seat, {
          uid: bp.uid,
          seatNumber: bp.seatNumber,
          displayName: bp.displayName,
          avatarUrl: bp.avatarUrl,
          role: bp.role ?? null,
          hasViewedRole: bp.hasViewedRole,
        });
        // Track my seat
        if (bp.uid === this.myUid) {
          playerLog.info(`Found my seat: ${seat}, myUid: ${this.myUid?.substring(0, 8)}`);
          this.mySeatNumber = seat;
        }
      } else {
        players.set(seat, null);
      }
    });

    playerLog.info(
      `applyStateUpdate complete: mySeatNumber=${this.mySeatNumber}, myUid=${this.myUid?.substring(0, 8)}, status=${broadcastState.status}`,
    );

    // Rebuild wolfVotes from wolfVoteStatus (anti-cheat: only track who voted, not targets)
    // Players need to know who has voted to update imActioner state.
    const wolfVotes = new Map<number, number>();
    if (broadcastState.wolfVoteStatus) {
      for (const [seatStr, hasVoted] of Object.entries(broadcastState.wolfVoteStatus)) {
        if (hasVoted) {
          // Use -999 as placeholder target (players don't see actual targets)
          wolfVotes.set(Number.parseInt(seatStr, 10), -999);
        }
      }
    }

    this.state = {
      roomCode: broadcastState.roomCode,
      hostUid: broadcastState.hostUid,
      status: broadcastState.status as GameStatus,
      template,
      players,
      actions: new Map(), // Players don't see actions
      wolfVotes,
      currentActionerIndex: broadcastState.currentActionerIndex,
      isAudioPlaying: broadcastState.isAudioPlaying,
      lastNightDeaths: this.state?.lastNightDeaths ?? [],
      nightmareBlockedSeat: broadcastState.nightmareBlockedSeat,
      wolfKillDisabled: broadcastState.wolfKillDisabled,
      // Players don't see currentNightResults (Host-only state)
      currentNightResults: {},
      // Role-specific context (all data is public, UI filters by myRole)
      witchContext: broadcastState.witchContext,
      seerReveal: broadcastState.seerReveal,
      psychicReveal: broadcastState.psychicReveal,
      gargoyleReveal: broadcastState.gargoyleReveal,
      wolfRobotReveal: broadcastState.wolfRobotReveal,
      confirmStatus: broadcastState.confirmStatus,
      actionRejected: broadcastState.actionRejected,
    };

    this.notifyListeners();
  }

  // ===========================================================================
  // Host: Game Flow Control
  // ===========================================================================

  // NOTE: processSeatAction removed - delegated to SeatManager (Phase 8)

  /**
   * Take a seat (unified path for Host and Player)
   * Delegated to SeatManager (Phase 8 migration)
   */
  async takeSeat(seat: number, displayName?: string, avatarUrl?: string): Promise<boolean> {
    return this.seatManager.takeSeat(seat, displayName, avatarUrl);
  }

  /**
   * Leave seat (unified path for Host and Player)
   * Delegated to SeatManager (Phase 8 migration)
   */
  async leaveSeat(): Promise<boolean> {
    return this.seatManager.leaveSeat();
  }

  /**
   * Host: Assign roles to all players
   */
  async assignRoles(): Promise<void> {
    if (!this.isHost || !this.state) return;
    if (this.state.status !== GameStatus.seated) return;

    // Shuffle roles
    const shuffledRoles = shuffleArray([...this.state.template.roles]);

    // Assign to players
    let i = 0;
    this.state.players.forEach((player, _seat) => {
      if (player) {
        player.role = shuffledRoles[i];
        player.hasViewedRole = false;
        i++;
      }
    });

    this.state.status = GameStatus.assigned;

    await this.broadcastState();
    this.notifyListeners();

    hostLog.info('Roles assigned');
  }

  /**
   * Host: Start the game (begin first night)
   * Delegates to NightFlowService for night flow management.
   */
  async startGame(): Promise<void> {
    if (!this.isHost || !this.state) return;
    if (this.state.status !== GameStatus.ready) return;

    // Delegate to NightFlowService for night flow initialization and audio
    // NightFlowService.startNight() will:
    //   1. Build night plan and initialize state machine
    //   2. Play night begin audio
    //   3. Play first role's audio
    //   4. Call onRoleTurnStart callback (which broadcasts ROLE_TURN)
    const result = await this.nightFlowService.startNight(this.state.template.roles);
    if (!result.success) {
      hostLog.error('NightFlowService.startNight failed:', result.error);
      throw new Error(`[NightFlow] startGame failed: ${result.error}`);
    }

    // Note: status is already set to ongoing by nightFlowService.startNight()
    // Note: ROLE_TURN broadcast is handled by onRoleTurnStart callback

    await this.broadcastState();
    this.notifyListeners();
  }

  /**
   * Host: Restart game with same template.
   * Clears roles and resets to seated status.
   *
   * @returns true if restart succeeded, false if preconditions not met
   */
  async restartGame(): Promise<boolean> {
    // Preconditions
    if (!this.isHost) {
      hostLog.warn('restartGame: not host');
      return false;
    }

    if (!this.state) {
      hostLog.warn('restartGame: no state');
      return false;
    }

    // Cannot restart if no one is seated
    if (this.state.status === GameStatus.unseated) {
      hostLog.warn('restartGame: cannot restart in unseated status');
      return false;
    }

    // Reset nightFlow via NightFlowService
    this.nightFlowService.reset();

    // Reset state
    this.state.status = GameStatus.seated;
    this.state.actions = new Map();
    this.state.wolfVotes = new Map();
    this.state.currentActionerIndex = 0;
    this.state.isAudioPlaying = false;
    this.state.lastNightDeaths = [];

    // Clear roles but keep players
    this.state.players.forEach((player) => {
      if (player) {
        player.role = null;
        player.hasViewedRole = false;
      }
    });

    await this.broadcastCoordinator.broadcastGameRestarted();
    await this.broadcastState();
    this.notifyListeners();

    hostLog.info('Game restarted');
    return true;
  }

  /**
   * Host: Update template (before game starts)
   * Can only be done in unseated or seated status
   */
  async updateTemplate(newTemplate: GameTemplate): Promise<void> {
    if (!this.isHost || !this.state) return;

    // Only allow template changes before game starts
    if (this.state.status !== GameStatus.unseated && this.state.status !== GameStatus.seated) {
      hostLog.warn('Cannot update template after game starts');
      return;
    }

    // Host-side defensive validation: reject clearly invalid templates
    const validationError = validateTemplateRoles(newTemplate.roles);
    if (validationError) {
      hostLog.warn('updateTemplate rejected: invalid roles -', validationError);
      return;
    }

    // Update template
    this.state.template = newTemplate;

    // Reset players map to match new template size
    const oldPlayers = this.state.players;
    this.state.players = new Map();
    for (let i = 0; i < newTemplate.numberOfPlayers; i++) {
      // Keep existing players if seat still exists
      const existingPlayer = oldPlayers.get(i);
      this.state.players.set(i, existingPlayer ?? null);
    }

    // Recalculate status based on seating
    const allSeated = Array.from(this.state.players.values()).every((p) => p !== null);
    this.state.status = allSeated ? GameStatus.seated : GameStatus.unseated;

    await this.broadcastState();
    this.notifyListeners();

    hostLog.info('Template updated:', newTemplate.name);
  }

  // ===========================================================================
  // Host: Night Phase Control
  // ===========================================================================

  private getCurrentActionRole(): RoleId | null {
    if (!this.state) return null;
    const { currentActionerIndex } = this.state;
    // Phase 5: actionOrder removed from template, derive from NightPlan
    const nightPlan = buildNightPlan(this.state.template.roles);
    if (currentActionerIndex >= nightPlan.steps.length) return null;
    return nightPlan.steps[currentActionerIndex].roleId;
  }

  /**
   * Handle role turn start callback from NightFlowService
   *
   * This is called by NightFlowService.playCurrentRoleAudio after audio finishes.
   * Responsibilities:
   * - Set role-specific context (witchContext, confirmStatus, etc.)
   * - Broadcast ROLE_TURN
   * - Update UI state
   *
   * @param role - The role whose turn is starting
   * @param pendingSeats - Seats that need to act
   * @param stepId - The schema step ID for UI
   */
  private async handleRoleTurnStart(
    role: RoleId,
    pendingSeats: number[],
    stepId?: SchemaId,
  ): Promise<void> {
    if (!this.isHost || !this.state) return;

    // For witch, set killedIndex in state (UI filters by myRole)
    // Exception: if witch is blocked by nightmare, don't set witchContext
    if (role === 'witch') {
      const witchSeat = this.findSeatByRole('witch');
      const nightmareAction = this.state.actions.get('nightmare');
      const isWitchBlocked =
        nightmareAction?.kind === 'target' && nightmareAction.targetSeat === witchSeat;

      if (isWitchBlocked) {
        hostLog.info('Witch is blocked by nightmare, not setting witchContext');
      } else {
        const wolfAction = this.state.actions.get('wolf');
        const killedIndex = getActionTargetSeat(wolfAction) ?? -1;
        this.setWitchContext(killedIndex);
      }
    }

    // For hunter/darkWolfKing, set canShoot status in state
    if (role === 'hunter' || role === 'darkWolfKing') {
      this.setConfirmStatus(role);
    }

    // Broadcast role turn (PUBLIC)
    await this.broadcastCoordinator.broadcastRoleTurn(role, pendingSeats, { stepId });

    // Update currentStepId for Host UI (NightProgressIndicator)
    if (stepId) {
      this.state.currentStepId = stepId;
    }

    await this.broadcastState();
    this.notifyListeners();
  }

  private async advanceToNextAction(): Promise<void> {
    if (!this.isHost || !this.state) return;

    // STRICT INVARIANT: nightFlow must exist when status === ongoing
    // Only enforce this invariant during active night phase
    if (this.state.status === GameStatus.ongoing && !this.nightFlowService.isActive()) {
      hostLog.error(
        '[GameStateService] STRICT INVARIANT VIOLATION: advanceToNextAction() called but nightFlow is null.',
        'status:',
        this.state.status,
      );
      throw new Error('advanceToNextAction: nightFlow is null - strict invariant violation');
    }

    // If not ongoing (e.g., ended, ready), just return silently - not an error
    if (!this.nightFlowService.isActive()) {
      return;
    }

    // Delegate to NightFlowService
    // NightFlowService.advanceToNextAction() will:
    //   1. Play role ending audio
    //   2. Dispatch RoleEndAudioDone event
    //   3. Clear wolf votes internally (we also clear locally)
    //   4. Play next role's audio (or call onNightEnd callback)
    //   5. Call onRoleTurnStart callback (which broadcasts ROLE_TURN)
    await this.nightFlowService.advanceToNextAction();

    // Clear wolf votes for next role (local state)
    this.state.wolfVotes = new Map();

    // Note: ROLE_TURN broadcast is handled by onRoleTurnStart callback
    // Note: night end is handled by onNightEnd callback
  }

  private async endNight(): Promise<void> {
    if (!this.isHost || !this.state) return;

    // STRICT INVARIANT: nightFlow must exist when status === ongoing
    // Only enforce this invariant during active night phase
    if (this.state.status === GameStatus.ongoing && !this.nightFlowService.isActive()) {
      hostLog.error(
        '[GameStateService] STRICT INVARIANT VIOLATION: endNight() called but nightFlow is null.',
        'status:',
        this.state.status,
      );
      throw new Error('endNight: nightFlow is null - strict invariant violation');
    }

    // If not ongoing (e.g., ended, ready), just return silently - not an error
    if (!this.nightFlowService.isActive()) {
      return;
    }

    // Play night end audio
    hostLog.info('Playing night end audio...');
    await this.audioService.playNightEndAudio();

    // [Bridge: NightFlowController] Dispatch NightEndAudioDone to complete state machine
    // STRICT: Only dispatch if nightFlow is in NightEndAudio phase
    // If phase mismatch, this is a duplicate/stale callback - STRICT no-op (no death calc, no broadcast)
    if (this.nightFlowService.getCurrentPhase() === NightPhase.NightEndAudio) {
      this.nightFlowService.dispatchEvent(NightEvent.NightEndAudioDone);
    } else {
      // Phase mismatch - duplicate/stale callback
      // STRICT: Do NOT proceed to death calculation - that would be越权推进
      // NightFlowController hasn't ended, so GameStateService must not end either
      hostLog.debug(
        '[GameStateService] endNight() ignored (strict no-op): phase is',
        this.nightFlowService.getCurrentPhase(),
        '- not NightEndAudio. No death calc, no status change.',
      );
      return; // STRICT: early return, no side effects
    }

    // [Bridge: DeathCalculator] Calculate deaths via extracted pure function
    const deaths = this.doCalculateDeaths();
    this.state.lastNightDeaths = deaths;
    this.state.status = GameStatus.ended;

    // Broadcast night end
    await this.broadcastCoordinator.broadcastNightEnd(deaths);

    await this.broadcastState();
    this.notifyListeners();

    hostLog.info('Night ended. Deaths:', deaths);
  }

  // ===========================================================================
  // Player: Actions
  // ===========================================================================

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Take a seat with ACK (unified path)
   * Delegated to SeatManager (Phase 8 migration)
   */
  async takeSeatWithAck(
    seat: number,
    displayName?: string,
    avatarUrl?: string,
    timeoutMs: number = 5000,
  ): Promise<{ success: boolean; reason?: string }> {
    return this.seatManager.takeSeatWithAck(seat, displayName, avatarUrl, timeoutMs);
  }

  /**
   * Leave seat with ACK (unified path)
   * Delegated to SeatManager (Phase 8 migration)
   */
  async leaveSeatWithAck(timeoutMs: number = 5000): Promise<{ success: boolean; reason?: string }> {
    return this.seatManager.leaveSeatWithAck(timeoutMs);
  }

  // NOTE: sendSeatActionWithAck removed - delegated to SeatManager (Phase 8)

  /**
   * Player: Request full state snapshot from Host (for recovery)
   * Returns true if request was sent, false if failed
   * Timeout after 10s will mark connection as disconnected
   */
  async requestSnapshot(timeoutMs: number = 10000): Promise<boolean> {
    if (this.isHost) {
      // Host is authoritative, no need to request
      return true;
    }

    if (!this.myUid) return false;

    // Cancel any pending snapshot request
    if (this.pendingSnapshotRequest) {
      clearTimeout(this.pendingSnapshotRequest.timeoutHandle);
      this.pendingSnapshotRequest = null;
    }

    // Mark as syncing
    this.broadcastCoordinator.markAsSyncing();

    const requestId = this.generateRequestId();

    playerLog.info(` Requesting snapshot, lastRev: ${this.stateRevision}`);

    // Set up timeout
    const timeoutHandle = setTimeout(() => {
      if (this.pendingSnapshotRequest?.requestId === requestId) {
        playerLog.info(` Snapshot request timeout`);
        this.pendingSnapshotRequest = null;
        // Mark as disconnected on timeout
        this.broadcastCoordinator.setConnectionStatus('disconnected');
        this.notifyListeners();
      }
    }, timeoutMs);

    // Store pending request
    this.pendingSnapshotRequest = {
      requestId,
      timestamp: Date.now(),
      timeoutHandle,
    };

    try {
      await this.broadcastCoordinator.requestSnapshot(requestId, this.myUid, this.stateRevision);
    } catch (err) {
      // sendToHost failed - rollback pending state immediately
      if (this.pendingSnapshotRequest?.requestId === requestId) {
        playerLog.info(` Snapshot request send failed:`, err);
        clearTimeout(this.pendingSnapshotRequest.timeoutHandle);
        this.pendingSnapshotRequest = null;
        this.broadcastCoordinator.setConnectionStatus('disconnected');
        this.notifyListeners();
      }
      return false;
    }

    // Response will be handled by handleSnapshotResponse
    // Timeout will mark as disconnected if no response
    return true;
  }

  /**
   * Get current state revision
   */
  getStateRevision(): number {
    return this.stateRevision;
  }

  /**
   * Player: Mark role as viewed
   * Unified path: Both Host and Player call the same handler
   */
  async playerViewedRole(): Promise<void> {
    if (this.mySeatNumber === null) return;

    if (this.isHost) {
      // Host processes directly (same logic as handlePlayerViewedRole)
      await this.handlePlayerViewedRole(this.mySeatNumber);
      return;
    }

    await this.broadcastCoordinator.sendViewedRole(this.mySeatNumber);
  }

  /**
   * Submit action (unified path for Host and Player)
   * Both call the same handler: handlePlayerAction
   */
  async submitAction(target: number | null, extra?: any): Promise<void> {
    if (this.mySeatNumber === null || !this.state) return;

    const myRole = this.getMyRole();
    if (!myRole) return;

    if (this.isHost) {
      await this.handlePlayerAction(this.mySeatNumber, myRole, target, extra);
      return;
    }

    await this.broadcastCoordinator.sendAction(this.mySeatNumber, myRole, target, extra);
  }

  /**
   * Submit wolf vote (unified path for Host and Player)
   * Both call the same handler: handleWolfVote
   */
  async submitWolfVote(target: number): Promise<void> {
    if (this.mySeatNumber === null) return;

    if (this.isHost) {
      await this.handleWolfVote(this.mySeatNumber, target);
      return;
    }

    await this.broadcastCoordinator.sendWolfVote(this.mySeatNumber, target);
  }

  /**
   * Submit reveal acknowledgement (unified path for Host and Player)
   * Both call the same handler: handleRevealAck
   * This lets the Host advance the night flow for reveal roles (seer/psychic/gargoyle/wolfRobot)
   */
  async submitRevealAck(role: RoleId): Promise<void> {
    if (!this.state || this.mySeatNumber === null) return;

    if (this.isHost) {
      await this.handleRevealAck(this.mySeatNumber, role, this.stateRevision);
      return;
    }

    await this.broadcastCoordinator.sendRevealAck(this.mySeatNumber, role, this.stateRevision);
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  private getSeatsForRole(role: RoleId): number[] {
    if (!this.state) return [];

    const seats: number[] = [];
    this.state.players.forEach((player, seat) => {
      if (player?.role === role) {
        seats.push(seat);
      }
      // For wolf role, include all wolves
      if (role === 'wolf' && player?.role && isWolfRole(player.role)) {
        if (!seats.includes(seat)) {
          seats.push(seat);
        }
      }
    });
    return seats.sort((a, b) => a - b);
  }

  /**
   * Get wolf seats that participate in wolf vote (excludes gargoyle, wolfRobot, etc.)
   */
  private getVotingWolfSeats(): number[] {
    if (!this.state) return [];

    const seats: number[] = [];
    this.state.players.forEach((player, seat) => {
      if (player?.role && doesRoleParticipateInWolfVote(player.role)) {
        seats.push(seat);
      }
    });
    return seats.sort((a, b) => a - b);
  }

  /**
   * Get the UID of a player with a specific role.
   * Returns null if role not found in this game.
   */
  private getPlayerUidByRole(role: RoleId): string | null {
    if (!this.state) return null;
    for (const [, player] of this.state.players) {
      if (player?.role === role) {
        return player.uid;
      }
    }
    return null;
  }

  // ===========================================================================
  // Role-specific Context Setters (was PRIVATE_EFFECT, now direct state)
  // All data is set in this.state and broadcast publicly via STATE_UPDATE.
  // UI filters what to display based on myRole.
  // ===========================================================================

  /**
   * Set witch context in state (called when witch turn starts).
   * Contains: killedIndex, canSave, canPoison.
   */
  private setWitchContext(killedIndex: number): void {
    if (!this.state) {
      hostLog.warn('setWitchContext: no state');
      return;
    }

    const witchSeat = this.findSeatByRole('witch');
    // canSave: Host determines if witch can save (not self, has antidote)
    // Night-1-only: witch always has antidote, and self-save is not allowed per schema constraints
    const canSave = killedIndex !== -1 && killedIndex !== witchSeat;

    this.state.witchContext = {
      killedIndex,
      canSave,
      canPoison: true, // Night-1: always has poison
    };

    hostLog.info('Set witchContext:', 'killedIndex:', killedIndex, 'canSave:', canSave);
  }

  /**
   * Set confirm status in state (called when hunter/darkWolfKing confirm turn starts).
   * Tells them if they can use their skill (not poisoned by witch).
   */
  private setConfirmStatus(role: 'hunter' | 'darkWolfKing'): void {
    if (!this.state) {
      hostLog.warn(`setConfirmStatus: ${role} - no state`);
      return;
    }

    // Use the same logic as getConfirmRoleCanShoot
    const canShoot = getConfirmRoleCanShoot(this.state, role);

    this.state.confirmStatus = {
      role,
      canShoot,
    };

    hostLog.info(`Set confirmStatus for ${role}: canShoot=${canShoot}`);
  }

  // NOTE: setSeerReveal, setPsychicReveal, setGargoyleReveal, setWolfRobotReveal
  // have been removed. Reveal logic is now handled by invokeResolver + applyRevealFromResolver.

  /**
   * Clear role-specific reveal state (called when advancing to next turn).
   * Keeps witchContext and confirmStatus which persist during multi-step turns.
   */
  private clearRevealState(): void {
    if (!this.state) return;
    this.state.seerReveal = undefined;
    this.state.psychicReveal = undefined;
    this.state.gargoyleReveal = undefined;
    this.state.wolfRobotReveal = undefined;
    this.state.actionRejected = undefined;
  }

  // ===========================================================================
  // Death Calculation Bridge (DeathCalculator)
  // ===========================================================================

  /**
   * Build RoleSeatMap for death calculation context
   */
  private buildRoleSeatMap(): RoleSeatMap {
    return {
      witcher: this.findSeatByRole('witcher'),
      wolfQueen: this.findSeatByRole('wolfQueen'),
      dreamcatcher: this.findSeatByRole('dreamcatcher'),
      spiritKnight: this.findSeatByRole('spiritKnight'),
      seer: this.findSeatByRole('seer'),
      witch: this.findSeatByRole('witch'),
      guard: this.findSeatByRole('guard'),
    };
  }

  /**
   * Build a seat -> roleId map for resolver context.
   * Used for identity checks (seer, psychic, gargoyle).
   */
  private buildRoleMap(): ReadonlyMap<number, RoleId> {
    if (!this.state) return new Map();

    const roleMap = new Map<number, RoleId>();
    for (const [seat, player] of this.state.players) {
      if (player?.role && isValidRoleId(player.role)) {
        roleMap.set(seat, player.role);
      }
    }
    return roleMap;
  }

  /**
   * Get magician swapped seats from current night actions.
   * Returns undefined if no swap happened.
   */
  private getMagicianSwappedSeats(): readonly [number, number] | undefined {
    if (!this.state) return undefined;

    const magicianAction = this.state.actions.get('magician');
    if (magicianAction?.kind === 'magicianSwap') {
      return [magicianAction.firstSeat, magicianAction.secondSeat];
    }
    return undefined;
  }

  // ===========================================================================
  // Resolver Integration (Phase 1: Infrastructure)
  // Delegated to ActionProcessor module.
  // ===========================================================================

  /**
   * Get current step's schemaId from nightFlow.
   */
  private getCurrentSchemaId(): SchemaId | null {
    if (!this.nightFlowService.isActive() || !this.state) return null;
    const nightPlan = buildNightPlan(this.state.template.roles);
    const nightFlow = this.nightFlowService.getNightFlow();
    const step = nightPlan.steps[nightFlow?.currentActionIndex ?? 0];
    return step?.stepId ?? null;
  }

  /**
   * Build ActionContext for ActionProcessor.
   */
  private buildActionContext(): import('./action').ActionContext {
    if (!this.state) {
      // Return minimal context if no state
      return {
        players: new Map(),
        currentNightResults: {},
        actions: new Map(),
        wolfVotes: new Map(),
      };
    }
    return {
      players: this.buildRoleMap(),
      currentNightResults: (this.state.currentNightResults ?? {}) as Record<string, unknown>,
      witchContext: this.state.witchContext,
      actions: this.state.actions,
      wolfVotes: this.state.wolfVotes,
    };
  }

  /**
   * Invoke a resolver for the given schemaId.
   * Delegates to ActionProcessor.
   */
  private invokeResolver(
    schemaId: SchemaId,
    actorSeat: number,
    actorRoleId: RoleId,
    input: ActionInput,
  ): ResolverResult {
    const context = this.buildActionContext();
    return this.actionProcessor.invokeResolver(schemaId, actorSeat, actorRoleId, input, context);
  }

  /**
   * Build ActionInput from wire protocol.
   * Delegates to ActionProcessor.
   */
  private buildActionInput(
    schemaId: SchemaId,
    target: number | null,
    extra?: unknown,
  ): ActionInput {
    return this.actionProcessor.buildActionInput(schemaId, target, extra);
  }

  /**
   * Apply resolver result to state.
   * Merges updates into currentNightResults and sets reveal results.
   *
   * @param role - The role performing the action
   * @param target - The target seat (for reveal results)
   * @param result - The resolver result
   */
  private applyResolverResult(role: RoleId, target: number | null, result: ResolverResult): void {
    if (!this.state) return;

    // 1. Merge updates into currentNightResults
    if (result.updates) {
      this.state.currentNightResults = {
        ...this.state.currentNightResults,
        ...result.updates,
      };

      // Sync fields that need to be broadcast
      if (result.updates.blockedSeat !== undefined) {
        this.state.nightmareBlockedSeat = result.updates.blockedSeat;
      }
      if (result.updates.wolfKillDisabled !== undefined) {
        this.state.wolfKillDisabled = result.updates.wolfKillDisabled;
      }
    }

    // 2. Apply reveal results (from resolver, not re-computed)
    if (result.result && target !== null) {
      this.applyRevealFromResolver(role, target, result.result);
    }
  }

  /**
   * Apply reveal result from ActionProcessor.processAction result.
   * Maps the simplified reveal type to the appropriate state field.
   */
  private applyRevealFromProcessResult(reveal: {
    type: 'seer' | 'psychic' | 'gargoyle' | 'wolfRobot';
    targetSeat: number;
    result: string;
  }): void {
    if (!this.state) return;

    switch (reveal.type) {
      case 'seer':
        this.state.seerReveal = {
          targetSeat: reveal.targetSeat,
          result: reveal.result as '好人' | '狼人',
        };
        break;
      case 'psychic':
        this.state.psychicReveal = {
          targetSeat: reveal.targetSeat,
          result: reveal.result,
        };
        break;
      case 'gargoyle':
        this.state.gargoyleReveal = {
          targetSeat: reveal.targetSeat,
          result: reveal.result,
        };
        break;
      case 'wolfRobot':
        this.state.wolfRobotReveal = {
          targetSeat: reveal.targetSeat,
          result: reveal.result,
        };
        break;
    }
    hostLog.info(`Set ${reveal.type}Reveal from processAction:`, reveal.targetSeat, reveal.result);
  }

  /**
   * Apply reveal result from resolver to state.
   * This replaces the old setSeerReveal/setPsychicReveal/etc methods.
   */
  private applyRevealFromResolver(
    role: RoleId,
    target: number,
    resolverResult: NonNullable<ResolverResult['result']>,
  ): void {
    if (!this.state) return;

    // Seer: faction check result
    if (resolverResult.checkResult) {
      this.state.seerReveal = {
        targetSeat: target,
        result: resolverResult.checkResult,
      };
      hostLog.info('Set seerReveal from resolver:', target, resolverResult.checkResult);
    }

    // Psychic/Gargoyle/WolfRobot: identity result
    if (resolverResult.identityResult) {
      const displayName = ROLE_SPECS[resolverResult.identityResult].displayName;

      if (role === 'psychic') {
        this.state.psychicReveal = { targetSeat: target, result: displayName };
      } else if (role === 'gargoyle') {
        this.state.gargoyleReveal = { targetSeat: target, result: displayName };
      } else if (role === 'wolfRobot') {
        this.state.wolfRobotReveal = { targetSeat: target, result: displayName };
      }

      hostLog.info(`Set ${role}Reveal from resolver:`, target, displayName);
    }
  }

  /**
   * Calculate deaths using DeathCalculator
   */
  private doCalculateDeaths(): number[] {
    if (!this.state) return [];

    const nightActions = this.actionProcessor.buildNightActions(
      this.state.actions,
      this.state.players,
    );
    const roleSeatMap = this.buildRoleSeatMap();

    // [Bridge: DeathCalculator] Invoke extracted pure function
    return calculateDeaths(nightActions, roleSeatMap);
  }

  private findSeatByRole(role: RoleId): number {
    if (!this.state) return -1;

    for (const [seat, player] of this.state.players) {
      if (player?.role === role) return seat;
    }
    return -1;
  }

  /**
   * Get last night info string (deaths only)
   */
  getLastNightInfo(): string {
    if (!this.state) return '';

    const deaths = this.state.lastNightDeaths;
    if (deaths.length === 0) {
      return '昨天晚上是平安夜。';
    }

    const deathNumbers = deaths.map((d) => `${d + 1}号`).join(', ');
    return `昨天晚上${deathNumbers}玩家死亡。`;
  }

  private async broadcastState(): Promise<void> {
    if (!this.isHost || !this.state) return;

    // Increment revision on each broadcast
    this.stateRevision++;

    const broadcastState = this.toBroadcastState();

    // Sync computed fields to Host's local state so Host UI sees them too.
    // These values are computed in toBroadcastState() for broadcast, but Host reads this.state directly.
    // Without this sync, Host UI would see undefined for these fields.
    if (
      this.state.nightmareBlockedSeat !== broadcastState.nightmareBlockedSeat ||
      this.state.wolfKillDisabled !== broadcastState.wolfKillDisabled
    ) {
      this.state = {
        ...this.state,
        nightmareBlockedSeat: broadcastState.nightmareBlockedSeat,
        wolfKillDisabled: broadcastState.wolfKillDisabled,
      };
    }

    // Always notify listeners so Host UI sees updated state (seerReveal, etc.)
    this.notifyListeners();

    await this.broadcastCoordinator.broadcastState(broadcastState, this.stateRevision);

    // Persist state to storage for recovery
    // (async, non-blocking - don't await)
    if (this.isHost && this.state) {
      this.statePersistence
        .saveState(this.state.roomCode, this.state)
        .catch((err) => hostLog.error('Failed to save state after broadcast:', err));
    }
  }

  private toBroadcastState(): BroadcastGameState {
    if (!this.state) throw new Error('No state');

    const players: Record<number, BroadcastPlayer | null> = {};
    this.state.players.forEach((p, seat) => {
      if (p) {
        // Only include role for the player themselves
        // Wolves can see each other (handled on client side)
        players[seat] = {
          uid: p.uid,
          seatNumber: p.seatNumber,
          displayName: p.displayName,
          avatarUrl: p.avatarUrl,
          role: p.role, // Include role - client decides what to show
          hasViewedRole: p.hasViewedRole,
        };
      } else {
        players[seat] = null;
      }
    });

    // Wolf vote status (only wolves that participate in vote)
    const wolfVoteStatus: Record<number, boolean> = {};
    this.getVotingWolfSeats().forEach((seat) => {
      wolfVoteStatus[seat] = this.state!.wolfVotes.has(seat);
    });

    // Get nightmare blocked seat from actions
    const nightmareAction = this.state.actions.get('nightmare');
    const nightmareBlockedSeat =
      nightmareAction?.kind === 'target' ? nightmareAction.targetSeat : undefined;

    // wolfKillDisabled is single-source-of-truth from this.state (set by handlePlayerAction)

    return {
      roomCode: this.state.roomCode,
      hostUid: this.state.hostUid,
      status: this.state.status,
      templateRoles: this.state.template.roles,
      players,
      currentActionerIndex: this.state.currentActionerIndex,
      isAudioPlaying: this.state.isAudioPlaying,
      wolfVoteStatus,
      nightmareBlockedSeat,
      wolfKillDisabled: this.state.wolfKillDisabled,
      // Role-specific context (all data is public, UI filters by myRole)
      witchContext: this.state.witchContext,
      seerReveal: this.state.seerReveal,
      psychicReveal: this.state.psychicReveal,
      gargoyleReveal: this.state.gargoyleReveal,
      wolfRobotReveal: this.state.wolfRobotReveal,
      confirmStatus: this.state.confirmStatus,
      actionRejected: this.state.actionRejected,
    };
  }
}

export default GameStateService;
