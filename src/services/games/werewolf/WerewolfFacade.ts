/**
 * WerewolfFacade — UI Facade implementation.
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
 * - Injected into component tree via RoomFacadeContext
 * - Sub-module split: gameActions / seatActions / AudioOrchestrator / ConnectionManager
 *
 * @remarks leaveRoom cleanup order: (1) #aborted=true (2) audio stop (3) WS disconnect (4) store reset.
 *   #aborted=true is set immediately to signal ongoing async operations to abort.
 *   Subsequent async callbacks (audio ack, WS event handlers) check #aborted to decide whether to drop.
 */

import { resolveRandomAnimation } from '@werewolf/game-engine/cosmetics/roleRevealEffects';
import type { ActionResult } from '@werewolf/game-engine/protocol/ActionResult';
import { GameStatus } from '@werewolf/game-engine/werewolf/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/werewolf/models/roles';
import type { GameTemplate } from '@werewolf/game-engine/werewolf/models/Template';
import type { WerewolfState } from '@werewolf/game-engine/werewolf/protocol/types';
import { type WerewolfStore } from '@werewolf/game-engine/werewolf/store';

import type { ConnectionManager } from '@/services/connection/ConnectionManager';
import { ConnectionState } from '@/services/connection/types';
import type {
  FacadeStateListener,
  IWerewolfFacade,
  SeatProfile,
} from '@/services/games/werewolf/IWerewolfFacade';
import { type AudioService } from '@/services/infra/AudioService';
import { ConnectionStatus } from '@/services/room/ConnectionStatus';
import type { SettleResultMessage } from '@/services/types/IRealtimeTransport';
import type { IRoomService } from '@/services/types/IRoomService';
import { handleError } from '@/utils/errorPipeline';
import { facadeLog } from '@/utils/logger';

import { AudioOrchestrator } from './AudioOrchestrator';
// Sub-modules
import type { GameActionsContext } from './gameActions';
import * as gameActions from './gameActions';
import type { SeatActionsContext } from './seatActions';
import * as seatActions from './seatActions';

/**
 * WerewolfFacade injectable dependencies
 *
 * All fields required — explicitly created and injected by composition root (App.tsx).
 * Tests likewise explicitly pass mock instances.
 */
interface WerewolfFacadeDeps {
  /** WerewolfStore instance */
  store: WerewolfStore;
  /** ConnectionManager instance (FSM-driven connection lifecycle) */
  connectionManager: ConnectionManager;
  /** AudioService instance */
  audioService: AudioService;
  /** RoomService instance (DB state persistence) */
  roomService: IRoomService;
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
 * WerewolfFacade — single entry point for UI layer, orchestrating room lifecycle, connection, state, audio.
 *
 * Responsibilities: coordinate ConnectionManager + WerewolfStore + AudioService,
 * expose subscribe/getState API for hook consumption.
 *
 * Does not contain game rule logic.
 */
export class WerewolfFacade implements IWerewolfFacade {
  readonly #store: WerewolfStore;
  readonly #connectionManager: ConnectionManager;
  readonly #audioService: AudioService;
  readonly #roomService: IRoomService;
  readonly #audioOrchestrator: AudioOrchestrator;
  #isHost = false;
  #myUserId: string | null = null;
  /** Cached roomCode: survives store.reset(), used by fetchStateFromDB fallback */
  #roomCode: string | null = null;
  /** Settle result listeners (push-based, no buffer needed) */
  readonly #settleResultListeners = new Set<(result: SettleResultMessage) => void>();

  /**
   * Abort flag: set to true when leaving room.
   * Used to abort ongoing async operations (e.g., audio queue in AudioOrchestrator).
   * Reset to false when creating/joining a new room.
   */
  #aborted = false;

