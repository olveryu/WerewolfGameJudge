/**
 * IWerewolfFacade — Werewolf UI facade contract.
 *
 * Covers Werewolf room lifecycle, seating, game control, night actions, and settlement events.
 * Facade only orchestrates client IO; server-side game logic remains authoritative.
 */

import type { ActionResult } from '@werewolf/game-engine/protocol/ActionResult';
import type { RoleId } from '@werewolf/game-engine/werewolf/models/roles';
import type { GameTemplate } from '@werewolf/game-engine/werewolf/models/Template';
import type { WerewolfState } from '@werewolf/game-engine/werewolf/protocol/types';

import { type ConnectionStatus } from '@/services/room/ConnectionStatus';
import type { SettleResultMessage } from '@/services/types/IRealtimeTransport';

/** Player profile info carried when taking a seat */
export interface SeatProfile {
  displayName: string;
  avatarUrl?: string;
  avatarFrame?: string;
  seatFlair?: string;
  nameStyle?: string;
  level?: number;
  roleRevealEffect?: string;
  seatAnimation?: string;
}

/** State change listener type. */
export type FacadeStateListener = (state: WerewolfState | null) => void;

/** WerewolfFacade public interface — sole Werewolf room contract for UI layer interaction. */
export interface IWerewolfFacade {
  // === Lifecycle ===
  /**
   * Subscribe to state changes
   * @returns unsubscribe function
   */
  addListener(fn: FacadeStateListener): () => void;

  /**
   * Get current state (one-time read)
   */
  getState(): WerewolfState | null;

  /**
   * Subscribe to store change notifications (for useSyncExternalStore).
   * @param onStoreChange - React re-render trigger; do NOT read state inside.
   * @returns Unsubscribe function.
   */
  subscribe(onStoreChange: () => void): () => void;

  // === Identity ===
  /** Whether current user is Host */
  isHostPlayer(): boolean;

  /** Current user UID */
  getMyUserId(): string | null;

  /**
   * Safety net: update cached userId when auth identity changes.
   * Ensures facade identity stays in sync with auth state.
   */
  updateMyUserId(newUid: string): void;

  /**
   * Current user seat number
   * Derived from state, not self-maintained
   */
  getMySeat(): number | null;

  /**
   * State version number
   * Store is the single source of truth
   */
  getStateRevision(): number;

  /**
   * Consume last broadcast's lastAction (one-time read, cleared after read)
   * Used by client to detect passive operations (kick/clearAllSeats/assignRoles etc.) and show toast
   */
  consumeLastAction(): string | null;

  /**
   * Subscribe to settlement result push (SETTLE_RESULT WebSocket unicast)
   * @returns unsubscribe function
   */
  addSettleResultListener(fn: (result: SettleResultMessage) => void): () => void;

  // === Room Lifecycle ===
  /**
   * Host: connect to a room already created by /room/create.
   *
   * The server builds the authoritative initial WerewolfState; facade only connects
   * and applies the snapshot fetched by ConnectionManager.
   */
  connectCreatedRoom(roomCode: string, hostUserId: string): Promise<void>;

  /**
   * Join existing room (unified entry for Host rejoin + Player join)
   *
   * Host rejoin: isHost=true, recover state from DB, detect _wasAudioInterrupted
   * Player join: isHost=false, read initial state from DB
   *
   * @returns success=false only when Host rejoin has no DB state
   */
  joinRoom(roomCode: string, userId: string, isHost: boolean): Promise<ActionResult>;

  /**
   * Leave room
   */
  leaveRoom(): Promise<void>;

  // === Seating ===
  /**
   * Take seat
   * Unified HTTP API, server-processed
   */
  takeSeat(seat: number, profile: SeatProfile): Promise<boolean>;

  /**
   * Take seat (with ACK wait)
   * Unified HTTP API, waits for server response
   * @returns success + reason (passthrough of server rejection reason)
   */
  takeSeatWithAck(seat: number, profile: SeatProfile): Promise<ActionResult>;
  /**
   * Leave seat
   * Unified HTTP API, server-processed
   */
  leaveSeat(): Promise<boolean>;

  /**
   * Leave seat (with ACK wait)
   * Unified HTTP API, waits for server response
   * @returns success + reason (passthrough of server rejection reason)
   */
  leaveSeatWithAck(): Promise<ActionResult>;

  /**
   * Kick player from seat (Host-only)
   * Only available in Unseated/Seated phase
   */
  kickPlayer(targetSeat: number): Promise<ActionResult>;

