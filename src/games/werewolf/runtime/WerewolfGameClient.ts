/** Werewolf client runtime commands composed around one shared room session. */

import type {
  WerewolfActionInput,
  WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';
import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import type { GameTemplate } from '@game-judge/game-engine/games/werewolf/public';
import type { GameState } from '@game-judge/game-engine/games/werewolf/public';

import type { RoomCommandDispatchOutcome, RoomSessionClient } from '@/features/room/session/types';
import type { WerewolfUserEvent } from '@/games/werewolf/realtime/werewolfUserEventCodec';

export type WerewolfCommandDispatchOutcome = RoomCommandDispatchOutcome<GameState>;

/** Werewolf game client composed around the single shared room session. */
export interface WerewolfGameClient {
  readonly roomSession: RoomSessionClient<GameState, WerewolfPublicCommand, WerewolfUserEvent>;

  // === Game Control (Host-only) ===
  /**
   * Assign roles
   */
  assignRoles(): Promise<WerewolfCommandDispatchOutcome>;

  /**
   * Update template (Host only, only in unseated status)
   */
  updateTemplate(template: GameTemplate): Promise<WerewolfCommandDispatchOutcome>;

  /**
   * Start night
   */
  startNight(): Promise<WerewolfCommandDispatchOutcome>;

  /**
   * Restart game
   */
  restartGame(): Promise<WerewolfCommandDispatchOutcome>;

  // === Debug Mode ===
  /**
   * Mark all bots as having viewed roles (Debug-only, Host-only)
   */
  markAllBotsViewed(): Promise<WerewolfCommandDispatchOutcome>;

  /**
   * Mark all bots as having confirmed groupConfirm step (Debug-only, Host-only)
   */
  markAllBotsGroupConfirmed(): Promise<WerewolfCommandDispatchOutcome>;

  /**
   * Share "detailed info" to specified seats (Host-only, ended phase)
   */
  shareNightReview(allowedSeats: number[]): Promise<WerewolfCommandDispatchOutcome>;

  // === Board Nomination (any connected player) ===
  /**
   * Submit board nomination (max one per person, later overrides earlier)
   */
  boardNominate(displayName: string, roles: RoleId[]): Promise<WerewolfCommandDispatchOutcome>;

  /**
   * Upvote board nomination
   */
  boardUpvote(targetUserId: string): Promise<WerewolfCommandDispatchOutcome>;

  /**
   * Withdraw board nomination (submitter only)
   */
  boardWithdraw(): Promise<WerewolfCommandDispatchOutcome>;

  // === First-day Sheriff Election ===
  /** Register the effective seat as a sheriff candidate. */
  registerSheriffCandidate(controlledSeat: number | null): Promise<WerewolfCommandDispatchOutcome>;

  /** Cancel the effective seat's registration before registration closes. */
  cancelSheriffRegistration(controlledSeat: number | null): Promise<WerewolfCommandDispatchOutcome>;

  /** Withdraw the effective seat from the sheriff election. */
  withdrawSheriffCandidate(controlledSeat: number | null): Promise<WerewolfCommandDispatchOutcome>;

  /** Cast or replace the effective seat's ballot; null means abstain. */
  castSheriffVote(
    targetSeat: number | null,
    controlledSeat: number | null,
  ): Promise<WerewolfCommandDispatchOutcome>;

  /** Advance the sheriff election (Host only). */
  advanceSheriffElection(): Promise<WerewolfCommandDispatchOutcome>;

  /** End the sheriff election after a wolf self-destructs during candidate speeches (Host only). */
  endSheriffElectionBySelfDestruct(): Promise<WerewolfCommandDispatchOutcome>;

  // === Player Actions ===
  /**
   * Player confirms role viewed
   */
  markViewedRole(controlledSeat: number | null): Promise<WerewolfCommandDispatchOutcome>;

  /**
   * Submit night action
   */
  submitAction(
    input: WerewolfActionInput,
    controlledSeat: number | null,
  ): Promise<WerewolfCommandDispatchOutcome>;

  /**
   * Submit reveal confirmation (seer/psychic/gargoyle/wolfRobot)
   */
  submitRevealAck(controlledSeat: number | null): Promise<WerewolfCommandDispatchOutcome>;

  /**
   * Submit groupConfirm ack (hypnotize confirmation "I understand")
   * @param controlledSeat - bot seat controlled by Host, or null for the authenticated player
   */
  submitGroupConfirmAck(controlledSeat: number | null): Promise<WerewolfCommandDispatchOutcome>;

  /**
   * Submit wolfRobot hunter status view confirmation
   * @param controlledSeat - bot seat controlled by Host, or null for the authenticated player
   */
  sendWolfRobotHunterStatusViewed(
    controlledSeat: number | null,
  ): Promise<WerewolfCommandDispatchOutcome>;

  // === Night Flow (Host-only) ===
  /**
   * Host: trigger server-side progression after wolf vote deadline expires
   */
  postProgression(): Promise<WerewolfCommandDispatchOutcome>;

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
