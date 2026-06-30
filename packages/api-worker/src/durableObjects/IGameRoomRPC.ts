/**
 * IGameRoomRPC — GameRoom Durable Object public RPC method contract.
 *
 * GameRoom class must `implements IGameRoomRPC`, ensuring:
 * - Methods called by handlers exist at compile time
 * - Parameter/return types are consistent
 * - Refactoring safety (renaming/deleting methods triggers compile errors)
 *
 * @remarks All methods run in DO single-threaded context, no concurrency races.
 *   Returns `GameActionResult`: `{success:true, state, revision}` or `{success:false, reason}`.
 *   Never throws HTTPException — errors returned via result.reason, mapped to HTTP status codes by Worker handler layer.
 */

import type { UpdatePlayerProfileAction } from '@werewolf/game-engine/engine/reducer/types';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { GameRuleOverrides } from '@werewolf/game-engine/models/Template';
import type { GameState } from '@werewolf/game-engine/protocol/types';

import type { SeatActionParams } from '../schemas/game';
import type { GameActionResult } from './gameProcessor';
import type { DispatchResult } from './processEngineAction';

export interface IGameRoomRPC {
  // ── No-arg game control ─────────────────────────────────────────────────

  /**
   * Assign roles to seats.
   * @pre status === 'Setup' && seated count >= templateRoles.length
   * @pre host-only (uses state.hostUserId internally)
   */
  assignRoles(): Promise<GameActionResult>;

  /**
   * Reset game back to Setup status (preserves seats and roster).
   * @pre status === 'Ended' || status === 'Setup'
   * @pre host-only
   */
  restartGame(): Promise<GameActionResult>;

  /**
   * Clear all seats (preserves room and template).
   * @pre status === 'Setup'
   * @pre host-only
   */
  clearAllSeats(): Promise<GameActionResult>;

  /**
   * Fill all empty seats with bots (debug mode).
   * @pre status === 'Setup'
   * @pre host-only
   */
  fillWithBots(): Promise<GameActionResult>;

  /**
   * Mark all bots as having viewed roles.
   * @pre status === 'Setup' && assignRoles completed
   * @pre host-only
   */
  markAllBotsViewed(): Promise<GameActionResult>;

  /**
   * Start night flow: generate nightPlan -> set status=Ongoing -> broadcast first audio.
   * @pre status === 'Setup' && all players hasViewedRole === true
   * @pre host-only
   */
  startNight(): Promise<GameActionResult>;

  // ── Parameterized game actions ──────────────────────────────────────────

  /**
   * Seat operations: sit / leave / kick.
   * @pre status === 'Setup' (sit/leave/kick all only allowed in Setup phase)
   * @pre action='sit' -> seat must be empty, userId cannot already be in another seat
   * @pre action='kick' -> caller must be host
   */
  seat(params: SeatActionParams): Promise<GameActionResult>;

  /**
   * Submit night action.
   * @pre status === 'Ongoing'
   * @pre player role at seatNum === role
   * @pre current step of that role matches currentStepId
   * @pre same step same seat cannot resubmit (idempotent: duplicate returns rejection not error)
   */
  submitAction(
    seatNum: number,
    role: RoleId,
    target: number | null,
    extra?: unknown,
  ): Promise<GameActionResult>;

  /**
   * Mark player as having viewed their role.
   * @pre seatNum corresponding to userId is valid and has assigned role
   */
  viewRole(userId: string, seatNum: number): Promise<GameActionResult>;

  /**
   * Update template role configuration.
   * @pre status === 'Setup'
   * @pre host-only
   */
  updateTemplate(templateRoles: RoleId[], rules?: GameRuleOverrides): Promise<GameActionResult>;

  /**
   * Update player profile (nickname / avatar / decorations).
   * @pre caller userId must be in roster
   */
  updateProfile(payload: UpdatePlayerProfileAction['payload']): Promise<GameActionResult>;

  /**
   * Host shares night detail info to specified seats.
   * @pre status === 'Ended'
   * @pre host-only
   */
  shareReview(allowedSeats: number[]): Promise<GameActionResult>;

  // ── Board nomination ────────────────────────────────────────────────────

