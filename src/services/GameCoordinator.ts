/**
 * GameCoordinator - Facade/Coordinator for game state management
 *
 * This is the final Phase 8 result of GameStateService refactoring.
 * It acts as a thin facade that coordinates between specialized modules.
 *
 * Architecture:
 * - StateManager: Pure state storage and listener management
 * - BroadcastCoordinator: Network communication
 * - SeatManager: Seat operations
 * - ActionProcessor: Night action processing
 * - NightFlowService: Night flow control and audio
 * - StatePersistence: AsyncStorage persistence
 *
 * This file should be ~200 lines, containing only:
 * - Module initialization and wiring
 * - Public API delegation to modules
 * - Identity tracking (isHost, myUid, mySeatNumber)
 */

import type { RoleId } from '../models/roles';
import type { GameTemplate } from '../models/Template';
import type { SchemaId } from '../models/roles/spec';
import type { LocalGameState, GameStateListener, LocalPlayer } from './types/GameStateTypes';
import type { BroadcastGameState, HostBroadcast, PlayerMessage } from './BroadcastService';

import { StateManager } from './state';
import { StatePersistence } from './persistence';
import { BroadcastCoordinator, type HostMessageHandlers, type PlayerMessageHandlers } from './broadcast';
import { SeatManager } from './seat';
import { ActionProcessor } from './action';
import { NightFlowService } from './night';
import { hostLog, playerLog } from '../utils/logger';

// Re-export types for convenience
export { GameStatus, LocalPlayer, LocalGameState, GameStateListener } from './types/GameStateTypes';

// =============================================================================
// GameCoordinator Implementation
// =============================================================================

export class GameCoordinator {
  private static instance: GameCoordinator;

  // Modules
  private readonly stateManager: StateManager;
  private readonly statePersistence: StatePersistence;
  private readonly broadcastCoordinator: BroadcastCoordinator;
  private readonly seatManager: SeatManager;
  private readonly actionProcessor: ActionProcessor;
  private readonly nightFlowService: NightFlowService;

  // Identity (kept in coordinator for simplicity)
  private isHost: boolean = false;
  private myUid: string | null = null;
  private mySeatNumber: number | null = null;

  private constructor() {
    // Initialize modules with callbacks for inter-module communication
    this.stateManager = new StateManager({
      onStateChange: (state, revision) => this.handleStateChange(state, revision),
    });

    this.statePersistence = new StatePersistence();
    this.actionProcessor = new ActionProcessor();

    this.broadcastCoordinator = new BroadcastCoordinator({
      isHost: () => this.isHost,
      getMyUid: () => this.myUid,
      getRevision: () => this.stateManager.getRevision(),
      toBroadcastState: () => this.stateManager.hasState() ? this.stateManager.toBroadcastState() : null,
    });

    this.seatManager = new SeatManager({
      isHost: () => this.isHost,
      getMyUid: () => this.myUid,
      getState: () => this.stateManager.getState(),
      setMySeatNumber: (seat) => { this.mySeatNumber = seat; },
      getMySeatNumber: () => this.mySeatNumber,
      broadcastState: () => this.broadcastState(),
      notifyListeners: () => {}, // StateManager handles this now
      broadcastCoordinator: this.broadcastCoordinator,
      // StateManager callbacks for seat operations
      setSeatPlayer: (seat, player) => this.stateManager.setSeatPlayer(seat, player),
      clearSeat: (seat) => this.stateManager.clearSeat(seat),
      clearSeatsByUid: (uid, skipSeat) => this.stateManager.clearSeatsByUid(uid, skipSeat),
      updateSeatStatus: () => this.stateManager.updateSeatStatus(),
    });

    this.nightFlowService = new NightFlowService({
      getState: () => this.stateManager.getState(),
      updateState: (updates) => this.stateManager.batchUpdate(updates),
      getSeatsForRole: (role) => this.getSeatsForRole(role),
      onRoleTurnStart: async (role, pendingSeats, stepId) => {
        await this.handleRoleTurnStart(role, pendingSeats, stepId);
      },
      onNightEnd: async () => {
        await this.handleNightEnd();
      },
    });

    // Wire up message handlers
    this.setupMessageHandlers();
  }

