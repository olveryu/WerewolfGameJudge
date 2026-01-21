/**
 * GameFacade - V2 Unified Game Service Facade
 *
 * This is the ONLY public API for game state management.
 * All external code should import from this facade.
 *
 * Architecture:
 * - GameFacade coordinates between HostEngine (for Host) and PlayerEngine (for Player)
 * - Uses Infra layer (StateStore, Transport, Storage, Audio) for underlying operations
 * - Exposes a unified API that hides Host/Player distinction where possible
 *
 * @see /docs/architecture/SERVICE_REWRITE_PLAN.md
 */

import type { RoleId } from '../../../models/roles';
import type { GameTemplate } from '../../../models/Template';
import { facadeLog } from '../../../utils/logger';

import { StateStore } from '../infra/StateStore';
import type { LocalGameState, GameStateListener } from '../infra/StateStore';
import { Transport } from '../infra/Transport';
import { Storage } from '../infra/Storage';
import { Audio } from '../infra/Audio';

import { HostEngine } from '../domain/HostEngine';
import { PlayerEngine } from '../domain/PlayerEngine';

// Re-export types for external consumers
export type { LocalGameState, LocalPlayer, GameStateListener } from '../infra/StateStore';
export { GameStatus } from '../infra/StateStore';
export type { ConnectionStatus, ConnectionStatusListener } from '../infra/Transport';

// =============================================================================
// GameFacade Implementation
// =============================================================================

export class GameFacade {
  private static instance: GameFacade;

  // Mode: 'host' | 'player' | null
  private mode: 'host' | 'player' | null = null;
  private myUid: string | null = null;

  // Infra layer (singletons, shared)
  private readonly stateStore: StateStore;
  private readonly transport: Transport;
  private readonly storage: Storage;
  private readonly audio: Audio;

  // Domain layer (one active at a time based on mode)
  private hostEngine: HostEngine | null = null;
  private playerEngine: PlayerEngine | null = null;

  // Facade-level state
  private lastSeatError: { seat: number; reason: 'seat_taken' } | null = null;
  private readonly listeners: Set<GameStateListener> = new Set();

  private constructor() {
    // Initialize infra layer
    this.stateStore = new StateStore({
      onStateChange: (state, revision) => {
        // Host broadcasts state changes
        if (this.mode === 'host') {
          this.transport.broadcastAsHost({
            type: 'STATE_UPDATE',
            state,
            revision,
          });
        }
      },
    });
    this.transport = Transport.getInstance();
    this.storage = Storage.getInstance();
    this.audio = Audio.getInstance();
  }

  static getInstance(): GameFacade {
    if (!GameFacade.instance) {
      GameFacade.instance = new GameFacade();
    }
    return GameFacade.instance;
  }

  /**
   * Reset singleton for testing
   * @internal
   */
  static resetForTesting(): void {
    if (GameFacade.instance) {
      GameFacade.instance.cleanup();
    }
    GameFacade.instance = undefined as unknown as GameFacade;
  }

  private cleanup(): void {
    this.hostEngine?.reset();
    this.playerEngine?.reset();
    this.stateStore.reset();
    this.mode = null;
    this.myUid = null;
    this.lastSeatError = null;
    this.listeners.clear();
  }

  // ===========================================================================
  // State Accessors
  // ===========================================================================

  getState(): LocalGameState | null {
    return this.stateStore.getState();
  }

  isHostPlayer(): boolean {
    return this.mode === 'host';
  }

  getMyUid(): string | null {
    return this.myUid;
  }

  getMySeatNumber(): number | null {
    const state = this.stateStore.getState();
    if (!state || !this.myUid) return null;

    for (const [seat, player] of state.players.entries()) {
      if (player?.uid === this.myUid) {
        return seat;
      }
    }
    return null;
  }

  getMyRole(): RoleId | null {
    const seatNumber = this.getMySeatNumber();
    if (seatNumber === null) return null;

    const state = this.stateStore.getState();
    const player = state?.players.get(seatNumber);
    return player?.role ?? null;
  }

