/**
 * HostEngine - Host-side game orchestration
 *
 * 职责：
 * - 处理 Player 消息 (JOIN, LEAVE, ACTION, etc.)
 * - 游戏流程控制 (start, restart, role assignment)
 * - 夜晚阶段管理
 * - 状态广播协调
 *
 * 不做的事：
 * - 状态存储（交给 StateStore）
 * - 网络传输（交给 Transport）
 * - 座位验证（交给 SeatEngine）
 * - 夜晚流程状态机（交给 NightEngine）
 */

import type { RoleId } from '../../../models/roles';
import { isWolfRole } from '../../../models/roles';
import type { GameTemplate } from '../../../models/Template';
import { validateTemplateRoles } from '../../../models/Template';
import { makeActionTarget } from '../../../models/actions';
import { shuffleArray } from '../../../utils/shuffle';
import { hostLog } from '../../../utils/logger';

import type { StateStore, LocalGameState, LocalPlayer } from '../infra/StateStore';
import { GameStatus } from '../infra/StateStore';
import type { Transport } from '../infra/Transport';
import type { Storage } from '../infra/Storage';
import type { Audio } from '../infra/Audio';
import { SeatEngine } from './SeatEngine';
import { NightEngine } from './NightEngine';
import type { PlayerMessage } from '../../core/BroadcastService';

// =============================================================================
// Types
// =============================================================================

/** Configuration for HostEngine */
export interface HostEngineConfig {
  stateStore: StateStore;
  transport: Transport;
  storage: Storage;
  audio: Audio;

  /** Notify listeners of state changes */
  onNotifyListeners: () => void;
}

/** Callbacks for host events */
export interface HostEventCallbacks {
  /** Called when night starts */
  onNightStart?: () => void;

  /** Called when a role's turn begins */
  onRoleTurn?: (role: RoleId, pendingSeats: number[], schemaId?: string) => void;

  /** Called when night ends */
  onNightEnd?: (deaths: number[]) => void;
}

// =============================================================================
// HostEngine Implementation
// =============================================================================

export class HostEngine {
  private readonly config: HostEngineConfig;
  private readonly seatEngine: SeatEngine;
  private readonly nightEngine: NightEngine;
  private callbacks: HostEventCallbacks = {};

  // State revision counter
  private stateRevision: number = 0;

