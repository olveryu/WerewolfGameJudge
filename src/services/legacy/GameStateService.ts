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

import { RoleId } from '../../models/roles';
import { GameTemplate } from '../../models/Template';
import {
  HostBroadcast,
  PlayerMessage,
} from './BroadcastService';
import AudioService from './AudioService';
// NightFlowController imports moved to HostCoordinator
import { hostLog } from '../../utils/logger';
// calculateDeaths, RoleSeatMap moved to HostCoordinator (Phase 8c)
// getActionTargetSeat, getConfirmRoleCanShoot, SchemaId moved to HostCoordinator
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

  // NOTE: pendingSnapshotRequest removed - delegated to PlayerCoordinator (Phase 8c)

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
      // Delegated to HostCoordinator (Phase 8c migration)
      onRoleTurnStart: async (role, pendingSeats, stepId) => {
        await this.hostCoordinator.handleRoleTurnStart(role, pendingSeats, stepId);
      },
      // Callback: NightFlowService notifies us when night ends
      // Delegated to HostCoordinator (Phase 8c migration)
      onNightEnd: async () => {
        await this.hostCoordinator.endNight();
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
        // Delegated to HostCoordinator (Phase 8c migration)
        onPlayerViewedRole: async (seat) => this.hostCoordinator.handlePlayerViewedRole(seat),
        onPlayerAction: async (seat, role, target, extra) =>
          this.hostCoordinator.handlePlayerAction(seat, role, target, extra),
        onWolfVote: async (seat, target) => this.hostCoordinator.handleWolfVote(seat, target),
        onRevealAck: async (seat, role, revision) =>
          this.hostCoordinator.handleRevealAck(seat, role, revision),
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
   * @internal Test hook: Access HostCoordinator for test setup
   * Do NOT use in production code - use proper public APIs instead.
   */
  __testGetHostCoordinator(): HostCoordinator {
    return this.hostCoordinator;
  }

  /**
   * @internal Test hook: Calculate deaths for test verification
   * Do NOT use in production code - night end logic handles this internally.
   * Delegates to HostCoordinator's calculateDeaths (private method).
   */
  __testCalculateDeaths(): number[] {
    return (this.hostCoordinator as any).calculateDeaths();
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
  // Delegated to HostCoordinator (Phase 8c migration)
  // ===========================================================================

  private async handlePlayerMessage(msg: PlayerMessage, senderId: string): Promise<void> {
    if (!this.isHost) return;
    return this.hostCoordinator.handlePlayerMessage(msg, senderId);
  }

  // NOTE: handleRevealAck, handleSeatActionRequest, handleSnapshotRequest,
  // handlePlayerJoin, handlePlayerLeave removed - delegated to HostCoordinator (Phase 8c)

  // NOTE: checkNightmareBlock, rejectAction, applyActionResult, handlePlayerAction,
  // dispatchActionSubmittedAndAdvance, handleWolfVote, finalizeWolfVote, handlePlayerViewedRole
  // removed - delegated to HostCoordinator (Phase 8c)

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
   * Delegated to HostCoordinator (Phase 8c migration)
   */
  async assignRoles(): Promise<void> {
    if (!this.isHost) return;
    return this.hostCoordinator.assignRoles();
  }

  /**
   * Host: Start the game (begin first night)
   * Delegated to HostCoordinator (Phase 8c migration)
   */
  async startGame(): Promise<void> {
    if (!this.isHost) return;
    return this.hostCoordinator.startGame();
  }

  /**
   * Host: Restart game with same template.
   * Clears roles and resets to seated status.
   * Delegated to HostCoordinator (Phase 8c migration)
   *
   * @returns true if restart succeeded, false if preconditions not met
   */
  async restartGame(): Promise<boolean> {
    if (!this.isHost) {
      hostLog.warn('restartGame: not host');
      return false;
    }
    return this.hostCoordinator.restartGame();
  }

  /**
   * Host: Update template (before game starts)
   * Delegated to HostCoordinator (Phase 8c migration)
   */
  async updateTemplate(newTemplate: GameTemplate): Promise<void> {
    if (!this.isHost) return;
    return this.hostCoordinator.updateTemplate(newTemplate);
  }

  // ===========================================================================
  // Host: Night Phase Control
  // NOTE: handleRoleTurnStart, advanceToNextAction, endNight
  // removed - delegated to HostCoordinator via NightFlowService callbacks (Phase 8c)
  // ===========================================================================

  // ===========================================================================
  // Player: Actions
  // ===========================================================================

  // NOTE: generateRequestId removed - delegated to PlayerCoordinator (Phase 8c)

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
   * Delegated to PlayerCoordinator (Phase 8c migration)
   */
  async requestSnapshot(timeoutMs: number = 10000): Promise<boolean> {
    return this.playerCoordinator.requestSnapshot(timeoutMs);
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

  // NOTE: buildRoleSeatMap, doCalculateDeaths removed - delegated to HostCoordinator (Phase 8c)

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