  /**
   * Submit board nomination (max one per person, later overrides).
   * @pre status === 'Setup'
   * @pre userId is in roster (any connected player can submit)
   */
  boardNominate(userId: string, displayName: string, roles: RoleId[]): Promise<GameActionResult>;

  /**
   * Upvote a nomination.
   * @pre status === 'Setup'
   * @pre targetUserId's nomination exists
   * @pre cannot vote for own nomination
   */
  boardUpvote(voterUid: string, targetUserId: string): Promise<GameActionResult>;

  /**
   * Withdraw own board nomination.
   * @pre status === 'Setup'
   * @pre userId has a submitted nomination
   */
  boardWithdraw(userId: string): Promise<GameActionResult>;

  // ── Night flow ──────────────────────────────────────────────────────────

  /**
   * Audio playback completion confirmation (called by Host).
   * @pre isAudioPlaying === true || pendingAudioEffects.length > 0
   * @remarks Triggers inlineProgression: may chain-progress multiple steps after clearing audio.
   *   If progression reaches END_NIGHT and status becomes Ended, synchronously triggers XP settlement.
   */
  audioAck(): Promise<GameActionResult>;

  /**
   * Set audio playing state (called by Host, marks start/end of playback).
   * @pre status === 'Ongoing' || status === 'Ended'
   * @pre host-only
   */
  audioGate(isPlaying: boolean): Promise<GameActionResult>;

  /**
   * Request server-side inline progression (no-op trigger).
   * @pre status === 'Ongoing'
   * @remarks Called when client detects progression should happen but has not (e.g. deadline expired).
   *   Server executes inlineProgression, may chain multiple steps.
   */
  progression(): Promise<GameActionResult>;

  /**
   * Confirm reveal info has been viewed.
   * @pre pendingRevealAcks.length > 0
   */
  revealAck(): Promise<GameActionResult>;

  /**
   * Wolf Robot "has viewed" confirmation after learning hunter.
   * @pre wolfRobotHunterStatusViewed === false
   * @pre seatNum is the wolf robot seat
   */
  wolfRobotViewed(seatNum: number): Promise<GameActionResult>;

  /**
   * Single-player ack for group confirm step (hypnotize reveal / conversion reveal / lover reveal).
   * @pre status === 'Ongoing'
   * @pre currentStepId corresponds to schema.kind === 'groupConfirm'
   * @pre seatNum is valid and player.userId === userId (or userId === hostUserId)
   * @remarks Idempotent: duplicate ack for already-acked seat returns empty success.
   */
  groupConfirmAck(seatNum: number, userId: string): Promise<GameActionResult>;

  /**
   * Batch mark all bots as having confirmed group step.
   * @pre debugMode.botsEnabled === true
   * @pre status === 'Ongoing'
   * @pre currentStepId corresponds to schema.kind === 'groupConfirm'
   */
  markBotsGroupConfirmed(): Promise<GameActionResult>;

  // ── Read-only ───────────────────────────────────────────────────────────

  /** Read current game state + revision. Returns null if room not initialized. */
  getState(): Promise<{ state: GameState; revision: number } | null>;

  /** Read current revision number only (for lightweight polling). Returns null if room not initialized. */
  getRevision(): Promise<number | null>;

  // ── Lifecycle ───────────────────────────────────────────────────────────

  /**
   * Initialize DO state (INSERT OR REPLACE).
   * @pre Called once in room/create handler only. Idempotent (repeated calls overwrite).
   */
  init(initialState: GameState): Promise<void>;

  /**
   * Initialize a room for a registered engine (fibking, …): store the engine-built blob
   * + record engine_type for dispatch routing. Generic, does not grow per game.
   */
  initState(engineType: string, blob: unknown): Promise<void>;

  /**
   * Dispatch an action to the room's engine (read-compute-write-broadcast).
   * Generic Command entry; the engine is resolved by stored engine_type.
   */
  dispatch(actionType: string, payload: unknown): Promise<DispatchResult>;

  /**
   * Clear all DO persistent storage (deleteAll).
   * @pre Called only in room/delete handler. DO instance unusable after this call.
   */
  cleanup(): Promise<void>;
}
