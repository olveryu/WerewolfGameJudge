/**
 * GameFacade — UI Facade implementation.
 *
 * Responsibilities:
 * - Compose gameActions / seatActions sub-modules
 * - Manage lifecycle and identity state
 * - Expose unified public API
 * - Delegate audio orchestration to AudioOrchestrator
 * - Delegate connection lifecycle to ConnectionManager
 *
 * Not responsible for:
 * - Business logic / validation rules (all in handlers)
 * - Direct state mutation (all in reducers)
 * - Global singleton (getInstance/resetInstance removed)
 *
 * Boundary constraints:
 * - Created by composition root (App.tsx) via constructor DI
 * - Injected into component tree via GameFacadeContext
 * - Sub-module split: gameActions / seatActions / AudioOrchestrator / ConnectionManager
 *
 * @remarks leaveRoom cleanup order: (1) #aborted=true (2) audio stop (3) WS disconnect (4) store reset.
 *   #aborted=true is set immediately to signal ongoing async operations to abort.
 *   Subsequent async callbacks (audio ack, WS event handlers) check #aborted to decide whether to drop.
 */

import { WEREWOLF_STATE_CODEC, type WerewolfActionInput } from '@werewolf/game-engine';
import { type GameStore } from '@werewolf/game-engine/engine/store';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';
import type { ActionResult } from '@werewolf/game-engine/protocol/ActionResult';
import type { GameState } from '@werewolf/game-engine/protocol/types';
import { resolveRandomAnimation } from '@werewolf/game-engine/types/RoleRevealAnimation';

import type { ConnectionManager } from '@/services/connection/ConnectionManager';
import { ConnectionState } from '@/services/connection/types';
import { type AudioService } from '@/services/infra/AudioService';
import type { FacadeStateListener, IGameFacade, SeatProfile } from '@/services/types/IGameFacade';
import { ConnectionStatus } from '@/services/types/IGameFacade';
import type { SettleResultMessage } from '@/services/types/IRealtimeTransport';
import type { IRoomService, RoomIdentity } from '@/services/types/IRoomService';
import { handleError } from '@/utils/errorPipeline';
import { facadeLog } from '@/utils/logger';

import { AudioOrchestrator } from './AudioOrchestrator';
// Sub-modules
import type { GameActionsContext } from './gameActions';
import * as gameActions from './gameActions';
import { RoomCommandSession } from './roomCommandSession';
import type { SeatActionsContext } from './seatActions';
import * as seatActions from './seatActions';

/**
 * GameFacade injectable dependencies
 *
 * All fields required — explicitly created and injected by composition root (App.tsx).
 * Tests likewise explicitly pass mock instances.
 */
interface GameFacadeDeps {
  /** GameStore instance */
  store: GameStore;
  /** ConnectionManager instance (FSM-driven connection lifecycle) */
  connectionManager: ConnectionManager;
  /** AudioService instance */
  audioService: AudioService;
  /** RoomService instance (DB state persistence) */
  roomService: IRoomService;
}

interface SettlementDelivery {
  readonly result: SettleResultMessage;
  readonly fingerprint: string;
  isDelivered: boolean;
}

/** Map internal ConnectionState → UI ConnectionStatus */
function mapConnectionStatus(state: ConnectionState): ConnectionStatus {
  switch (state) {
    case ConnectionState.Connecting:
    case ConnectionState.Reconnecting:
      return ConnectionStatus.Connecting;
    case ConnectionState.Syncing:
      return ConnectionStatus.Syncing;
    case ConnectionState.Connected:
      return ConnectionStatus.Live;
    case ConnectionState.Idle:
    case ConnectionState.Disconnected:
    case ConnectionState.Disposed:
      return ConnectionStatus.Disconnected;
    case ConnectionState.Failed:
      return ConnectionStatus.Failed;
  }
}

/**
 * GameFacade — single entry point for UI layer, orchestrating room lifecycle, connection, state, audio.
 *
 * Responsibilities: coordinate ConnectionManager + GameStore + AudioService,
 * expose subscribe/getState API for hook consumption.
 *
 * Does not contain game rule logic.
 */
