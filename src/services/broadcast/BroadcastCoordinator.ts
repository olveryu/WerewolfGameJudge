/**
 * BroadcastCoordinator - Broadcast communication module
 *
 * Phase 3 of GameStateService refactoring: Extract broadcast logic
 *
 * Responsibilities:
 * - Send state updates to players via BroadcastService
 * - Handle incoming messages from Host (for Player)
 * - Handle incoming messages from Players (for Host)
 * - Request/respond to state snapshots
 *
 * NOT responsible for:
 * - Game logic (handled by ActionProcessor, NightFlowService)
 * - State management (handled by StateManager)
 * - Persistence (handled by StatePersistence)
 *
 * Integration Pattern:
 * - BroadcastCoordinator receives raw messages from BroadcastService
 * - Delegates to callbacks for actual state changes
 * - Does NOT directly modify game state
 */

import type { BroadcastGameState, HostBroadcast, PlayerMessage } from '../BroadcastService';
import { BroadcastService } from '../BroadcastService';
import { hostLog, playerLog } from '../../utils/logger';

// ===========================================================================
// Types
// ===========================================================================

/**
 * Callbacks for Host to handle player messages
 * BroadcastCoordinator calls these instead of directly modifying state
 */
export interface HostMessageHandlers {
  /** Player requesting current state */
  onRequestState: (uid: string) => Promise<void>;
  /** Player joining a seat */
  onJoin: (seat: number, uid: string, displayName?: string, avatarUrl?: string) => Promise<void>;
  /** Player leaving a seat */
  onLeave: (seat: number, uid: string) => Promise<void>;
  /** Player submitting an action */
  onAction: (
    seat: number,
    role: string,
    target: number | null,
    extra?: unknown,
  ) => Promise<void>;
  /** Player acknowledging reveal */
  onRevealAck: (seat: number, role: string, revision: number) => Promise<void>;
  /** Player submitting wolf vote */
  onWolfVote: (seat: number, target: number) => Promise<void>;
  /** Player viewed their role */
  onViewedRole: (seat: number) => Promise<void>;
  /** Player seat action request (sit/standup) */
  onSeatActionRequest: (msg: {
    requestId: string;
    action: 'sit' | 'standup';
    seat: number;
    uid: string;
    displayName?: string;
    avatarUrl?: string;
  }) => Promise<void>;
  /** Player requesting state snapshot */
  onSnapshotRequest: (msg: {
    requestId: string;
    uid: string;
    lastRevision?: number;
  }) => Promise<void>;
}

/**
 * Callbacks for Player to handle host broadcasts
 * BroadcastCoordinator calls these instead of directly modifying state
 */
export interface PlayerMessageHandlers {
  /** State update from Host */
  onStateUpdate: (state: BroadcastGameState, revision: number) => void;
  /** Role turn notification */
  onRoleTurn: (msg: { role: string; pendingSeats: number[]; stepId?: string }) => void;
  /** Night end notification */
  onNightEnd: (deaths: number[]) => void;
  /** Seat rejected notification */
  onSeatRejected: (seat: number, requestUid: string, reason: 'seat_taken') => void;
  /** Seat action acknowledgment */
  onSeatActionAck: (msg: {
    requestId: string;
    toUid: string;
    success: boolean;
    seat: number;
    reason?: string;
  }) => void;
  /** Snapshot response */
  onSnapshotResponse: (msg: {
    requestId: string;
    toUid: string;
    state: BroadcastGameState;
    revision: number;
  }) => void;
  /** Game restarted */
  onGameRestarted: () => void;
}

/**
 * Configuration for BroadcastCoordinator
 */
export interface BroadcastCoordinatorConfig {
  /** Check if current user is Host */
  isHost: () => boolean;
  /** Get current user's UID */
  getMyUid: () => string | null;
  /** Get current state revision */
  getRevision: () => number;
  /** Get broadcast state for sending */
  toBroadcastState: () => BroadcastGameState | null;
}

// ===========================================================================
// BroadcastCoordinator Class
// ===========================================================================

export class BroadcastCoordinator {
  private readonly config: BroadcastCoordinatorConfig;
  private readonly broadcastService: BroadcastService;

  private hostHandlers: HostMessageHandlers | null = null;
  private playerHandlers: PlayerMessageHandlers | null = null;

  constructor(config: BroadcastCoordinatorConfig) {
    this.config = config;
    this.broadcastService = BroadcastService.getInstance();
  }

  // ===========================================================================
  // Setup
  // ===========================================================================

  /**
   * Register handlers for Host to receive player messages
   */
  setHostHandlers(handlers: HostMessageHandlers): void {
    this.hostHandlers = handlers;
  }

  /**
   * Register handlers for Player to receive host broadcasts
   */
  setPlayerHandlers(handlers: PlayerMessageHandlers): void {
    this.playerHandlers = handlers;
  }