  // === Game Control (Host-only) ===
  /**
   * Assign roles
   */
  assignRoles(): Promise<ActionResult>;

  /**
   * Update template (Host only, only in unseated status)
   */
  updateTemplate(template: GameTemplate): Promise<ActionResult>;

  /**
   * Start night
   */
  startNight(): Promise<ActionResult>;

  /**
   * Restart game
   */
  restartGame(): Promise<ActionResult>;

  // === Debug Mode ===
  /**
   * Fill with bots (Debug-only, Host-only)
   * Creates bot players for all empty seats
   */
  fillWithBots(): Promise<ActionResult>;

  /**
   * Mark all bots as having viewed roles (Debug-only, Host-only)
   */
  markAllBotsViewed(): Promise<ActionResult>;

  /**
   * Mark all bots as having confirmed groupConfirm step (Debug-only, Host-only)
   */
  markAllBotsGroupConfirmed(): Promise<ActionResult>;

  /**
   * Unseat all (Host-only)
   * Clears all seats, only available in unseated/seated status
   */
  clearAllSeats(): Promise<ActionResult>;

  /**
   * Sync player profile to WerewolfState (any seated player)
   * Called after user changes name/avatar in Settings, broadcasts new profile to all clients.
   * Server returns NOT_SEATED when not seated, caller can silently ignore.
   */
  updatePlayerProfile(
    displayName?: string,
    avatarUrl?: string,
    avatarFrame?: string,
    seatFlair?: string,
    nameStyle?: string,
    roleRevealEffect?: string,
    seatAnimation?: string,
  ): Promise<ActionResult>;

  /**
   * Share "detailed info" to specified seats (Host-only, ended phase)
   */
  shareNightReview(allowedSeats: number[]): Promise<ActionResult>;

  // === Board Nomination (any connected player) ===
  /**
   * Submit board nomination (max one per person, later overrides earlier)
   */
  boardNominate(displayName: string, roles: RoleId[]): Promise<ActionResult>;

  /**
   * Upvote board nomination
   */
  boardUpvote(targetUserId: string): Promise<ActionResult>;

  /**
   * Withdraw board nomination (submitter only)
   */
  boardWithdraw(): Promise<ActionResult>;

  // === Player Actions ===
  /**
   * Player confirms role viewed
   */
  markViewedRole(seat: number): Promise<ActionResult>;

  /**
   * Submit night action
   */
  submitAction(
    seat: number,
    role: RoleId,
    target: number | null,
    extra?: unknown,
  ): Promise<ActionResult>;

  /**
   * Submit reveal confirmation (seer/psychic/gargoyle/wolfRobot)
   */
  submitRevealAck(): Promise<ActionResult>;

  /**
   * Submit groupConfirm ack (hypnotize confirmation "I understand")
   * @param seat - player seat number (caller must pass effectiveSeat to support debug bot takeover)
   */
  submitGroupConfirmAck(seat: number): Promise<ActionResult>;

  /**
   * Submit wolfRobot hunter status view confirmation
   * @param seat - wolfRobot seat number (caller must pass effectiveSeat to support debug bot takeover)
   */
  sendWolfRobotHunterStatusViewed(seat: number): Promise<ActionResult>;

  // === Night Flow (Host-only) ===
  /**
   * Set audio playing state
   */
  setAudioPlaying(isPlaying: boolean): Promise<ActionResult>;

  /**
   * Host: trigger server-side progression after wolf vote deadline expires
   */
  postProgression(): Promise<ActionResult>;

  // === Sync ===
  /**
   * Read latest state directly from DB (auto-heal / reconnect fallback)
   * Server-authoritative — direct SELECT from rooms, bypasses broadcast channel
   * Used by both Host and Player
   */
  fetchStateFromDB(): Promise<boolean>;

  /**
   * Whether audio was interrupted after Host rejoin
   */
  readonly wasAudioInterrupted: boolean;

  /**
   * Called after Host rejoin + user clicks "resume game".
   * Starts BGM + replays current step audio (if needed) within user gesture context.
   */
  resumeAfterRejoin(): Promise<void>;

  // === Connection ===
  /**
   * Subscribe to connection status changes
   * Delegates to RealtimeService.addStatusListener, avoiding UI layer direct dependency on RealtimeService
   * @returns unsubscribe function
   */
  addConnectionStatusListener(fn: (status: ConnectionStatus) => void): () => void;

  /**
   * Manual reconnect: called when user clicks "reconnect" button.
   * Delegates to ConnectionManager FSM to trigger MANUAL_RECONNECT event.
   */
  manualReconnect(): void;
}