  constructor(config: HostEngineConfig) {
    this.config = config;
    this.seatEngine = new SeatEngine();
    this.nightEngine = new NightEngine();
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  /** Set event callbacks */
  setCallbacks(callbacks: HostEventCallbacks): void {
    this.callbacks = callbacks;
  }

  /** Get current state revision */
  getRevision(): number {
    return this.stateRevision;
  }

  // ---------------------------------------------------------------------------
  // Room Initialization
  // ---------------------------------------------------------------------------

  /**
   * Initialize a new game as Host
   */
  async initialize(roomCode: string, hostUid: string, template: GameTemplate): Promise<void> {
    const stateStore = this.config.stateStore;

    // Create initial players map
    const players = new Map<number, LocalPlayer | null>();
    for (let i = 1; i <= template.numberOfPlayers; i++) {
      players.set(i, null);
    }

    // Initialize state
    stateStore.initialize({
      roomCode,
      hostUid,
      status: GameStatus.unseated,
      template,
      players,
      actions: new Map(),
      wolfVotes: new Map(),
      currentActionerIndex: 0,
      isAudioPlaying: false,
      lastNightDeaths: [],
      currentNightResults: {},
    });

    this.stateRevision = 0;

    // Join broadcast channel
    await this.config.transport.joinRoom(roomCode, hostUid, {
      onHostBroadcast: () => {}, // Host ignores own broadcasts
      onPlayerMessage: (msg, senderId) => {
        this.handlePlayerMessage(msg, senderId).catch((err) =>
          hostLog.error('Error handling player message:', err)
        );
      },
      onPresenceChange: () => {
        this.broadcastState().catch((err) =>
          hostLog.error('Error broadcasting state on presence change:', err)
        );
      },
    });

    // Broadcast initial state
    await this.broadcastState();
    this.config.onNotifyListeners();

    hostLog.info('Initialized as Host for room:', roomCode);
  }

  /**
   * Rejoin an existing room as Host (recovery)
   */
  async rejoin(roomCode: string, hostUid: string): Promise<boolean> {
    const stateStore = this.config.stateStore;
    const storage = this.config.storage;

    // Try to recover state
    const savedState = await storage.load(roomCode);

    if (savedState) {
      stateStore.initialize(savedState);
      hostLog.info('Host state recovered from storage');
    } else {
      // Create placeholder state
      stateStore.initialize({
        roomCode,
        hostUid,
        status: GameStatus.unseated,
        template: { name: '恢复中...', numberOfPlayers: 0, roles: [] },
        players: new Map(),
        actions: new Map(),
        wolfVotes: new Map(),
        currentActionerIndex: 0,
        isAudioPlaying: false,
        lastNightDeaths: [],
        currentNightResults: {},
      });
      hostLog.warn('No saved state found, created placeholder');
    }

    // Join broadcast channel
    await this.config.transport.joinRoom(roomCode, hostUid, {
      onHostBroadcast: () => {},
      onPlayerMessage: (msg, senderId) => {
        this.handlePlayerMessage(msg, senderId).catch((err) =>
          hostLog.error('Error handling player message:', err)
        );
      },
      onPresenceChange: () => {
        this.broadcastState().catch((err) =>
          hostLog.error('Error broadcasting state on presence change:', err)
        );
      },
    });

    await this.broadcastState();
    this.config.onNotifyListeners();

    return savedState !== null;
  }

  // ---------------------------------------------------------------------------
  // Player Message Handling
  // ---------------------------------------------------------------------------

  /**
   * Handle incoming player message
   */
  async handlePlayerMessage(msg: PlayerMessage, senderId: string): Promise<void> {
    const state = this.config.stateStore.getState();
    if (!state) return;

    hostLog.debug('Host received:', msg.type, 'from:', senderId.substring(0, 8));

    switch (msg.type) {
      case 'REQUEST_STATE':
        await this.broadcastState();
        break;

      case 'JOIN':
        await this.handlePlayerJoin(msg.seat, msg.uid, msg.displayName, msg.avatarUrl);
        break;

      case 'LEAVE':
        await this.handlePlayerLeave(msg.seat, msg.uid);
        break;

      case 'ACTION':
        await this.handlePlayerAction(msg.seat, msg.role, msg.target);
        break;

      case 'WOLF_VOTE':
        await this.handleWolfVote(msg.seat, msg.target);
        break;

      case 'VIEWED_ROLE':
        await this.handleViewedRole(msg.seat);
        break;

      case 'SNAPSHOT_REQUEST':
        await this.handleSnapshotRequest(msg.requestId, msg.uid);
        break;

      default:
        hostLog.debug('Unhandled message type:', (msg as any).type);
    }
  }

  // ---------------------------------------------------------------------------
  // Seat Management
  // ---------------------------------------------------------------------------

  private async handlePlayerJoin(
    seat: number,
    uid: string,
    displayName?: string,
    avatarUrl?: string
  ): Promise<void> {
    const stateStore = this.config.stateStore;
    const state = stateStore.getState();
    if (!state) return;

    const result = this.seatEngine.sit(state, { seat, uid, displayName, avatarUrl });

    if (!result.success) {
      // Broadcast rejection
      await this.config.transport.broadcastAsHost({
        type: 'SEAT_REJECTED',
        seat,
        requestUid: uid,
        reason: 'seat_taken',
      });
      return;
    }

    // Apply updates
    if (result.updates) {
      stateStore.update(() => result.updates!);
    }

    await this.broadcastState();
    this.config.onNotifyListeners();
  }

  private async handlePlayerLeave(seat: number, uid: string): Promise<void> {
    const stateStore = this.config.stateStore;
    const state = stateStore.getState();
    if (!state) return;

    const result = this.seatEngine.standup(state, { seat, uid });

    if (!result.success) {
      hostLog.debug('Leave rejected:', result.reason);
      return;
    }

    if (result.updates) {
      stateStore.update(() => result.updates!);
    }

    await this.broadcastState();
    this.config.onNotifyListeners();
  }

  // ---------------------------------------------------------------------------
  // Action Handling
  // ---------------------------------------------------------------------------

  private async handlePlayerAction(
    seat: number,
    role: RoleId,
    target: number | null
  ): Promise<void> {
    const stateStore = this.config.stateStore;
    const state = stateStore.getState();
    if (!state || state.status !== GameStatus.ongoing) return;

    // Verify correct role's turn
    const currentRole = this.nightEngine.getCurrentStepInfo()?.roleId;
    if (currentRole !== role) {
      hostLog.debug('Wrong role acting:', role, 'expected:', currentRole);
      return;
    }

    // Record action
    if (target !== null) {
      stateStore.update((current) => ({
        actions: new Map(current.actions).set(role, makeActionTarget(target)),
      }));
      this.nightEngine.submitAction(target);
    }

    // Advance to next action
    await this.advanceToNextAction();
  }

  private async handleWolfVote(seat: number, target: number): Promise<void> {
    const stateStore = this.config.stateStore;
    const state = stateStore.getState();
    if (!state || state.status !== GameStatus.ongoing) return;

    const currentRole = this.nightEngine.getCurrentStepInfo()?.roleId;
    if (currentRole !== 'wolf') return;

    // Verify this is a wolf
    const player = state.players.get(seat);
    if (!player?.role || !isWolfRole(player.role)) return;

    // Record vote
    stateStore.update((current) => {
      const newWolfVotes = new Map(current.wolfVotes);
      newWolfVotes.set(seat, target);
      return { wolfVotes: newWolfVotes };
    });

    // Check if all wolves voted
    const updatedState = stateStore.getState()!;
    const allWolfSeats = this.getAllWolfSeats(updatedState);
    const allVoted = allWolfSeats.every((s) => updatedState.wolfVotes.has(s));

    if (allVoted) {
      await this.finalizeWolfVote(updatedState.wolfVotes);
    } else {
      await this.broadcastState();
      this.config.onNotifyListeners();
    }
  }

  private async handleViewedRole(seat: number): Promise<void> {
    const stateStore = this.config.stateStore;
    const state = stateStore.getState();
    if (!state || state.status !== GameStatus.assigned) return;

    const player = state.players.get(seat);
    if (!player) return;

    stateStore.update((current) => {
      const newPlayers = new Map(current.players);
      const existingPlayer = newPlayers.get(seat);
      if (existingPlayer) {
        newPlayers.set(seat, { ...existingPlayer, hasViewedRole: true });
      }
      return { players: newPlayers };
    });

    await this.broadcastState();
  }

  private async handleSnapshotRequest(requestId: string, uid: string): Promise<void> {
    const state = this.config.stateStore.getState();
    if (!state) return;

    const broadcastState = this.config.stateStore.toBroadcastState();
    await this.config.transport.broadcastAsHost({
      type: 'SNAPSHOT_RESPONSE',
      requestId,
      toUid: uid,
      state: broadcastState,
      revision: this.stateRevision,
    });
  }

  // ---------------------------------------------------------------------------
  // Game Flow Control
  // ---------------------------------------------------------------------------

  /**
   * Assign roles to players
   */
  async assignRoles(): Promise<void> {
    const stateStore = this.config.stateStore;
    const state = stateStore.getState();
    if (!state || state.status !== GameStatus.seated) return;

    const shuffledRoles = shuffleArray([...state.template.roles]);

    stateStore.update((current) => {
      const newPlayers = new Map(current.players);
      let index = 0;

      for (const [seatNum, player] of newPlayers.entries()) {
        if (player && index < shuffledRoles.length) {
          newPlayers.set(seatNum, { ...player, role: shuffledRoles[index] });
          index++;
        }
      }

      return { players: newPlayers, status: GameStatus.assigned };
    });

    await this.broadcastState();
    hostLog.info('Roles assigned');
  }

  /**
   * Start the game (begin first night)
   */
  async startGame(): Promise<void> {
    const state = this.config.stateStore.getState();
    if (!state || state.status !== GameStatus.ready) return;

    // Start night engine
    const nightInfo = this.nightEngine.start(state);
    if (!nightInfo) {
      hostLog.warn('Failed to start night engine');
      return;
    }

    this.config.stateStore.update(() => ({
      status: GameStatus.ongoing,
      currentActionerIndex: nightInfo.index,
    }));

    // Play night begin audio
    await this.config.audio.playNightBegin();
    this.nightEngine.onNightBeginAudioDone();

    // Start first role turn
    await this.startCurrentRoleTurn();
  }

  /**
   * Restart game with same template
   */
  async restartGame(): Promise<void> {
    const state = this.config.stateStore.getState();
    if (!state) return;

    if (state.status === GameStatus.unseated) {
      hostLog.warn('Cannot restart in unseated status');
      return;
    }

    this.nightEngine.reset();

    // Reset state keeping template and players
    this.config.stateStore.update((current) => {
      const newPlayers = new Map<number, LocalPlayer | null>();
      for (const [seatNum, player] of current.players.entries()) {
        if (player) {
          newPlayers.set(seatNum, { ...player, role: null, hasViewedRole: false });
        } else {
          newPlayers.set(seatNum, null);
        }
      }

      return {
        status: GameStatus.seated,
        players: newPlayers,
        actions: new Map(),
        wolfVotes: new Map(),
        currentActionerIndex: 0,
        lastNightDeaths: [],
        currentNightResults: {},
      };
    });

    await this.config.transport.broadcastAsHost({ type: 'GAME_RESTARTED' });
    await this.broadcastState();
    hostLog.info('Game restarted');
  }

  /**
   * Update template (before game starts)
   */
  async updateTemplate(newTemplate: GameTemplate): Promise<void> {
    const state = this.config.stateStore.getState();
    if (!state) return;

    if (state.status !== GameStatus.unseated && state.status !== GameStatus.seated) {
      hostLog.warn('Cannot update template after game starts');
      return;
    }

    const validationError = validateTemplateRoles(newTemplate.roles);
    if (validationError) {
      hostLog.warn('Invalid template:', validationError);
      return;
    }

    this.config.stateStore.update((current) => {
      // Rebuild players map for new size
      const newPlayers = new Map<number, LocalPlayer | null>();
      for (let i = 1; i <= newTemplate.numberOfPlayers; i++) {
        newPlayers.set(i, current.players.get(i) ?? null);
      }

      return { template: newTemplate, players: newPlayers };
    });

    await this.broadcastState();
    hostLog.info('Template updated:', newTemplate.name);
  }

  // ---------------------------------------------------------------------------
  // Night Phase
  // ---------------------------------------------------------------------------

  private async startCurrentRoleTurn(): Promise<void> {
    const stepInfo = this.nightEngine.getCurrentStepInfo();
    if (!stepInfo) {
      await this.endNight();
      return;
    }

    // Play role begin audio
    await this.config.audio.playRoleBegin(stepInfo.roleId);
    this.nightEngine.onRoleBeginAudioDone();

    // Get pending seats
    const state = this.config.stateStore.getState()!;
    const pendingSeats = this.getSeatsForRole(state, stepInfo.roleId);

    // Notify callback
    this.callbacks.onRoleTurn?.(stepInfo.roleId, pendingSeats, stepInfo.schemaId);

    // Broadcast role turn
    await this.config.transport.broadcastAsHost({
      type: 'ROLE_TURN',
      role: stepInfo.roleId,
      pendingSeats,
      stepId: stepInfo.schemaId as any, // schemaId is used as stepId in broadcast
    });

    await this.broadcastState();
  }

  private async advanceToNextAction(): Promise<void> {
    // Play role end audio
    const stepInfo = this.nightEngine.getCurrentStepInfo();
    if (stepInfo) {
      await this.config.audio.playRoleEnd(stepInfo.roleId);
    }
    this.nightEngine.onRoleEndAudioDone();

    // Clear wolf votes
    this.config.stateStore.update(() => ({ wolfVotes: new Map() }));

    // Start next role
    await this.startCurrentRoleTurn();
  }

  private async endNight(): Promise<void> {
    // Play night end audio
    await this.config.audio.playNightEnd();
    this.nightEngine.onNightEndAudioDone();

    // Calculate deaths (simplified - actual logic in DeathCalculator)
    const state = this.config.stateStore.getState()!;
    const deaths = this.calculateDeaths(state);

    this.config.stateStore.update(() => ({
      lastNightDeaths: deaths,
      status: GameStatus.ended,
    }));

    // Notify callback
    this.callbacks.onNightEnd?.(deaths);

    // Broadcast
    await this.config.transport.broadcastAsHost({
      type: 'NIGHT_END',
      deaths,
    });

    await this.broadcastState();
    this.config.onNotifyListeners();

    hostLog.info('Night ended. Deaths:', deaths);
  }

  // ---------------------------------------------------------------------------
  // State Broadcasting
  // ---------------------------------------------------------------------------

  private async broadcastState(): Promise<void> {
    const stateStore = this.config.stateStore;
    const state = stateStore.getState();
    if (!state) return;

    const broadcastState = stateStore.toBroadcastState();
    this.stateRevision++;

    await this.config.transport.broadcastAsHost({
      type: 'STATE_UPDATE',
      state: broadcastState,
      revision: this.stateRevision,
    });

    // Save to storage (fire and forget)
    this.config.storage.save(state.roomCode, state).catch((err) => {
      hostLog.warn('Failed to save state:', err);
    });
  }

  // ---------------------------------------------------------------------------
  // Helper Methods
  // ---------------------------------------------------------------------------

  private getAllWolfSeats(state: LocalGameState): number[] {
    const seats: number[] = [];
    for (const [seat, player] of state.players.entries()) {
      if (player?.role && isWolfRole(player.role)) {
        seats.push(seat);
      }
    }
    return seats;
  }

  private async finalizeWolfVote(wolfVotes: Map<number, number>): Promise<void> {
    // Find majority target
    const targetCounts = new Map<number, number>();
    for (const target of wolfVotes.values()) {
      targetCounts.set(target, (targetCounts.get(target) ?? 0) + 1);
    }

    let maxCount = 0;
    let finalTarget: number | null = null;
    for (const [target, count] of targetCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        finalTarget = target;
      }
    }

    if (finalTarget !== null) {
      const targetToRecord = finalTarget;
      this.config.stateStore.update((current) => {
        const newActions = new Map(current.actions);
        newActions.set('wolf', makeActionTarget(targetToRecord));
        return { actions: newActions };
      });

      this.nightEngine.submitAction(finalTarget);
    }

    await this.advanceToNextAction();
  }

  private getSeatsForRole(state: LocalGameState, role: RoleId): number[] {
    const seats: number[] = [];
    for (const [seat, player] of state.players.entries()) {
      if (player?.role === role) {
        seats.push(seat);
      }
    }
    return seats;
  }

  private calculateDeaths(_state: LocalGameState): number[] {
    // Simplified death calculation
    // Full implementation would use DeathCalculator
    // For now, just return empty array - actual logic will be added later
    return [];
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Reset engine state
   */
  reset(): void {
    this.nightEngine.reset();
    this.stateRevision = 0;
    this.callbacks = {};
  }
}