  static getInstance(): GameCoordinator {
    if (!GameCoordinator.instance) {
      GameCoordinator.instance = new GameCoordinator();
    }
    return GameCoordinator.instance;
  }

  // ===========================================================================
  // State Access (delegated to StateManager)
  // ===========================================================================

  getState(): LocalGameState | null {
    return this.stateManager.getState();
  }

  getStateRevision(): number {
    return this.stateManager.getRevision();
  }

  addListener(listener: GameStateListener): () => void {
    return this.stateManager.subscribe(listener);
  }

  // ===========================================================================
  // Identity Access
  // ===========================================================================

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
    if (this.mySeatNumber === null) return null;
    const state = this.stateManager.getState();
    if (!state) return null;
    return state.players.get(this.mySeatNumber)?.role ?? null;
  }

  // ===========================================================================
  // Seat Error (delegated to SeatManager)
  // ===========================================================================

  getLastSeatError(): { seat: number; reason: 'seat_taken' } | null {
    return this.seatManager.getLastSeatError();
  }

  clearLastSeatError(): void {
    this.seatManager.clearLastSeatError();
  }

  // ===========================================================================
  // Room Management
  // ===========================================================================

  async initializeAsHost(roomCode: string, hostUid: string, template: GameTemplate): Promise<void> {
    // TODO: Implement - migrate from GameStateService
    throw new Error('Not implemented - use GameStateService for now');
  }

  async rejoinAsHost(roomCode: string, hostUid: string): Promise<void> {
    // TODO: Implement - migrate from GameStateService
    throw new Error('Not implemented - use GameStateService for now');
  }

  async joinAsPlayer(roomCode: string, playerUid: string): Promise<void> {
    // TODO: Implement - migrate from GameStateService
    throw new Error('Not implemented - use GameStateService for now');
  }

  async leaveRoom(): Promise<void> {
    // TODO: Implement - migrate from GameStateService
    throw new Error('Not implemented - use GameStateService for now');
  }

  // ===========================================================================
  // Seat Management (delegated to SeatManager)
  // ===========================================================================

  async takeSeat(seat: number, displayName?: string, avatarUrl?: string): Promise<boolean> {
    return this.seatManager.takeSeat(seat, displayName, avatarUrl);
  }

  async leaveSeat(): Promise<boolean> {
    return this.seatManager.leaveSeat();
  }

  async takeSeatWithAck(seat: number, displayName?: string, avatarUrl?: string, timeoutMs?: number): Promise<boolean> {
    const result = await this.seatManager.takeSeatWithAck(seat, displayName, avatarUrl, timeoutMs);
    return result.success;
  }

  async leaveSeatWithAck(timeoutMs?: number): Promise<{ success: boolean; reason?: string }> {
    return this.seatManager.leaveSeatWithAck(timeoutMs);
  }

  async requestSnapshot(timeoutMs?: number): Promise<boolean> {
    // TODO: Implement - delegate to BroadcastCoordinator
    throw new Error('Not implemented - use GameStateService for now');
  }

  // ===========================================================================
  // Game Flow
  // ===========================================================================

  async updateTemplate(newTemplate: GameTemplate): Promise<void> {
    // TODO: Implement - migrate from GameStateService
    throw new Error('Not implemented - use GameStateService for now');
  }

  async assignRoles(): Promise<void> {
    // TODO: Implement - migrate from GameStateService
    throw new Error('Not implemented - use GameStateService for now');
  }

  async startGame(): Promise<void> {
    // TODO: Implement - delegate to NightFlowService
    throw new Error('Not implemented - use GameStateService for now');
  }

  async restartGame(): Promise<boolean> {
    // TODO: Implement - migrate from GameStateService
    throw new Error('Not implemented - use GameStateService for now');
  }

  // ===========================================================================
  // Player Actions
  // ===========================================================================

  async playerViewedRole(): Promise<void> {
    // TODO: Implement - migrate from GameStateService
    throw new Error('Not implemented - use GameStateService for now');
  }

  async submitAction(target: number | null, extra?: unknown): Promise<void> {
    // TODO: Implement - migrate from GameStateService
    throw new Error('Not implemented - use GameStateService for now');
  }

  async submitWolfVote(target: number): Promise<void> {
    // TODO: Implement - migrate from GameStateService
    throw new Error('Not implemented - use GameStateService for now');
  }

  async submitRevealAck(role: RoleId): Promise<void> {
    // TODO: Implement - migrate from GameStateService
    throw new Error('Not implemented - use GameStateService for now');
  }

  // ===========================================================================
  // Info
  // ===========================================================================

  getLastNightInfo(): string {
    // TODO: Implement - migrate from GameStateService
    return 'Not implemented';
  }

  async clearSavedState(roomCode: string): Promise<void> {
    await this.statePersistence.clearState(roomCode);
  }

  // ===========================================================================
  // Private: Internal Callbacks
  // ===========================================================================

  private handleStateChange(state: BroadcastGameState, revision: number): void {
    if (!this.isHost) return;
    
    // Broadcast to players
    this.broadcastCoordinator.broadcastState(state, revision).catch((err) => {
      hostLog.error('Failed to broadcast state:', err);
    });

    // Persist state
    this.statePersistence.saveState(state.roomCode, this.stateManager.getState()!).catch((err) => {
      hostLog.error('Failed to persist state:', err);
    });
  }

  private async broadcastState(): Promise<void> {
    if (!this.isHost) return;
    const state = this.stateManager.toBroadcastState();
    const revision = this.stateManager.getRevision();
    await this.broadcastCoordinator.broadcastState(state, revision);
  }

  private async handleRoleTurnStart(role: RoleId, pendingSeats: number[], stepId?: SchemaId): Promise<void> {
    // TODO: Implement - set witch context, hunter context, etc.
  }

  private async handleNightEnd(): Promise<void> {
    // TODO: Implement - calculate deaths, broadcast NIGHT_END
  }

  private getSeatsForRole(role: RoleId): number[] {
    const state = this.stateManager.getState();
    if (!state) return [];
    const seats: number[] = [];
    state.players.forEach((player, seat) => {
      if (player?.role === role) {
        seats.push(seat);
      }
    });
    return seats;
  }

  private setupMessageHandlers(): void {
    // Host handlers
    const hostHandlers: HostMessageHandlers = {
      onRequestState: async (_uid) => {
        await this.broadcastState();
      },
      onJoin: async (seat, uid, displayName, avatarUrl) => {
        // TODO: Implement handlePlayerJoin
      },
      onLeave: async (seat, uid) => {
        // TODO: Implement handlePlayerLeave
      },
      onAction: async (seat, role, target, extra) => {
        // TODO: Implement handlePlayerAction
      },
      onRevealAck: async (seat, role, revision) => {
        // TODO: Implement handleRevealAck
      },
      onWolfVote: async (seat, target) => {
        // TODO: Implement handleWolfVote
      },
      onViewedRole: async (seat) => {
        // TODO: Implement handlePlayerViewedRole
      },
      onSeatActionRequest: async (msg) => {
        await this.seatManager.handleSeatActionRequest(msg);
      },
      onSnapshotRequest: async (_msg) => {
        // TODO: Implement handleSnapshotRequest
      },
    };
    this.broadcastCoordinator.setHostHandlers(hostHandlers);

    // Player handlers
    const playerHandlers: PlayerMessageHandlers = {
      onStateUpdate: (state, revision) => {
        this.stateManager.applyBroadcastState(state, revision, this.myUid);
      },
      onRoleTurn: (_msg) => {
        // TODO: Implement role turn handling
      },
      onNightEnd: (deaths) => {
        this.stateManager.batchUpdate({ lastNightDeaths: deaths });
      },
      onSeatRejected: (seat, _requestUid, reason) => {
        this.seatManager.setLastSeatError({ seat, reason });
      },
      onSeatActionAck: (msg) => {
        this.seatManager.handleSeatActionAck(msg);
      },
      onSnapshotResponse: (_msg) => {
        // TODO: Implement snapshot response handling
      },
      onGameRestarted: () => {
        // TODO: Implement game restart handling
      },
    };
    this.broadcastCoordinator.setPlayerHandlers(playerHandlers);
  }
}

// Export alias for backward compatibility during migration
export { GameCoordinator as GameStateService };