  /**
   * @param deps - Must be explicitly provided by composition root or tests.
   */
  constructor(deps: WerewolfFacadeDeps) {
    this.#store = deps.store;
    this.#connectionManager = deps.connectionManager;
    this.#audioService = deps.audioService;
    this.#roomService = deps.roomService;

    // Audio orchestration: reactive playback + ack retry
    this.#audioOrchestrator = new AudioOrchestrator({
      store: deps.store,
      audioService: deps.audioService,
      addStatusListener: (fn) => this.addConnectionStatusListener(fn),
      getActionsContext: () => this.#getActionsContext(),
      isHost: () => this.#isHost,
      isAborted: () => this.#aborted,
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

  getState(): WerewolfState | null {
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
    this.#myUserId = newUid;
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

  consumeLastAction(): string | null {
    return this.#store.consumeLastAction();
  }

  /**
   * Receives WebSocket SETTLE_RESULT message, pushes to all subscribers.
   * Called by ConnectionManager onSettleResult callback.
   */
  handleSettleResult(result: SettleResultMessage): void {
    for (const fn of this.#settleResultListeners) {
      try {
        fn(result);
      } catch (e) {
        facadeLog.error('SettleResult listener error', e);
      }
    }
  }

  addSettleResultListener(fn: (result: SettleResultMessage) => void): () => void {
    this.#settleResultListeners.add(fn);
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
    return this.#store.getListenerCount() - WerewolfFacade.#internalStoreListenerCount;
  }

  // =========================================================================
  // Room Lifecycle
  // =========================================================================

  async connectCreatedRoom(roomCode: string, hostUserId: string): Promise<void> {
    facadeLog.info('connectCreatedRoom', { roomCode });
    this.#aborted = false;
    this.#audioOrchestrator.reset();
    this.#settleResultListeners.clear();
    this.#isHost = true;
    this.#myUserId = hostUserId;
    this.#roomCode = roomCode;

    // Connect WS + wait for Connected (FSM: Idle -> Connecting -> Syncing -> Connected)
    await this.#connectionManager.connectAndWait(roomCode, hostUserId);

    if (!this.#store.getState()) {
      throw new Error('created_room_snapshot_missing');
    }
  }

  /**
   * Join existing room (unified entry for Host rejoin + Player join)
   *
   * connectAndWait() does WS connection + auto fetchDB (FSM Syncing -> Connected).
   * Host rejoin presets #wasAudioInterrupted guard to block reactive mis-playback.
   *
   * @returns success=false only when Host rejoin has no DB state
   */
  async joinRoom(roomCode: string, userId: string, isHost: boolean): Promise<ActionResult> {
    facadeLog.info('joinRoom', { roomCode, isHost });
    this.#aborted = false;
    this.#audioOrchestrator.reset();
    this.#settleResultListeners.clear();
    this.#isHost = isHost;
    this.#myUserId = userId;

    // Only reset store when switching rooms; same-room rejoin keeps cached state
    // (connectAndWait will fetch latest from DB regardless)
    if (roomCode !== this.#roomCode) {
      this.#store.reset();
    }
    this.#roomCode = roomCode;

    // Host rejoin: preset guard to block reactive mis-playback when receiving pendingAudioEffects during subscribe phase
    if (isHost) this.#audioOrchestrator.setWasAudioInterrupted(true);

    // connectAndWait: WS connection + fetchDB + wait for Connected
    // FSM Syncing phase auto-fetches DB -> onFetchedState -> store.applySnapshot
    await this.#connectionManager.connectAndWait(roomCode, userId);

    // After connectAndWait, store should have state from DB (if any)
    const dbState = this.#store.getState();

    if (dbState) {
      if (isHost) {
        this.#audioOrchestrator.setWasAudioInterrupted(dbState.status === GameStatus.Ongoing);
      }
    } else if (isHost) {
      // Host rejoin with no DB state: cannot recover
      this.#audioOrchestrator.setWasAudioInterrupted(false);
      this.#isHost = false;
      this.#myUserId = null;
      facadeLog.warn('Host rejoin failed: no DB state');
      return { success: false, reason: 'no_db_state' };
    }

    return { success: true };
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
    this.#settleResultListeners.clear();
  }

  // =========================================================================
  // Seating (delegated to seatActions)
  // =========================================================================

  async takeSeat(seat: number, profile: SeatProfile): Promise<boolean> {
    return seatActions.takeSeat(
      this.#getSeatActionsContext(),
      seat,
      this.#resolveProfileEffect(profile),
    );
  }

  async takeSeatWithAck(seat: number, profile: SeatProfile): Promise<ActionResult> {
    return seatActions.takeSeatWithAck(
      this.#getSeatActionsContext(),
      seat,
      this.#resolveProfileEffect(profile),
    );
  }

  async leaveSeat(): Promise<boolean> {
    return seatActions.leaveSeat(this.#getSeatActionsContext());
  }

  async leaveSeatWithAck(): Promise<ActionResult> {
    return seatActions.leaveSeatWithAck(this.#getSeatActionsContext());
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

  async markViewedRole(seat: number): Promise<ActionResult> {
    // Host and Player both use HTTP API uniformly
    return gameActions.markViewedRole(this.#getActionsContext(), seat);
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
   * Sync player profile to WerewolfState (any seated player)
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
    seat: number,
    role: RoleId,
    target: number | null,
    extra?: unknown,
  ): Promise<ActionResult> {
    return gameActions.submitAction(this.#getActionsContext(), seat, role, target, extra);
  }

  /**
   * Submit reveal confirmation (seer/psychic/gargoyle/wolfRobot) (HTTP API)
   *
   * Host/Player both call HTTP API uniformly
   */
  async submitRevealAck(): Promise<ActionResult> {
    return gameActions.clearRevealAcks(this.#getActionsContext());
  }

  /**
   * Submit groupConfirm ack (hypnotize confirmation "I understand") (HTTP API)
   *
   * Any player can call. Server auto-progresses step after receiving all player acks.
   */
  async submitGroupConfirmAck(seat: number): Promise<ActionResult> {
    return gameActions.submitGroupConfirmAck(this.#getActionsContext(), seat);
  }

  // =========================================================================
  // Sync
  // =========================================================================

  /**
   * Submit wolfRobot hunter status view confirmation (HTTP API)
   *
   * Host/Player both call HTTP API uniformly
   *
   * @param seat - wolfRobot's seat number (caller passes effectiveSeat to support debug bot takeover)
   */
  async sendWolfRobotHunterStatusViewed(seat: number): Promise<ActionResult> {
    return gameActions.setWolfRobotHunterStatusViewed(this.#getActionsContext(), seat);
  }

  /**
   * Read latest state directly from DB (auto-heal / reconnect fallback)
   * Server-authoritative — direct SELECT from rooms, bypasses broadcast channel.
   * Used by both Host and Player.
   */
  async fetchStateFromDB(): Promise<boolean> {
    const roomCode = this.#store.getState()?.roomCode ?? this.#roomCode;
    if (!roomCode) return false;

    try {
      const dbState = await this.#roomService.getGameState(roomCode);
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
      myUserId: this.#myUserId,
      getMySeat: () => this.getMySeat(),
      audioService: this.#audioService,
    };
  }

  #getSeatActionsContext(): SeatActionsContext {
    return {
      myUserId: this.#myUserId,
      getRoomCode: () => this.#store.getState()?.roomCode ?? null,
      store: this.#store,
    };
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