  getLastSeatError(): { seat: number; reason: 'seat_taken' } | null {
    return this.lastSeatError;
  }

  clearLastSeatError(): void {
    this.lastSeatError = null;
  }

  getStateRevision(): number {
    if (this.mode === 'host' && this.hostEngine) {
      return this.hostEngine.getRevision();
    }
    return this.stateStore.getRevision();
  }

  getLastNightInfo(): string {
    const state = this.stateStore.getState();
    if (!state) return '';

    // Build info string from state (lastNightDeaths is the correct field name)
    const deaths = state.lastNightDeaths || [];
    if (deaths.length === 0) return '昨晚是平安夜';
    const deathList = deaths.map((s: number) => s + '号').join(', ');
    return '昨晚死亡: ' + deathList;
  }

  // ===========================================================================
  // Connection Status
  // ===========================================================================

  getConnectionStatus(): import('../infra/Transport').ConnectionStatus {
    return this.transport.getConnectionStatus();
  }

  addStatusListener(
    listener: import('../infra/Transport').ConnectionStatusListener,
  ): () => void {
    return this.transport.addStatusListener(listener);
  }

  // ===========================================================================
  // Listeners
  // ===========================================================================

  addListener(listener: GameStateListener): () => void {
    this.listeners.add(listener);

    // Subscribe to StateStore
    const unsubscribe = this.stateStore.subscribe(listener);

    return () => {
      this.listeners.delete(listener);
      unsubscribe();
    };
  }

  private notifyListeners(): void {
    this.stateStore.notifyListeners();
  }

  // ===========================================================================
  // Host Operations
  // ===========================================================================

  async initializeAsHost(roomCode: string, hostUid: string, template: GameTemplate): Promise<void> {
    facadeLog.info('[GameFacade] initializeAsHost', { roomCode, hostUid });

    this.mode = 'host';
    this.myUid = hostUid;

    // Create HostEngine
    this.hostEngine = new HostEngine({
      stateStore: this.stateStore,
      transport: this.transport,
      storage: this.storage,
      audio: this.audio,
      onNotifyListeners: () => this.notifyListeners(),
    });

    // Initialize
    await this.hostEngine.initialize(roomCode, hostUid, template);
  }

  async rejoinAsHost(roomCode: string, hostUid: string): Promise<void> {
    facadeLog.info('[GameFacade] rejoinAsHost', { roomCode, hostUid });

    this.mode = 'host';
    this.myUid = hostUid;

    // Create HostEngine
    this.hostEngine = new HostEngine({
      stateStore: this.stateStore,
      transport: this.transport,
      storage: this.storage,
      audio: this.audio,
      onNotifyListeners: () => this.notifyListeners(),
    });

    // Rejoin
    const recovered = await this.hostEngine.rejoin(roomCode, hostUid);
    if (!recovered) {
      throw new Error('Failed to recover host state');
    }
  }

  async assignRoles(): Promise<void> {
    if (!this.hostEngine) {
      throw new Error('[GameFacade] Not in host mode');
    }
    await this.hostEngine.assignRoles();
  }

  async startGame(): Promise<void> {
    if (!this.hostEngine) {
      throw new Error('[GameFacade] Not in host mode');
    }
    await this.hostEngine.startGame();
  }

  async restartGame(): Promise<boolean> {
    if (!this.hostEngine) {
      throw new Error('[GameFacade] Not in host mode');
    }
    await this.hostEngine.restartGame();
    return true;
  }

  async updateTemplate(newTemplate: GameTemplate): Promise<void> {
    if (!this.hostEngine) {
      throw new Error('[GameFacade] Not in host mode');
    }
    await this.hostEngine.updateTemplate(newTemplate);
  }

  async clearSavedState(roomCode: string): Promise<void> {
    await this.storage.clear(roomCode);
  }

  // ===========================================================================
  // Player Operations
  // ===========================================================================

