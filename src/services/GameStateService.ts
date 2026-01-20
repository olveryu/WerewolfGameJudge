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

import { RoleId, isWolfRole } from '../models/roles';
import { GameTemplate, validateTemplateRoles } from '../models/Template';
import { getConfirmRoleCanShoot } from '../models/Room';
import {
  HostBroadcast,
  PlayerMessage,
} from './BroadcastService';
import AudioService from './AudioService';
import { NightPhase, NightEvent, InvalidNightTransitionError } from './NightFlowController';
import { shuffleArray } from '../utils/shuffle';
import { hostLog, playerLog } from '../utils/logger';
import { calculateDeaths, type RoleSeatMap } from './DeathCalculator';
import { makeActionTarget, getActionTargetSeat } from '../models/actions';
import { type SchemaId, BLOCKED_UI_DEFAULTS } from '../models/roles/spec';
import { StateManager } from './state';
import { StatePersistence } from './persistence';
import { BroadcastCoordinator } from './broadcast';
import { SeatManager } from './seat';
import { ActionProcessor } from './action';
import { NightFlowService } from './night';
import { HostCoordinator } from './host';
import { PlayerCoordinator } from './player';

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

  /**
   * State access via getter - delegates to StateManager (single source of truth).
   * This ensures all state reads go through StateManager, enabling immutable updates.
   */
  private get state(): LocalGameState | null {
    return this.stateManager.getState();
  }

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

  /**
   * HostCoordinator: Host-only game logic coordinator (Phase 8a extraction)
   * Handles player messages, game flow, and night phase control.
   * ⏳ Phase 8c: Pending integration - currently unused.
   */
  private readonly hostCoordinator: HostCoordinator;

  /**
   * PlayerCoordinator: Player-only game logic coordinator (Phase 8b extraction)
   * Handles host broadcasts, player actions, and state sync.
   * ⏳ Phase 8c: Pending integration - currently unused.
   */
  private readonly playerCoordinator: PlayerCoordinator;

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
      toBroadcastState: () => (this.state ? this.stateManager.toBroadcastState() : null),
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
      // StateManager callbacks for seat operations
      setSeatPlayer: (seat, player) => this.stateManager.setSeatPlayer(seat, player),
      clearSeat: (seat) => this.stateManager.clearSeat(seat),
      clearSeatsByUid: (uid, skipSeat) => this.stateManager.clearSeatsByUid(uid, skipSeat),
      updateSeatStatus: () => this.stateManager.updateSeatStatus(),
    });

    // Initialize NightFlowService with config callbacks
    this.nightFlowService = new NightFlowService({
      getState: () => this.state,
      updateState: (updates) => {
        this.stateManager.batchUpdate(updates);
      },
      getSeatsForRole: (role) => this.stateManager.getSeatsForRole(role),
      // Callback: NightFlowService notifies us when a role's turn starts
      onRoleTurnStart: async (role, pendingSeats, stepId) => {
        await this.handleRoleTurnStart(role, pendingSeats, stepId);
      },
      // Callback: NightFlowService notifies us when night ends
      onNightEnd: async () => {
        await this.endNight();
      },
    });

    // Initialize HostCoordinator (Phase 8a - pending integration)
    this.hostCoordinator = new HostCoordinator({
      stateManager: this.stateManager,
      statePersistence: this.statePersistence,
      broadcastCoordinator: this.broadcastCoordinator,
      seatManager: this.seatManager,
      actionProcessor: this.actionProcessor,
      nightFlowService: this.nightFlowService,
      audioService: this.audioService,
      getState: () => this.state,
      getStateRevision: () => this.stateRevision,
      setStateRevision: (rev) => {
        this.stateRevision = rev;
      },
      incrementStateRevision: () => ++this.stateRevision,
      setIsHost: (isHost) => {
        this.isHost = isHost;
      },
      setMyUid: (uid) => {
        this.myUid = uid;
      },
      setMySeatNumber: (seat) => {
        this.mySeatNumber = seat;
      },
      getMySeatNumber: () => this.mySeatNumber,
      notifyListeners: () => this.notifyListeners(),
    });

    // Initialize PlayerCoordinator (Phase 8b - pending integration)
    this.playerCoordinator = new PlayerCoordinator(
      this.stateManager,
      this.broadcastCoordinator,
      this.seatManager,
      {
        getState: () => this.state,
        getMyUid: () => this.myUid,
        getMySeatNumber: () => this.mySeatNumber,
        getMyRole: () => this.getMyRole(),
        getStateRevision: () => this.stateRevision,
        setStateRevision: (rev) => {
          this.stateRevision = rev;
        },
        setMySeatNumber: (seat) => {
          this.mySeatNumber = seat;
        },
        isHost: () => this.isHost,
        onNotifyListeners: () => this.notifyListeners(),
        // Host-side callbacks for when player IS the host
        onPlayerViewedRole: async (seat) => this.handlePlayerViewedRole(seat),
        onPlayerAction: async (seat, role, target, extra) =>
          this.handlePlayerAction(seat, role, target, extra),
        onWolfVote: async (seat, target) => this.handleWolfVote(seat, target),
        onRevealAck: async (seat, role, revision) =>
          this.handleRevealAck(seat, role, revision),
      },
    );
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
  // Test Hooks (ONLY for unit tests - do not use in production code)
  // ===========================================================================

  /**
   * @internal Test hook: Access StateManager for test setup
   * Do NOT use in production code - use proper public APIs instead.
   */
  __testGetStateManager(): StateManager {
    return this.stateManager;
  }

  /**
   * @internal Test hook: Access NightFlowService for test assertions
   * Do NOT use in production code - use proper public APIs instead.
   */
  __testGetNightFlowService(): NightFlowService {
    return this.nightFlowService;
  }

  /**
   * @internal Test hook: Access SeatManager for test setup
   * Do NOT use in production code - use proper public APIs instead.
   */
  __testGetSeatManager(): SeatManager {
    return this.seatManager;
  }

  /**
   * @internal Test hook: Calculate deaths for test verification
   * Do NOT use in production code - night end logic handles this internally.
   */
  __testCalculateDeaths(): number[] {
    return this.doCalculateDeaths();
  }

  // ===========================================================================
  // State Listeners (delegated to StateManager)
  // ===========================================================================

  addListener(listener: GameStateListener): () => void {
    // Now that this.state is a getter delegating to StateManager,
    // we can directly use StateManager's subscription
    return this.stateManager.subscribe(listener);
  }

  private notifyListeners(): void {
    // StateManager is the single source of truth.
    // Just trigger notification - no sync needed since this.state is a getter.
    this.stateManager.notifyListeners();
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

    // Initialize state via StateManager (single source of truth)
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
      // Recovered! Use saved state via StateManager
      this.stateManager.initialize(savedState);

      // Restore mySeatNumber if host was seated
      for (const [seatNum, player] of savedState.players.entries()) {
        if (player?.uid === hostUid) {
          this.mySeatNumber = seatNum;
          break;
        }
      }

      hostLog.info('Host state recovered from storage for room:', roomCode);
    } else {
      // No saved state - create placeholder via StateManager
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
    this.stateManager.reset();
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

    const broadcastState = this.stateManager.toBroadcastState();
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

  /**
   * Check if player is blocked by nightmare.
   * Returns 'blocked' if action should be rejected, 'allowed' otherwise.
   */
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

    // Blocked player can only skip (target=null, extra=undefined)
    if (target === null && extra === undefined) {
      return 'allowed';
    }

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

  /**
   * Reject an action and broadcast the rejection to the player.
   * @returns true if rejection was broadcast, false if no playerUid
   */
  private async rejectAction(
    seat: number,
    action: 'submitAction' | 'submitWolfVote',
    reason: string,
  ): Promise<boolean> {
    const playerUid = this.state?.players.get(seat)?.uid;
    if (!playerUid) return false;

    this.stateManager.batchUpdate({
      actionRejected: {
        action,
        reason,
        targetUid: playerUid,
      },
    });
    await this.broadcastState();
    return true;
  }

  /**
   * Apply valid action result to state and record the action.
   * Extracts the common logic from handlePlayerAction.
   */
  private applyActionResult(
    role: RoleId,
    target: number | null,
    result: { updates?: Record<string, unknown>; reveal?: any; actionToRecord?: any },
  ): void {
    // Apply updates to currentNightResults via StateManager
    if (result.updates) {
      this.stateManager.applyNightResultUpdates(result.updates);
    }

    // Apply reveal result
    if (result.reveal && target !== null) {
      this.stateManager.applyReveal(result.reveal);
    }

    // Record action using actionToRecord from processor
    if (result.actionToRecord && target !== null) {
      this.stateManager.recordAction(role, result.actionToRecord);

      // Record action in nightFlow (raw target only for logging/debug)
      try {
        this.nightFlowService.recordAction(role, target);
      } catch (err) {
        hostLog.error('NightFlow recordAction failed:', err);
        throw err; // STRICT: propagate error, don't continue
      }
    }
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
    const currentRole = this.nightFlowService.getCurrentActionRole();
    if (currentRole !== role) {
      hostLog.info('Wrong role acting:', role, 'expected:', currentRole);
      return;
    }

    // NightFlow guard: only allow action in WaitingForAction phase and matching role
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

    // Check nightmare block - only skip action allowed for blocked players
    const blockResult = await this.checkNightmareBlock(seat, role, target, extra);
    if (blockResult === 'blocked') return;

    // =========================================================================
    // Action Processing via ActionProcessor
    // =========================================================================
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
    await this.dispatchActionSubmittedAndAdvance();
  }

  /**
   * Dispatch ActionSubmitted event and advance to next action.
   * Common logic for completing an action.
   */
  private async dispatchActionSubmittedAndAdvance(): Promise<void> {
    try {
      this.nightFlowService.dispatchEvent(NightEvent.ActionSubmitted);
    } catch (err) {
      if (err instanceof InvalidNightTransitionError) {
        hostLog.error('NightFlow ActionSubmitted failed:', err.message);
        throw err; // STRICT: propagate error
      }
      throw err;
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

    const currentRole = this.nightFlowService.getCurrentActionRole();
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

    // Validate target via ActionProcessor
    const context = this.buildActionContext();
    const validation = this.actionProcessor.validateWolfVote(target, context);

    if (!validation.valid) {
      await this.rejectAction(seat, 'submitWolfVote', validation.rejectReason ?? '无效目标');
      return;
    }

    // Record vote via StateManager
    this.stateManager.recordWolfVote(seat, target);

    // Check if all voting wolves have voted (excludes gargoyle, wolfRobot, etc.)
    const allVotingWolfSeats = this.stateManager.getVotingWolfSeats();
    const allVoted = allVotingWolfSeats.every((s) => this.state!.wolfVotes.has(s));

    if (allVoted) {
      await this.finalizeWolfVote();
    } else {
      // Broadcast vote status update
      await this.broadcastState();
      this.notifyListeners();
    }
  }

  /**
   * Finalize wolf vote when all wolves have voted.
   * Resolves the final target and advances to next action.
   */
  private async finalizeWolfVote(): Promise<void> {
    if (!this.state) return;

    // ONCE-GUARD: If wolf action already recorded, this is a duplicate finalize - skip
    if (this.stateManager.hasAction('wolf')) {
      hostLog.debug(
        '[GameStateService] handleWolfVote finalize skipped (once-guard): wolf action already recorded.',
        'phase:',
        this.nightFlowService.getCurrentPhase(),
        'currentActionerIndex:',
        this.state.currentActionerIndex,
      );
      return;
    }

    // Resolve final kill target via ActionProcessor
    const finalTarget = this.actionProcessor.resolveWolfVotes(this.state.wolfVotes);
    if (finalTarget !== null) {
      this.stateManager.recordAction('wolf', makeActionTarget(finalTarget));
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

    // Dispatch ActionSubmitted and advance
    try {
      this.nightFlowService.dispatchEvent(NightEvent.ActionSubmitted);
    } catch (err) {
      if (err instanceof InvalidNightTransitionError) {
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
  }

  private async handlePlayerViewedRole(seat: number): Promise<void> {
    if (!this.state || this.state.status !== GameStatus.assigned) return;

    const player = this.state.players.get(seat);
    if (!player) return;

    // Use StateManager (single source of truth)
    // markPlayerViewedRole handles setting hasViewedRole and transitioning to 'ready' if all viewed
    this.stateManager.markPlayerViewedRole(seat);

    await this.broadcastState();
    // Note: stateManager.markPlayerViewedRole() already calls notifyListeners()
  }

  // ===========================================================================
  // Player: Handle Host Broadcasts
  // ===========================================================================

  /**
   * Handle incoming host broadcast messages
   * Delegated to PlayerCoordinator (Phase 8c migration)
   */
  private handleHostBroadcast(msg: HostBroadcast): void {
    this.playerCoordinator.handleHostBroadcast(msg);
  }

  // NOTE: handleSeatActionAck removed - delegated to PlayerCoordinator (Phase 8c)
  // NOTE: handleSnapshotResponse removed - delegated to PlayerCoordinator (Phase 8c)
  // NOTE: applyStateUpdate removed - delegated to PlayerCoordinator (Phase 8c)

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

    // Assign via StateManager (single source of truth)
    this.stateManager.assignRolesToPlayers(shuffledRoles);

    await this.broadcastState();
    // Note: stateManager.assignRolesToPlayers() already calls notifyListeners()

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

    // Reset state via StateManager (single source of truth)
    this.stateManager.resetForGameRestart();

    await this.broadcastCoordinator.broadcastGameRestarted();
    await this.broadcastState();
    // Note: stateManager.resetForGameRestart() already calls notifyListeners()

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

    // Use StateManager (single source of truth)
    this.stateManager.updateTemplate(newTemplate);

    await this.broadcastState();
    // Note: stateManager.updateTemplate() already calls notifyListeners()

    hostLog.info('Template updated:', newTemplate.name);
  }

  // ===========================================================================
  // Host: Night Phase Control
  // ===========================================================================

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
      const witchSeat = this.stateManager.findSeatByRole('witch');
      const nightmareAction = this.state.actions.get('nightmare');
      const isWitchBlocked =
        nightmareAction?.kind === 'target' && nightmareAction.targetSeat === witchSeat;

      if (isWitchBlocked) {
        hostLog.info('Witch is blocked by nightmare, not setting witchContext');
      } else {
        const wolfAction = this.state.actions.get('wolf');
        const killedIndex = getActionTargetSeat(wolfAction) ?? -1;
        // Business logic: calculate canSave here (not in StateManager)
        // Night-1-only: witch always has antidote, and self-save is not allowed per schema
        const canSave = killedIndex !== -1 && killedIndex !== witchSeat;
        this.stateManager.setWitchContext({
          killedIndex,
          canSave,
          canPoison: true, // Night-1: always has poison
        });
      }
    }

    // For hunter/darkWolfKing, set canShoot status in state
    if (role === 'hunter' || role === 'darkWolfKing') {
      // Business logic: calculate canShoot here (not in StateManager)
      const canShoot = getConfirmRoleCanShoot(this.state, role);
      this.stateManager.setConfirmStatus({ role, canShoot });
    }

    // Broadcast role turn (PUBLIC)
    await this.broadcastCoordinator.broadcastRoleTurn(role, pendingSeats, { stepId });

    // Update currentStepId for Host UI (NightProgressIndicator)
    if (stepId) {
      this.stateManager.batchUpdate({ currentStepId: stepId });
    }

    await this.broadcastState();
    // Note: batchUpdate already calls notifyListeners()
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

    // Clear wolf votes for next role (local state) via StateManager
    this.stateManager.clearWolfVotes();

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
    this.stateManager.batchUpdate({
      lastNightDeaths: deaths,
      status: GameStatus.ended,
    });

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
   * Delegated to PlayerCoordinator (Phase 8c migration)
   */
  async playerViewedRole(): Promise<void> {
    await this.playerCoordinator.playerViewedRole();
  }

  /**
   * Submit action (unified path for Host and Player)
   * Delegated to PlayerCoordinator (Phase 8c migration)
   */
  async submitAction(target: number | null, extra?: any): Promise<void> {
    await this.playerCoordinator.submitAction(target, extra);
  }

  /**
   * Submit wolf vote (unified path for Host and Player)
   * Delegated to PlayerCoordinator (Phase 8c migration)
   */
  async submitWolfVote(target: number): Promise<void> {
    await this.playerCoordinator.submitWolfVote(target);
  }

  /**
   * Submit reveal acknowledgement (unified path for Host and Player)
   * Delegated to PlayerCoordinator (Phase 8c migration)
   */
  async submitRevealAck(role: RoleId): Promise<void> {
    await this.playerCoordinator.submitRevealAck(role);
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  // ===========================================================================
  // Death Calculation Bridge (DeathCalculator)
  // ===========================================================================

  /**
   * Build RoleSeatMap for death calculation context
   */
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
      players: this.stateManager.buildRoleMap(),
      currentNightResults: (this.state.currentNightResults ?? {}) as Record<string, unknown>,
      witchContext: this.state.witchContext,
      actions: this.state.actions,
      wolfVotes: this.state.wolfVotes,
    };
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

    const broadcastState = this.stateManager.toBroadcastState();

    // Sync computed fields to Host's local state so Host UI sees them too.
    // These values are computed in toBroadcastState() for broadcast, but Host reads this.state directly.
    // Without this sync, Host UI would see undefined for these fields.
    if (
      this.state.nightmareBlockedSeat !== broadcastState.nightmareBlockedSeat ||
      this.state.wolfKillDisabled !== broadcastState.wolfKillDisabled
    ) {
      this.stateManager.batchUpdate({
        nightmareBlockedSeat: broadcastState.nightmareBlockedSeat,
        wolfKillDisabled: broadcastState.wolfKillDisabled,
      });
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
}

export default GameStateService;
