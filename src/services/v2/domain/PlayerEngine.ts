/**
 * PlayerEngine - Player-side game logic
 *
 * 职责：
 * - 处理 Host 广播消息
 * - 发送玩家动作到 Host
 * - 请求状态快照恢复
 *
 * 不做的事：
 * - 状态存储（交给 StateStore）
 * - 网络传输（交给 Transport）
 * - 座位验证（交给 SeatEngine）
 */

import type { RoleId, SchemaId } from '../../../models/roles';
import type { StateStore } from '../infra/StateStore';
import type { Transport } from '../infra/Transport';
import type { HostBroadcast, BroadcastGameState } from '../types/Broadcast';
import { SeatEngine } from './SeatEngine';
import { playerLog } from '../../../utils/logger';

// =============================================================================
// Types
// =============================================================================

/** Configuration for PlayerEngine */
export interface PlayerEngineConfig {
  stateStore: StateStore;
  transport: Transport;

  /** Get current player's UID */
  getMyUid: () => string | null;

  /** Notify listeners of state changes */
  onNotifyListeners: () => void;
}

/** Callbacks for player events */
export interface PlayerEventCallbacks {
  /** Called when Host broadcasts STATE_UPDATE */
  onStateUpdate?: (state: BroadcastGameState, revision: number) => void;

  /** Called when Host broadcasts ROLE_TURN */
  onRoleTurn?: (
    role: RoleId,
    pendingSeats: number[],
    killedIndex?: number,
    stepId?: SchemaId,
  ) => void;

  /** Called when Host broadcasts NIGHT_END */
  onNightEnd?: (deaths: number[]) => void;

  /** Called when Host broadcasts GAME_RESTARTED */
  onGameRestarted?: () => void;

  /** Called when seat action is rejected */
  onSeatRejected?: (seat: number, reason: string) => void;

  /** Called when snapshot response is received */
  onSnapshotReceived?: (state: BroadcastGameState, revision: number) => void;
}

/** Pending snapshot request tracking */
interface PendingSnapshotRequest {
  requestId: string;
  timestamp: number;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

// =============================================================================
// PlayerEngine Implementation
// =============================================================================

export class PlayerEngine {
  private readonly config: PlayerEngineConfig;
  private readonly seatEngine: SeatEngine;
  private callbacks: PlayerEventCallbacks = {};

  private pendingSnapshotRequest: PendingSnapshotRequest | null = null;

  constructor(config: PlayerEngineConfig) {
    this.config = config;
    this.seatEngine = new SeatEngine();
  }

  // ---------------------------------------------------------------------------
  // Callback Registration
  // ---------------------------------------------------------------------------

  /** Set event callbacks */
  setCallbacks(callbacks: PlayerEventCallbacks): void {
    this.callbacks = callbacks;
  }

  // ---------------------------------------------------------------------------
  // Host Broadcast Handling
  // ---------------------------------------------------------------------------

  /**
   * Handle broadcast message from Host
   */
  handleHostBroadcast(msg: HostBroadcast): void {
    const myUid = this.config.getMyUid();

    switch (msg.type) {
      case 'STATE_UPDATE':
        this.handleStateUpdate(msg.state, msg.revision);
        break;

      case 'ROLE_TURN':
        this.callbacks.onRoleTurn?.(msg.role, msg.pendingSeats, msg.killedIndex, msg.stepId);
        break;

      case 'NIGHT_END':
        this.callbacks.onNightEnd?.(msg.deaths);
        break;

      case 'SEAT_REJECTED':
        if (msg.requestUid === myUid) {
          this.callbacks.onSeatRejected?.(msg.seat, msg.reason);
        }
        break;

      case 'SEAT_ACTION_ACK':
        if (msg.toUid === myUid) {
          playerLog.debug('Seat action ack:', msg);
          // ACK handling delegated to callbacks if needed
        }
        break;

      case 'SNAPSHOT_RESPONSE':
        if (msg.toUid === myUid) {
          this.handleSnapshotResponse(msg.requestId, msg.state, msg.revision);
        }
        break;

      case 'GAME_RESTARTED':
        this.callbacks.onGameRestarted?.();
        break;

      default:
        playerLog.debug('Unhandled broadcast type:', (msg as any).type);
    }
  }

  /**
   * Handle STATE_UPDATE from Host
   */
  private handleStateUpdate(broadcastState: BroadcastGameState, _revision: number): void {
    const stateStore = this.config.stateStore;
    const myUid = this.config.getMyUid();

    // Apply state update
    const { applied } = stateStore.applyBroadcastState(broadcastState, myUid);

    if (!applied) {
      playerLog.debug('State update not applied');
      return;
    }

    // Notify via callback
    this.callbacks.onStateUpdate?.(broadcastState, _revision);

    // Trigger UI update
    this.config.onNotifyListeners();
  }

  /**
   * Handle SNAPSHOT_RESPONSE from Host
   */
  private handleSnapshotResponse(
    requestId: string,
    state: BroadcastGameState,
    revision: number,
  ): void {
    // Verify this is the pending request
    if (this.pendingSnapshotRequest?.requestId !== requestId) {
      playerLog.debug('Ignoring snapshot response for unknown request:', requestId);
      return;
    }

    // Clear pending request
    clearTimeout(this.pendingSnapshotRequest.timeoutHandle);
    this.pendingSnapshotRequest = null;

    // Apply snapshot
    const myUid = this.config.getMyUid();
    this.config.stateStore.applyBroadcastState(state, myUid);

    // Update connection status to live
    this.config.transport.setConnectionStatus('live');

    // Notify via callback
    this.callbacks.onSnapshotReceived?.(state, revision);

    // Trigger UI update
    this.config.onNotifyListeners();

    playerLog.info('Snapshot applied, revision:', revision);
  }