  async joinAsPlayer(
    roomCode: string,
    playerUid: string,
    _displayName?: string,
    _avatarUrl?: string,
  ): Promise<void> {
    facadeLog.info('[GameFacade] joinAsPlayer', { roomCode, playerUid });

    this.mode = 'player';
    this.myUid = playerUid;

    // Create PlayerEngine
    this.playerEngine = new PlayerEngine({
      stateStore: this.stateStore,
      transport: this.transport,
      getMyUid: () => this.myUid,
      onNotifyListeners: () => this.notifyListeners(),
    });

    // Set callbacks for seat rejection
    this.playerEngine.setCallbacks({
      onSeatRejected: (seat, reason) => {
        facadeLog.warn('[GameFacade] Seat rejected', { seat, reason });
        this.lastSeatError = { seat, reason: 'seat_taken' };
        this.notifyListeners();
      },
    });

    // Join room via Transport
    await this.transport.joinRoom(roomCode, playerUid, {
      onHostBroadcast: (msg) => {
        this.playerEngine?.handleHostBroadcast(msg);
      },
    });

    // Request snapshot to get initial state (this is the correct way, not JOIN message)
    await this.playerEngine.requestSnapshot();
  }

  async leaveRoom(): Promise<void> {
    facadeLog.info('[GameFacade] leaveRoom');

    // Send LEAVE message if player with a seat
    const mySeat = this.getMySeatNumber();
    if (this.mode === 'player' && mySeat !== null && this.myUid) {
      await this.transport.sendToHost({
        type: 'LEAVE',
        seat: mySeat,
        uid: this.myUid,
      });
    }

    // Leave transport
    await this.transport.leaveRoom();

    // Cleanup
    this.cleanup();
  }

  async takeSeat(seat: number, displayName?: string, avatarUrl?: string): Promise<boolean> {
    // Host mode: use hostEngine directly
    if (this.mode === 'host' && this.hostEngine) {
      return this.hostEngine.hostTakeSeat(seat, this.myUid!, displayName, avatarUrl);
    }

    // Player mode: use playerEngine
    if (!this.playerEngine) {
      facadeLog.warn('[GameFacade] takeSeat called but not in player mode');
      return false;
    }

    this.clearLastSeatError();
    return this.playerEngine.takeSeat(seat, displayName, avatarUrl);
  }

  async leaveSeat(): Promise<boolean> {
    // Host mode: use hostEngine directly
    if (this.mode === 'host' && this.hostEngine) {
      const mySeat = this.getMySeatNumber();
      if (mySeat === null) return true; // Already not seated
      return this.hostEngine.hostLeaveSeat(mySeat, this.myUid!);
    }

    // Player mode: use playerEngine
    if (!this.playerEngine) {
      facadeLog.warn('[GameFacade] leaveSeat called but not in player mode');
      return false;
    }

    return this.playerEngine.leaveSeat();
  }

  async takeSeatWithAck(
    seat: number,
    displayName?: string,
    avatarUrl?: string,
    timeoutMs: number = 5000,
  ): Promise<{ success: boolean; reason?: string }> {
    if (!this.playerEngine) {
      return { success: false, reason: 'not_in_player_mode' };
    }

    this.clearLastSeatError();

    // Try to take seat
    const result = await this.playerEngine.takeSeat(seat, displayName, avatarUrl);

    if (!result) {
      return { success: false, reason: 'local_validation_failed' };
    }

    // Wait for confirmation or rejection
    return new Promise((resolve) => {
      const startTime = Date.now();

      const checkResult = () => {
        // Check if we got a rejection
        if (this.lastSeatError?.seat === seat) {
          resolve({ success: false, reason: this.lastSeatError.reason });
          return;
        }

        // Check if seat is now occupied by us
        const mySeat = this.getMySeatNumber();
        if (mySeat === seat) {
          resolve({ success: true });
          return;
        }

        // Timeout check
        if (Date.now() - startTime >= timeoutMs) {
          resolve({ success: false, reason: 'timeout' });
          return;
        }

        // Keep polling
        setTimeout(checkResult, 100);
      };

      checkResult();
    });
  }