export class GameFacade implements IGameFacade {
  readonly #store: GameStore;
  readonly #connectionManager: ConnectionManager;
  readonly #audioService: AudioService;
  readonly #roomService: IRoomService;
  readonly #commandSession: RoomCommandSession<GameState>;
  readonly #audioOrchestrator: AudioOrchestrator;
  #isHost = false;
  #myUserId: string | null = null;
  /** Cached immutable room locator survives store.reset(). */
  #roomCode: string | null = null;
  #roomId: string | null = null;
  /** Settlement listeners and durable deliveries waiting for UI consumption. */
  readonly #settleResultListeners = new Set<(result: SettleResultMessage) => void>();
  readonly #settlementDeliveries = new Map<string, SettlementDelivery>();
  #settlementUserId: string | null = null;

  /**
   * Abort flag: set to true when leaving room.
   * Used to abort ongoing async operations (e.g., audio queue in AudioOrchestrator).
   * Reset to false when creating/joining a new room.
   */
  #aborted = false;

  /**
   * @param deps - Must be explicitly provided by composition root or tests.
   */
  constructor(deps: GameFacadeDeps) {
    this.#store = deps.store;
    this.#connectionManager = deps.connectionManager;
    this.#audioService = deps.audioService;
    this.#roomService = deps.roomService;
    this.#commandSession = new RoomCommandSession({
      codec: WEREWOLF_STATE_CODEC,
      store: deps.store,
    });

    // Audio orchestration: reactive playback + ack retry
    this.#audioOrchestrator = new AudioOrchestrator({
      store: deps.store,
      audioService: deps.audioService,
      addStatusListener: (fn) => this.addConnectionStatusListener(fn),
      getActionsContext: () => this.#getActionsContext(),
      isHost: () => this.#isHost,
      isAborted: () => this.#aborted,
    });
    this.#connectionManager.addStateListener((state) => {
      if (state === ConnectionState.Connected) this.#acknowledgeDeliveredSettlements();
    });
  }

  // =========================================================================
  // Lifecycle
  // =========================================================================

  addListener(fn: FacadeStateListener): () => void {
    const unsub = this.#store.subscribe((_state, _rev) => {
      fn(this.#store.getState());
    });
    return unsub;
  }

  subscribe(onStoreChange: () => void): () => void {
    return this.#store.subscribe(() => onStoreChange());
  }

  getState(): GameState | null {
    return this.#store.getState();
  }

  // =========================================================================
  // Identity (derived from store, not self-maintained)
  // =========================================================================

  isHostPlayer(): boolean {
    return this.#isHost;
  }

  getMyUserId(): string | null {
    return this.#myUserId;
  }

  /**
   * Safety net: update cached userId when auth identity changes.
   *
   * Phase A prevents userId changes during anonymous→register (identity linking).
   * This covers edge cases like signOut → signIn with a different account
   * while the room screen remains mounted (modal Settings).
   */
  updateMyUserId(newUid: string): void {
    if (this.#myUserId && this.#myUserId !== newUid) {
      facadeLog.info('updateMyUserId: userId changed', {
        old: this.#myUserId,
        new: newUid,
      });
    }
    this.#activateSettlementUser(newUid);
    this.#myUserId = newUid;
    if (this.#roomCode !== null && this.#roomId !== null) {
      this.#commandSession.enterRoom({ roomCode: this.#roomCode, roomId: this.#roomId }, newUid);
    } else if (this.#roomCode !== null || this.#roomId !== null) {
      throw new Error('[FAIL-FAST] Cached room locator is incomplete');
    }
  }

  getMySeat(): number | null {
    const state = this.#store.getState();
    if (!state || !this.#myUserId) return null;
    for (const [seatStr, player] of Object.entries(state.players)) {
      if (player?.userId === this.#myUserId) {
        return Number.parseInt(seatStr, 10);
      }
    }
    return null;
  }

  getStateRevision(): number {
    return this.#store.getRevision();
  }

  consumeLastCommandType(): string | null {
    return this.#store.consumeLastCommandType();
  }

  /**
   * Receives WebSocket SETTLE_RESULT message, pushes to all subscribers.
   * Called by ConnectionManager onSettleResult callback.
   */
  handleSettleResult(result: SettleResultMessage): void {
    if (this.#settlementUserId === null) {
      throw new Error('[FAIL-FAST] Settlement event arrived without an active user identity');
    }
    const fingerprint = JSON.stringify(result);
    const existing = this.#settlementDeliveries.get(result.eventId);
    if (existing !== undefined) {
      if (existing.fingerprint !== fingerprint) {
        throw new Error(`Settlement event ${result.eventId} changed across deliveries`);
      }
      if (existing.isDelivered) {
        this.#connectionManager.acknowledgeUserEvent(result.eventId);
        return;
      }
    } else {
      this.#settlementDeliveries.set(result.eventId, {
        result,
        fingerprint,
        isDelivered: false,
      });
    }
    this.#deliverPendingSettlements();
  }

  addSettleResultListener(fn: (result: SettleResultMessage) => void): () => void {
    this.#settleResultListeners.add(fn);
    this.#deliverPendingSettlements();
    return () => {
      this.#settleResultListeners.delete(fn);
    };
  }

  addConnectionStatusListener(fn: (status: ConnectionStatus) => void): () => void {
    return this.#connectionManager.addStateListener((state) => {
      fn(mapConnectionStatus(state));
    });
  }

  /**
   * Manual reconnect: user clicked "reconnect" button.
   * Delegates to ConnectionManager FSM (MANUAL_RECONNECT event).
   */
  manualReconnect(): void {
    if (this.#aborted) return;
    this.#connectionManager.manualReconnect();
  }

  /**
   * Number of internal store listeners registered in constructor.
   * Must update this value when adding/removing store.subscribe() in constructor.
   */
  static readonly #internalStoreListenerCount = 1;

  /**
   * Get current external listener count (for testing/debugging only).
   * Excludes constructor internal reactive subscriptions.
   */
  getListenerCount(): number {
    return this.#store.getListenerCount() - GameFacade.#internalStoreListenerCount;
  }

  // =========================================================================
  // Room Lifecycle
  // =========================================================================

  /** Connect one resolved room identity; creation and re-entry share this path. */
  async enterRoom(room: RoomIdentity, userId: string): Promise<void> {
    if (room.gameType !== 'werewolf') {
      throw new Error(`Werewolf facade cannot enter ${room.gameType}`);
    }
    const { roomCode, roomId } = room;
    const isHost = room.hostUserId === userId;
    facadeLog.info('enterRoom', { roomCode, isHost });
    this.#aborted = false;
    this.#audioOrchestrator.reset();
    this.#settleResultListeners.clear();
    this.#isHost = isHost;
    this.#activateSettlementUser(userId);
    this.#myUserId = userId;
    this.#commandSession.enterRoom({ roomCode, roomId }, userId);

    // Only reset store when switching rooms; same-room rejoin keeps cached state
    // (connectAndWait will fetch latest from DB regardless)
    if (roomCode !== this.#roomCode || roomId !== this.#roomId) {
      this.#store.reset();
    }
    this.#roomCode = roomCode;
    this.#roomId = roomId;

    // Host rejoin: preset guard to block reactive mis-playback when receiving pendingAudioEffects during subscribe phase
    if (isHost) this.#audioOrchestrator.setWasAudioInterrupted(true);

    // connectAndWait: WS connection + fetchDB + wait for Connected
    // FSM Syncing phase auto-fetches DB -> onFetchedState -> store.applySnapshot
    await this.#connectionManager.connectAndWait({ roomCode, roomId }, userId);

    // After connectAndWait, store must contain the state referenced by the active directory row.
    const dbState = this.#store.getState();
    if (dbState === null) {
      this.#audioOrchestrator.setWasAudioInterrupted(false);
      await this.leaveRoom();
      throw new Error('[FAIL-FAST] Active room connection completed without a server snapshot');
    }
    if (
      dbState.roomCode !== room.roomCode ||
      dbState.gameType !== room.gameType ||
      dbState.hostUserId !== room.hostUserId
    ) {
      await this.leaveRoom();
      throw new Error('[FAIL-FAST] Room directory metadata does not match its snapshot');
    }
    if (isHost) {
      this.#audioOrchestrator.setWasAudioInterrupted(dbState.status === GameStatus.Ongoing);
    }
  }

  /**
   * Whether audio was interrupted after Host rejoin (cached isAudioPlaying === true)
   * UI layer reads this to decide if "resume game" overlay needs to replay current step audio.
   */
  get wasAudioInterrupted(): boolean {
    return this.#audioOrchestrator.wasAudioInterrupted;
  }

  /**
   * Called after Host rejoin + user clicks "resume game".
   * Triggers user gesture -> unlocks Web AudioContext.
   * Delegates to AudioOrchestrator for audio replay and ack.
   */
  async resumeAfterRejoin(): Promise<void> {
    facadeLog.debug('resumeAfterRejoin');
    return this.#audioOrchestrator.resumeAfterRejoin();
  }

  // =========================================================================
  // Progression (Host-only, wolf vote deadline)
  // =========================================================================

  /**
   * Host: triggers server-side progression after wolf vote deadline expires.
   *
   * Called when client countdown expires, server executes inline progression.
   */
  async postProgression(): Promise<ActionResult> {
    facadeLog.debug('postProgression');
    return gameActions.postProgression(this.#getActionsContext());
  }

  async leaveRoom(): Promise<void> {
    facadeLog.info('leaveRoom');
    // Set abort flag FIRST to stop any ongoing async operations (e.g., audio queue)
    this.#aborted = true;
    this.#audioOrchestrator.reset();
    this.#commandSession.leaveRoom();

    // Don't auto-unseat — player recovers original seat by UID when returning to room

    // Stop currently playing audio and release preloaded audio to free memory
    this.#audioService.stop();
    this.#audioService.stopBgm();
    this.#audioService.clearPreloaded();

    this.#connectionManager.disconnect();
    this.#store.reset();
    this.#myUserId = null;
    this.#isHost = false;
    this.#roomCode = null;
    this.#roomId = null;
    this.#settleResultListeners.clear();
  }

  // =========================================================================
  // Seating (delegated to seatActions)
  // =========================================================================

  async takeSeat(seat: number, profile: SeatProfile): Promise<ActionResult> {
    return seatActions.takeSeat(
      this.#getSeatActionsContext(),
      seat,
      this.#resolveProfileEffect(profile),
    );
  }

  async leaveSeat(): Promise<ActionResult> {
    return seatActions.leaveSeat(this.#getSeatActionsContext());
  }

  async kickPlayer(targetSeat: number): Promise<ActionResult> {
    return seatActions.kickPlayer(this.#getSeatActionsContext(), targetSeat);
  }

  // =========================================================================
  // Game Control (delegated to gameActions)
  // =========================================================================

  async assignRoles(): Promise<ActionResult> {
    return gameActions.assignRoles(this.#getActionsContext());
  }

  async updateTemplate(template: GameTemplate): Promise<ActionResult> {
    return gameActions.updateTemplate(this.#getActionsContext(), template);
  }

  async markViewedRole(controlledSeat: number | null): Promise<ActionResult> {
    return gameActions.markViewedRole(this.#getActionsContext(), controlledSeat);
  }

  async startNight(): Promise<ActionResult> {
    return gameActions.startNight(this.#getActionsContext());
  }

  /**
   * Host: restart game (HTTP API)
   *
   * Server resets state -> WS broadcast pushes new state to all clients.
   */
  async restartGame(): Promise<ActionResult> {
    // Stop current audio then release preloaded resources (stop before clearPreloaded)
    this.#audioService.stop();
    this.#audioService.clearPreloaded();
    // Server validates hostUserId, client no longer does redundant gating
    return gameActions.restartGame(this.#getActionsContext());
  }

  // =========================================================================
  // Debug Mode: Fill With Bots (delegated to gameActions)
  // =========================================================================

  /**
   * Host: fill with bots (Debug-only)
   *
   * Creates bot players for all empty seats, sets debugMode.botsEnabled = true.
   * Only available when isHost && status === Unseated.
   */
  async fillWithBots(): Promise<ActionResult> {
    return gameActions.fillWithBots(this.#getActionsContext());
  }

  /**
   * Host: mark all bots as having viewed roles (Debug-only)
   *
   * Sets hasViewedRole = true only for isBot === true players.
   * Only available when debugMode.botsEnabled === true && status === Assigned.
   */
  async markAllBotsViewed(): Promise<ActionResult> {
    return gameActions.markAllBotsViewed(this.#getActionsContext());
  }

  /**
   * Host: mark all bots as having confirmed groupConfirm step (Debug-only)
   *
   * Batch-submits groupConfirm ack for all isBot players.
   * Only available when debugMode.botsEnabled === true && status === Ongoing && current step is groupConfirm.
   */
  async markAllBotsGroupConfirmed(): Promise<ActionResult> {
    return gameActions.markAllBotsGroupConfirmed(this.#getActionsContext());
  }

  /**
   * Host: unseat all
   *
   * Clears all seated players. Only available in unseated/seated status.
   */
  async clearAllSeats(): Promise<ActionResult> {
    return gameActions.clearAllSeats(this.#getActionsContext());
  }

  /**
   * Sync player profile to GameState (any seated player)
   *
   * Called after user changes name/avatar in SettingsScreen, broadcasts new profile to all clients.
   * If not seated, server returns NOT_SEATED (silently ignore).
   */
  async updatePlayerProfile(
    displayName?: string,
    avatarUrl?: string,
    avatarFrame?: string,
    seatFlair?: string,
    nameStyle?: string,
    roleRevealEffect?: string,
    seatAnimation?: string,
  ): Promise<ActionResult> {
    return gameActions.updatePlayerProfile(
      this.#getActionsContext(),
      displayName,
      avatarUrl,
      avatarFrame,
      seatFlair,
      nameStyle,
      this.#resolveEffect(roleRevealEffect),
      seatAnimation,
    );
  }

  /**
   * Host: share "detailed info" to specified seats
   *
   * In ended phase, Host selects seats allowed to view night action details.
   */
  async shareNightReview(allowedSeats: number[]): Promise<ActionResult> {
    return gameActions.shareNightReview(this.#getActionsContext(), allowedSeats);
  }

  // =========================================================================
  // Board Nomination (delegated to gameActions)
  // =========================================================================

  async boardNominate(displayName: string, roles: RoleId[]): Promise<ActionResult> {
    return gameActions.boardNominate(this.#getActionsContext(), displayName, roles);
  }

  async boardUpvote(targetUserId: string): Promise<ActionResult> {
    return gameActions.boardUpvote(this.#getActionsContext(), targetUserId);
  }

  async boardWithdraw(): Promise<ActionResult> {
    return gameActions.boardWithdraw(this.#getActionsContext());
  }

  // =========================================================================
  // Night Actions (delegated to gameActions)
  // =========================================================================

  /**
   * Submit night action (HTTP API)
   *
   * Host and Player both use HTTP API uniformly.
   * Progression triggered internally by gameActions.submitAction (Host only).
   */
  async submitAction(
    input: WerewolfActionInput,
    controlledSeat: number | null,
  ): Promise<ActionResult> {
    return gameActions.submitAction(this.#getActionsContext(), input, controlledSeat);
  }

  /**
   * Submit reveal confirmation (seer/psychic/gargoyle/wolfRobot) (HTTP API)
   *
   * Host/Player both call HTTP API uniformly
   */
  async submitRevealAck(controlledSeat: number | null): Promise<ActionResult> {
    return gameActions.submitRevealAck(this.#getActionsContext(), controlledSeat);
  }

  /**
   * Submit groupConfirm ack (hypnotize confirmation "I understand") (HTTP API)
   *
   * Any player can call. Server auto-progresses step after receiving all player acks.
   */
  async submitGroupConfirmAck(controlledSeat: number | null): Promise<ActionResult> {
    return gameActions.submitGroupConfirmAck(this.#getActionsContext(), controlledSeat);
  }

  // =========================================================================
  // Sync
  // =========================================================================

  /**
   * Submit wolfRobot hunter status view confirmation (HTTP API)
   *
   * Host/Player both call HTTP API uniformly
   *
   * @param controlledSeat - bot seat controlled by Host, or null for the authenticated player
   */
  async sendWolfRobotHunterStatusViewed(controlledSeat: number | null): Promise<ActionResult> {
    return gameActions.setWolfRobotHunterStatusViewed(this.#getActionsContext(), controlledSeat);
  }

  /**
   * Read latest state directly from DB (auto-heal / reconnect fallback)
   * Server-authoritative — direct SELECT from rooms, bypasses broadcast channel.
   * Used by both Host and Player.
   */
  async fetchStateFromDB(): Promise<boolean> {
    if (this.#roomCode === null && this.#roomId === null) return false;
    if (this.#roomCode === null || this.#roomId === null) {
      throw new Error('[FAIL-FAST] Cached room locator is incomplete');
    }
    const stateRoomCode = this.#store.getState()?.roomCode;
    if (stateRoomCode !== undefined && stateRoomCode !== this.#roomCode) {
      throw new Error('[FAIL-FAST] Cached room locator does not match the current state');
    }
    const room = { roomCode: this.#roomCode, roomId: this.#roomId };

    try {
      const dbState = await this.#roomService.getGameState(room);
      if (dbState) {
        this.#store.applySnapshot(dbState.state, dbState.revision);
        this.#connectionManager.updateRevision(dbState.revision);
        return true;
      }
      return false;
    } catch (e) {
      handleError(e, { label: 'fetchStateFromDB', logger: facadeLog, feedback: false });
      return false;
    }
  }

  // =========================================================================
  // Night Flow (delegated to gameActions) - PR6
  // =========================================================================

  /**
   * Host: set audio playing state
   *
   * PR7: audio timing control
   * - When audio starts playing, call setAudioPlaying(true)
   * - When audio ends (or is skipped), call setAudioPlaying(false)
   */
  async setAudioPlaying(isPlaying: boolean): Promise<ActionResult> {
    return gameActions.setAudioPlaying(this.#getActionsContext(), isPlaying);
  }

  // =========================================================================
  // Context Builders (provide context for sub-modules)
  // =========================================================================

  #getActionsContext(): GameActionsContext {
    return {
      store: this.#store,
      audioService: this.#audioService,
      commands: this.#commandSession,
    };
  }

  #getSeatActionsContext(): SeatActionsContext {
    return {
      store: this.#store,
      commands: this.#commandSession,
    };
  }

  #activateSettlementUser(userId: string): void {
    if (this.#settlementUserId === userId) return;
    this.#settlementDeliveries.clear();
    this.#settlementUserId = userId;
  }

  #deliverPendingSettlements(): void {
    if (this.#settleResultListeners.size === 0) return;

    for (const [eventId, delivery] of this.#settlementDeliveries) {
      if (delivery.isDelivered) continue;
      let didFail = false;
      for (const listener of this.#settleResultListeners) {
        try {
          listener(delivery.result);
        } catch (error) {
          didFail = true;
          facadeLog.error('SettleResult listener error', error);
        }
      }
      if (didFail) continue;
      delivery.isDelivered = true;
      this.#connectionManager.acknowledgeUserEvent(eventId);
    }
  }

  #acknowledgeDeliveredSettlements(): void {
    for (const [eventId, delivery] of this.#settlementDeliveries) {
      if (delivery.isDelivered) this.#connectionManager.acknowledgeUserEvent(eventId);
    }
  }

  /**
   * Resolve 'random' equippedEffect to a concrete animation ID.
   * Uses roomCode + userId as seed for deterministic per-room selection.
   */
  #resolveEffect(effect: string | undefined): string | undefined {
    if (effect !== 'random') return effect;
    const roomCode = this.#store.getState()?.roomCode ?? '';
    return resolveRandomAnimation(roomCode + this.#myUserId);
  }

  #resolveProfileEffect(profile: SeatProfile): SeatProfile {
    if (profile.roleRevealEffect !== 'random') return profile;
    return { ...profile, roleRevealEffect: this.#resolveEffect('random') };
  }
}