  /**
   * Get the message handler function for BroadcastService.joinRoom
   * Use this when joining a room to wire up message handling
   */
  getHostBroadcastHandler(): (msg: HostBroadcast) => void {
    return (msg: HostBroadcast) => this.handleHostBroadcast(msg);
  }

  /**
   * Get the player message handler function for BroadcastService.joinRoom
   * Use this when joining a room to wire up message handling
   */
  getPlayerMessageHandler(): (msg: PlayerMessage, senderId: string) => Promise<void> {
    return async (msg: PlayerMessage, senderId: string) => {
      await this.handlePlayerMessage(msg, senderId);
    };
  }

  // ===========================================================================
  // Host: Send Broadcasts
  // ===========================================================================

  /**
   * Broadcast current state to all players
   * Increments revision before sending
   */
  async broadcastState(state: BroadcastGameState, revision: number): Promise<void> {
    hostLog.debug('Broadcasting state update, revision:', revision);
    await this.broadcastService.broadcastAsHost({
      type: 'STATE_UPDATE',
      state,
      revision,
    });
  }

  /**
   * Broadcast role turn notification
   */
  async broadcastRoleTurn(
    role: string,
    pendingSeats: number[],
    options?: { killedIndex?: number; stepId?: string },
  ): Promise<void> {
    hostLog.debug('Broadcasting role turn:', role);
    await this.broadcastService.broadcastAsHost({
      type: 'ROLE_TURN',
      role: role as import('../../models/roles').RoleId,
      pendingSeats,
      killedIndex: options?.killedIndex,
      stepId: options?.stepId as import('../../models/roles/spec').SchemaId,
    });
  }

  /**
   * Broadcast night end with deaths
   */
  async broadcastNightEnd(deaths: number[]): Promise<void> {
    hostLog.debug('Broadcasting night end, deaths:', deaths);
    await this.broadcastService.broadcastAsHost({
      type: 'NIGHT_END',
      deaths,
    });
  }

  /**
   * Broadcast seat rejection
   */
  async broadcastSeatRejected(seat: number, requestUid: string, reason: 'seat_taken'): Promise<void> {
    await this.broadcastService.broadcastAsHost({
      type: 'SEAT_REJECTED',
      seat,
      requestUid,
      reason,
    });
  }

  /**
   * Broadcast seat action acknowledgment
   */
  async broadcastSeatActionAck(msg: {
    requestId: string;
    toUid: string;
    success: boolean;
    seat: number;
    reason?: string;
  }): Promise<void> {
    await this.broadcastService.broadcastAsHost({
      type: 'SEAT_ACTION_ACK',
      ...msg,
    });
  }

  /**
   * Broadcast snapshot response
   */
  async broadcastSnapshotResponse(msg: {
    requestId: string;
    toUid: string;
    state: BroadcastGameState;
    revision: number;
  }): Promise<void> {
    await this.broadcastService.broadcastAsHost({
      type: 'SNAPSHOT_RESPONSE',
      ...msg,
    });
  }

  /**
   * Broadcast game restarted
   */
  async broadcastGameRestarted(): Promise<void> {
    await this.broadcastService.broadcastAsHost({
      type: 'GAME_RESTARTED',
    });
  }

  // ===========================================================================
  // Player: Send Messages to Host
  // ===========================================================================

  /**
   * Request state from Host
   */
  async requestState(uid: string): Promise<void> {
    await this.broadcastService.sendToHost({
      type: 'REQUEST_STATE',
      uid,
    });
  }

  /**
   * Request snapshot from Host (for reconnection/recovery)
   */
  async requestSnapshot(requestId: string, uid: string, lastRevision?: number): Promise<void> {
    playerLog.debug('Requesting snapshot, lastRevision:', lastRevision);
    await this.broadcastService.sendToHost({
      type: 'SNAPSHOT_REQUEST',
      requestId,
      uid,
      lastRevision,
    });
  }

  /**
   * Send seat action request to Host
   */
  async sendSeatActionRequest(msg: {
    requestId: string;
    action: 'sit' | 'standup';
    seat: number;
    uid: string;
    displayName?: string;
    avatarUrl?: string;
  }): Promise<void> {
    await this.broadcastService.sendToHost({
      type: 'SEAT_ACTION_REQUEST',
      ...msg,
    });
  }

  /**
   * Send action to Host
   */
  async sendAction(
    seat: number,
    role: string,
    target: number | null,
    extra?: unknown,
  ): Promise<void> {
    await this.broadcastService.sendToHost({
      type: 'ACTION',
      seat,
      role: role as import('../../models/roles').RoleId,
      target,
      extra,
    });
  }

  /**
   * Send wolf vote to Host
   */
  async sendWolfVote(seat: number, target: number): Promise<void> {
    await this.broadcastService.sendToHost({
      type: 'WOLF_VOTE',
      seat,
      target,
    });
  }