  // ---------------------------------------------------------------------------
  // Player Actions (send to Host)
  // ---------------------------------------------------------------------------

  /**
   * Request to sit in a seat
   */
  async takeSeat(seat: number, displayName?: string, avatarUrl?: string): Promise<boolean> {
    const myUid = this.config.getMyUid();
    if (!myUid) return false;

    const state = this.config.stateStore.getState();
    if (!state) return false;

    // Validate with SeatEngine first
    const result = this.seatEngine.sit(state, {
      seat,
      uid: myUid,
      displayName,
      avatarUrl,
    });

    if (!result.success) {
      playerLog.debug('Seat validation failed:', result.reason);
      return false;
    }

    // Send to Host
    await this.config.transport.sendToHost({
      type: 'JOIN',
      seat,
      uid: myUid,
      displayName: displayName ?? 'Player',
      avatarUrl,
    });

    return true;
  }

  /**
   * Request to leave current seat
   */
  async leaveSeat(): Promise<boolean> {
    const myUid = this.config.getMyUid();
    if (!myUid) return false;

    const state = this.config.stateStore.getState();
    if (!state) return false;

    // Find current seat
    const currentSeat = this.seatEngine.findSeatByUid(state, myUid);
    if (currentSeat === null) {
      playerLog.debug('Not seated, cannot leave');
      return false;
    }

    // Validate with SeatEngine
    const result = this.seatEngine.standup(state, {
      seat: currentSeat,
      uid: myUid,
    });

    if (!result.success) {
      playerLog.debug('Standup validation failed:', result.reason);
      return false;
    }

    // Send to Host
    await this.config.transport.sendToHost({
      type: 'LEAVE',
      seat: currentSeat,
      uid: myUid,
    });

    return true;
  }

  /**
   * Submit action during night phase
   */
  async submitAction(
    seatNumber: number,
    role: RoleId,
    target: number | null,
    extra?: unknown,
  ): Promise<void> {
    await this.config.transport.sendToHost({
      type: 'ACTION',
      seat: seatNumber,
      role,
      target,
      extra,
    });
  }

  /**
   * Submit wolf vote
   */
  async submitWolfVote(seatNumber: number, target: number): Promise<void> {
    await this.config.transport.sendToHost({
      type: 'WOLF_VOTE',
      seat: seatNumber,
      target,
    });
  }

  /**
   * Notify Host that player has viewed their role
   */
  async viewedRole(seatNumber: number): Promise<void> {
    await this.config.transport.sendToHost({
      type: 'VIEWED_ROLE',
      seat: seatNumber,
    });
  }

  /**
   * Submit reveal acknowledgement (seer/psychic etc.)
   */
  async submitRevealAck(seatNumber: number, role: RoleId, revision: number): Promise<void> {
    await this.config.transport.sendToHost({
      type: 'REVEAL_ACK',
      seat: seatNumber,
      role,
      revision,
    });
  }

  // ---------------------------------------------------------------------------
  // State Synchronization
  // ---------------------------------------------------------------------------

  /**
   * Request full state snapshot from Host (for recovery)
   * Returns true if request was sent, false if failed
   */
  async requestSnapshot(timeoutMs: number = 10000): Promise<boolean> {
    const myUid = this.config.getMyUid();
    if (!myUid) return false;

    // Cancel any pending request
    if (this.pendingSnapshotRequest) {
      clearTimeout(this.pendingSnapshotRequest.timeoutHandle);
      this.pendingSnapshotRequest = null;
    }

    // Mark as syncing
    this.config.transport.setConnectionStatus('syncing');

    const requestId = this.generateRequestId();
    const currentRevision = this.config.stateStore.getRevision();

    playerLog.info('Requesting snapshot, lastRev:', currentRevision);

    // Set up timeout
    const timeoutHandle = setTimeout(() => {
      if (this.pendingSnapshotRequest?.requestId === requestId) {
        playerLog.info('Snapshot request timeout');
        this.pendingSnapshotRequest = null;
        this.config.transport.setConnectionStatus('disconnected');
        this.config.onNotifyListeners();
      }
    }, timeoutMs);

    // Store pending request
    this.pendingSnapshotRequest = {
      requestId,
      timestamp: Date.now(),
      timeoutHandle,
    };

    try {
      await this.config.transport.sendToHost({
        type: 'SNAPSHOT_REQUEST',
        requestId,
        uid: myUid,
        lastRevision: currentRevision,
      });
    } catch (err) {
      // Send failed - rollback
      if (this.pendingSnapshotRequest?.requestId === requestId) {
        playerLog.info('Snapshot request send failed:', err);
        clearTimeout(this.pendingSnapshotRequest.timeoutHandle);
        this.pendingSnapshotRequest = null;
        this.config.transport.setConnectionStatus('disconnected');
        this.config.onNotifyListeners();
      }
      return false;
    }

    return true;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Reset engine state
   */
  reset(): void {
    if (this.pendingSnapshotRequest) {
      clearTimeout(this.pendingSnapshotRequest.timeoutHandle);
      this.pendingSnapshotRequest = null;
    }
    this.callbacks = {};
  }
}
