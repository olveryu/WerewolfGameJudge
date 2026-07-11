/** Werewolf client runtime commands composed around one shared room session. */

import type { WerewolfActionInput, WerewolfPublicCommand } from '@werewolf/game-engine';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';
import type { ActionResult } from '@werewolf/game-engine/protocol/ActionResult';
import type { GameState } from '@werewolf/game-engine/protocol/types';

import type { RoomSessionClient } from '@/features/room/session/types';
import type { WerewolfUserEvent } from '@/games/werewolf/realtime/werewolfUserEventCodec';

/** Werewolf game client composed around the single shared room session. */
export interface WerewolfGameClient {
  readonly roomSession: RoomSessionClient<GameState, WerewolfPublicCommand, WerewolfUserEvent>;

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
   * Mark all bots as having viewed roles (Debug-only, Host-only)
   */
  markAllBotsViewed(): Promise<ActionResult>;

  /**
   * Mark all bots as having confirmed groupConfirm step (Debug-only, Host-only)
   */
  markAllBotsGroupConfirmed(): Promise<ActionResult>;

  /**
   * Sync player profile to GameState (any seated player)
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
  markViewedRole(controlledSeat: number | null): Promise<ActionResult>;

  /**
   * Submit night action
   */
  submitAction(input: WerewolfActionInput, controlledSeat: number | null): Promise<ActionResult>;

  /**
   * Submit reveal confirmation (seer/psychic/gargoyle/wolfRobot)
   */
  submitRevealAck(controlledSeat: number | null): Promise<ActionResult>;

  /**
   * Submit groupConfirm ack (hypnotize confirmation "I understand")
   * @param controlledSeat - bot seat controlled by Host, or null for the authenticated player
   */
  submitGroupConfirmAck(controlledSeat: number | null): Promise<ActionResult>;

  /**
   * Submit wolfRobot hunter status view confirmation
   * @param controlledSeat - bot seat controlled by Host, or null for the authenticated player
   */
  sendWolfRobotHunterStatusViewed(controlledSeat: number | null): Promise<ActionResult>;

  // === Night Flow (Host-only) ===
  /**
   * Set audio playing state
   */
  setAudioPlaying(isPlaying: boolean): Promise<ActionResult>;

  /**
   * Host: trigger server-side progression after wolf vote deadline expires
   */
  postProgression(): Promise<ActionResult>;

  /**
   * Whether audio was interrupted after Host rejoin
   */
  readonly wasAudioInterrupted: boolean;

  /**
   * Called after Host rejoin + user clicks "resume game".
   * Starts BGM + replays current step audio (if needed) within user gesture context.
   */
  resumeAfterRejoin(): Promise<void>;
}