  /**
   * Send reveal acknowledgment to Host
   */
  async sendRevealAck(seat: number, role: string, revision: number): Promise<void> {
    await this.broadcastService.sendToHost({
      type: 'REVEAL_ACK',
      seat,
      role: role as import('../../models/roles').RoleId,
      revision,
    });
  }

  /**
   * Notify Host that player viewed their role
   */
  async sendViewedRole(seat: number): Promise<void> {
    await this.broadcastService.sendToHost({
      type: 'VIEWED_ROLE',
      seat,
    });
  }

  // ===========================================================================
  // Message Handling (Internal)
  // ===========================================================================

  /**
   * Handle broadcast from Host (Player side)
   */
  private handleHostBroadcast(msg: HostBroadcast): void {
    // Legacy PRIVATE_EFFECT messages are no longer used (removed in refactor)
    // Type guard for any unexpected message types
    if ((msg as { type: string }).type === 'PRIVATE_EFFECT') {
      playerLog.debug('Ignoring legacy PRIVATE_EFFECT message');
      return;
    }

    playerLog.info('Received host broadcast:', msg.type);

    // Host ignores its own broadcasts
    if (this.config.isHost()) {
      if (msg.type === 'STATE_UPDATE') {
        hostLog.info('Ignoring own STATE_UPDATE broadcast');
        return;
      }
    }

    if (!this.playerHandlers) {
      playerLog.warn('No player handlers registered, ignoring message:', msg.type);
      return;
    }

    switch (msg.type) {
      case 'STATE_UPDATE':
        this.playerHandlers.onStateUpdate(msg.state, msg.revision);
        break;
      case 'ROLE_TURN':
        this.playerHandlers.onRoleTurn({
          role: msg.role,
          pendingSeats: msg.pendingSeats,
          stepId: msg.stepId,
        });
        break;
      case 'NIGHT_END':
        this.playerHandlers.onNightEnd(msg.deaths);
        break;
      case 'SEAT_REJECTED':
        this.playerHandlers.onSeatRejected(msg.seat, msg.requestUid, msg.reason);
        break;
      case 'SEAT_ACTION_ACK':
        this.playerHandlers.onSeatActionAck({
          requestId: msg.requestId,
          toUid: msg.toUid,
          success: msg.success,
          seat: msg.seat,
          reason: msg.reason,
        });
        break;
      case 'SNAPSHOT_RESPONSE':
        this.playerHandlers.onSnapshotResponse({
          requestId: msg.requestId,
          toUid: msg.toUid,
          state: msg.state,
          revision: msg.revision,
        });
        break;
      case 'GAME_RESTARTED':
        this.playerHandlers.onGameRestarted();
        break;
    }
  }

  /**
   * Handle message from Player (Host side)
   */
  private async handlePlayerMessage(msg: PlayerMessage, _senderId: string): Promise<void> {
    if (!this.config.isHost()) return;

    hostLog.info('Received player message:', msg.type);

    if (!this.hostHandlers) {
      hostLog.warn('No host handlers registered, ignoring message:', msg.type);
      return;
    }

    switch (msg.type) {
      case 'REQUEST_STATE':
        await this.hostHandlers.onRequestState(msg.uid);
        break;
      case 'JOIN':
        await this.hostHandlers.onJoin(msg.seat, msg.uid, msg.displayName, msg.avatarUrl);
        break;
      case 'LEAVE':
        await this.hostHandlers.onLeave(msg.seat, msg.uid);
        break;
      case 'ACTION':
        await this.hostHandlers.onAction(msg.seat, msg.role, msg.target, msg.extra);
        break;
      case 'REVEAL_ACK':
        await this.hostHandlers.onRevealAck(msg.seat, msg.role, msg.revision);
        break;
      case 'WOLF_VOTE':
        await this.hostHandlers.onWolfVote(msg.seat, msg.target);
        break;
      case 'VIEWED_ROLE':
        await this.hostHandlers.onViewedRole(msg.seat);
        break;
      case 'SEAT_ACTION_REQUEST':
        await this.hostHandlers.onSeatActionRequest({
          requestId: msg.requestId,
          action: msg.action,
          seat: msg.seat,
          uid: msg.uid,
          displayName: msg.displayName,
          avatarUrl: msg.avatarUrl,
        });
        break;
      case 'SNAPSHOT_REQUEST':
        await this.hostHandlers.onSnapshotRequest({
          requestId: msg.requestId,
          uid: msg.uid,
          lastRevision: msg.lastRevision,
        });
        break;
    }
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  /**
   * Mark connection as live (after successful communication)
   */
  markAsLive(): void {
    this.broadcastService.markAsLive();
  }

  /**
   * Get underlying BroadcastService (for advanced use cases)
   * TODO(Phase 3 migration): Minimize direct BroadcastService access
   */
  getBroadcastService(): BroadcastService {
    return this.broadcastService;
  }
}