  async leaveSeatWithAck(timeoutMs: number = 5000): Promise<{ success: boolean; reason?: string }> {
    if (!this.playerEngine) {
      return { success: false, reason: 'not_in_player_mode' };
    }

    const currentSeat = this.getMySeatNumber();
    if (currentSeat === null) {
      return { success: true }; // Already not seated
    }

    const result = await this.playerEngine.leaveSeat();
    if (!result) {
      return { success: false, reason: 'local_validation_failed' };
    }

    // Wait for confirmation
    return new Promise((resolve) => {
      const startTime = Date.now();

      const checkResult = () => {
        const mySeat = this.getMySeatNumber();
        if (mySeat === null) {
          resolve({ success: true });
          return;
        }

        if (Date.now() - startTime >= timeoutMs) {
          resolve({ success: false, reason: 'timeout' });
          return;
        }

        setTimeout(checkResult, 100);
      };

      checkResult();
    });
  }

  async requestSnapshot(timeoutMs?: number): Promise<boolean> {
    if (!this.playerEngine) {
      facadeLog.warn('[GameFacade] requestSnapshot called but not in player mode');
      return false;
    }

    return this.playerEngine.requestSnapshot(timeoutMs);
  }

  async playerViewedRole(): Promise<void> {
    // Host mode: directly call handleViewedRole on HostEngine
    if (this.hostEngine) {
      const seatNumber = this.getMySeatNumber();
      if (seatNumber === null) {
        facadeLog.warn('[GameFacade] playerViewedRole: Host not seated');
        return;
      }
      await this.hostEngine.hostViewedRole(seatNumber);
      return;
    }

    // Player mode: send message to Host
    if (!this.playerEngine) {
      facadeLog.warn('[GameFacade] playerViewedRole called but not in player mode');
      return;
    }

    const seatNumber = this.getMySeatNumber();
    if (seatNumber === null) {
      facadeLog.warn('[GameFacade] playerViewedRole: not seated');
      return;
    }

    await this.playerEngine.viewedRole(seatNumber);
  }

  // ===========================================================================
  // Game Actions
  // ===========================================================================

  async submitAction(target: number | null, extra?: unknown): Promise<void> {
    if (!this.playerEngine) {
      facadeLog.warn('[GameFacade] submitAction called but not in player mode');
      return;
    }

    const seatNumber = this.getMySeatNumber();
    if (seatNumber === null) {
      facadeLog.warn('[GameFacade] submitAction: not seated');
      return;
    }

    const role = this.getMyRole();
    if (!role) {
      facadeLog.warn('[GameFacade] submitAction: no role assigned');
      return;
    }

    await this.playerEngine.submitAction(seatNumber, role, target, extra);
  }

  async submitWolfVote(target: number): Promise<void> {
    if (!this.playerEngine) {
      facadeLog.warn('[GameFacade] submitWolfVote called but not in player mode');
      return;
    }

    const seatNumber = this.getMySeatNumber();
    if (seatNumber === null) {
      facadeLog.warn('[GameFacade] submitWolfVote: not seated');
      return;
    }

    await this.playerEngine.submitWolfVote(seatNumber, target);
  }

  async submitRevealAck(role: RoleId): Promise<void> {
    if (!this.playerEngine) {
      facadeLog.warn('[GameFacade] submitRevealAck called but not in player mode');
      return;
    }

    const seatNumber = this.getMySeatNumber();
    if (seatNumber === null) {
      facadeLog.warn('[GameFacade] submitRevealAck: not seated');
      return;
    }

    const revision = this.getStateRevision();
    await this.playerEngine.submitRevealAck(seatNumber, role, revision);
  }

  // ===========================================================================
  // Test Helpers (internal use only)
  // ===========================================================================

  /** @internal - Access host engine for testing */
  __testGetHostEngine(): HostEngine | null {
    return this.hostEngine;
  }

  /** @internal - Access player engine for testing */
  __testGetPlayerEngine(): PlayerEngine | null {
    return this.playerEngine;
  }

  /** @internal - Access state store for testing */
  __testGetStateStore(): StateStore {
    return this.stateStore;
  }
}

export default GameFacade;
