/**
 * Protocol Types - Protocol layer type definitions (single source of truth)
 *
 * Single Source of Truth for all wire protocol types.
 * Other files must import these types from here; importing from RealtimeService.ts is forbidden.
 *
 * ⚠️ This file may only contain type-only imports and type definitions; no runtime code allowed.
 */

// ⚠️ Use existing repo export paths as canonical reference
import type { AudioEffect } from '../../../../platform/audio';
import type { WerewolfGameType } from '../../../../platform/protocol/gameTypes';
import type { BaseGameState } from '../../../../platform/protocol/roomSnapshot';
import type { RoomSeatProfile } from '../../../../platform/room/roster';
import type { RosterMap, SeatOccupant } from '../../../../platform/room/seating';
import type { DeathReason } from '../../roles/deathEffects';
import type { WerewolfNightState } from '../../roles/nightState';
import type { GameRuleOverrides, GameStatus, RoleId } from '../models';

/** Seed Wolf's final infection outcome, decided before the final group-confirm step. */
export type SeedWolfInfectionResult =
  | { readonly outcome: 'notUsed' }
  | { readonly outcome: 'failed'; readonly targetSeat: number }
  | { readonly outcome: 'converted'; readonly targetSeat: number };

// =============================================================================
// Player — wire protocol
// =============================================================================

export interface Player {
  seat: number;
  role?: RoleId | null;
}

/** A human occupant of a seat in the unified roster (identity axis). */
export interface WerewolfHumanSeat extends SeatOccupant {
  readonly userId: string;
  readonly profile: RoomSeatProfile;
}

// =============================================================================
// Board Nomination
// =============================================================================

/**
 * Board Nomination — any connected player can submit.
 * Max one per person (keyed by userId, later submissions override earlier ones).
 */
export interface BoardNomination {
  /** Submitter userId (redundantly stored for UI rendering) */
  readonly userId: string;
  /** Submitter display name */
  readonly displayName: string;
  /** Suggested role configuration */
  readonly roles: readonly RoleId[];
  /** List of userIds who upvoted */
  readonly upvoters: readonly string[];
}

// =============================================================================
// First-day sheriff election
// =============================================================================

/** Immutable result of one closed sheriff-election voting round. */
export interface SheriffElectionRoundResult {
  readonly round: 'first' | 'runoff';
  readonly candidateSeats: readonly number[];
  readonly eligibleVoterSeats: readonly number[];
  readonly ballots: Readonly<Record<number, number | null>>;
  readonly voteCounts: Readonly<Record<number, number>>;
  readonly abstainingSeats: readonly number[];
}

interface SheriffElectionCommonState {
  /** Every seat that registered, kept in registration order even after withdrawal. */
  readonly registeredSeats: readonly number[];
  /** Seats that withdrew, kept in withdrawal order for the public election record. */
  readonly withdrawnSeats: readonly number[];
  /** Closed rounds only. Active-round ballots are not a published result. */
  readonly completedRounds: readonly SheriffElectionRoundResult[];
}

/** Physical table direction followed by sheriff candidates while speaking. */
export type SheriffSpeakingDirection = 'clockwise' | 'counterclockwise';

/** Server-authoritative active sheriff-election phase. */
export type SheriffElectionState = SheriffElectionCommonState &
  (
    | { readonly phase: 'registration' }
    | {
        readonly phase: 'candidateSpeech';
        readonly speakingStartSeat: number;
        readonly speakingDirection: SheriffSpeakingDirection;
      }
    | {
        readonly phase: 'firstVote';
        readonly candidateSeats: readonly number[];
        readonly eligibleVoterSeats: readonly number[];
        readonly ballots: Readonly<Record<number, number | null>>;
        /**
         * Settle-countdown deadline (epoch ms), armed once every
         * eligible ballot is in; the round closes on expiry. Absent
         * while the round is still collecting ballots.
         */
        readonly deadline?: number;
      }
    | {
        readonly phase: 'runoffSpeech';
        readonly candidateSeats: readonly number[];
        readonly speakingStartSeat: number;
        readonly speakingDirection: SheriffSpeakingDirection;
      }
    | {
        readonly phase: 'runoffVote';
        readonly candidateSeats: readonly number[];
        readonly eligibleVoterSeats: readonly number[];
        readonly ballots: Readonly<Record<number, number | null>>;
        /** Settle-countdown deadline (epoch ms); see the firstVote variant. */
        readonly deadline?: number;
      }
    | {
        readonly phase: 'result';
        readonly deadline: number;
        readonly next:
          | { readonly kind: 'final'; readonly result: SheriffElectionResult }
          | {
              readonly kind: 'runoff';
              readonly candidateSeats: readonly number[];
              readonly speakingStartSeat: number;
              readonly speakingDirection: SheriffSpeakingDirection;
            };
      }
    | { readonly phase: 'completed' }
  );

/** Final sheriff-election outcome retained with the ended game snapshot. */
export type SheriffElectionResult =
  | { readonly kind: 'elected'; readonly sheriffSeat: number }
  | {
      readonly kind: 'noSheriff';
      readonly reason: 'noCandidates' | 'noVotes' | 'runoffTie' | 'selfDestruct';
    };

// =============================================================================
// GameState — single authoritative state type
// =============================================================================

/**
 * How the wolf team's votes resolved for one night. The targetSeat
 * variants always name the settled kill target; splitTied and
 * allAbstain carry no target because they settle to no kill.
 */
export type ResolvedWolfKillVerdict =
  | { readonly type: 'sharedTarget'; readonly targetSeat: number }
  | { readonly type: 'splitKilled'; readonly targetSeat: number }
  | { readonly type: 'tiePicked'; readonly targetSeat: number }
  | { readonly type: 'splitTied' }
  | { readonly type: 'allAbstain' };

export interface GameState extends BaseGameState<WerewolfGameType> {
  // --- Core fields (existing) ---
  roomCode: string;
  hostUserId: string;
  status: GameStatus;
  templateRoles: RoleId[];
  /** Game rule overrides (plague mode, witch self-heal, etc.) */
  rules?: GameRuleOverrides;

  // Numeric seat index -> per-seat game data (role).
  // Occupancy and identity live in `roster`; the two maps are seat-aligned:
  // a seat has game data exactly when it has an occupant.
  players: Record<number, Player | null>;

  /**
   * Seats that have viewed their assigned role (Identity Viewing
   * Protocol record, the platform stored-set shape). Cleared when roles
   * are (re)assigned; the host can only startNight once every seated
   * player is in this set.
   */
  roleViewedSeats: readonly number[];

  /**
   * Seat occupancy (unified roster): seat -> human occupant or bot marker.
   * "Who is a bot" is read from here, never from the player record.
   */
  roster: RosterMap<WerewolfHumanSeat>;

  /** Immutable human participants captured at night start, retained through departures. */
  startingParticipants?: readonly { readonly userId: string; readonly seat: number }[];
  mvpUserId?: string;

  /** Spec-driven night state, retained after settlement for the report. */
  nightState: WerewolfNightState | null;
  isAudioPlaying: boolean;
  /** Id of the most recently queued audio batch (shared slice in `platform/audio`); 0 before the first. */
  audioBatchId: number;
  /**
   * Ordinal of the current game in this room: 0 for the first deal,
   * +1 on every RESTART_GAME. Pins scheduled settle.due effects to
   * the game that armed them (a late delivery for a previous game can
   * never settle the current one).
   */
  gameSequence: number;

  /**
   * Random seed for role reveal animation (used for random parsing + speech order RNG)
   * Generated by Host on room creation / game restart
   * seed = roomCode + ':' + roleRevealRandomNonce
   */
  roleRevealRandomNonce?: string;

  // --- Night outcome ---

  /** Previous night death seats[]; undefined before night-1. Computed by deathResolution on endNight. */
  lastNightDeaths?: number[];

  /** The host acknowledged last-night information for this game. */
  lastNightInfoConfirmed?: boolean;
  /** Users who have closed the full terminal review in this game. */
  reviewCompletedUserIds?: readonly string[];

  /** Previous night death reasons (seat -> cause) */
  deathReasons?: Readonly<Record<number, DeathReason>>;

  /** Optional first-day sheriff election; present from Day entry through game end. */
  sheriffElection?: SheriffElectionState;

  /** Final sheriff election result; present only after an enabled election completes. */
  sheriffElectionResult?: SheriffElectionResult;

  // --- Nightmare blocking ---

  // --- Wolf Robot disguise context ---

  // --- Role-specific context (all public, UI filters by myRole) ---

  // --- Pending audio queue (produced by server-side inline progression) ---
  /**
   * Pending audio list written during server-side progression.
   *
   * Host device consumes and plays in order, then submits `werewolf.audio.ack`
   * naming `audioBatchId`. Non-Host devices ignore this.
   *
   * Lifecycle:
   * - Write: composed from authoritative audio-queue events during inline progression
   * - Consume: Host device watches state changes -> detects non-empty -> plays -> POST ack clears
   * - Clear: committed `werewolf.audio.ack` for the current batch empties the array and
   *   releases the audio gate
   *
   * Always present (the shared audio-queue slice in `platform/audio`);
   * an empty array means nothing is pending. Legacy persisted states
   * without the field are defaulted to `[]` at the parse/normalize
   * boundary.
   */
  pendingAudioEffects: AudioEffect[];

  // --- UI Hints (server broadcast driven, UI read-only display) ---

  /**
   * Dual seer label mapping (generated when seer + mirrorSeer coexist in template)
   *
   * Randomly assigns "Seer #1" and "Seer #2" labels; players cannot tell which is real.
   * Generated at ASSIGN_ROLES, used for audio/display name/role card.
   */
  seerLabelMap?: Readonly<Record<string, number>>;

  /**
   * Host shares "detailed info" with players at specified seats.
   * Written after Host selects seats in ended phase, cleared on restart.
   * UI rule: if effectiveSeat is in this list, show "detailed info" button.
   */
  nightReviewAllowedSeats?: readonly number[];

  // --- Piper ---

  // --- Awakened Gargoyle ---

  // --- Wolf Girl ---

  // --- Seed Wolf ---

  // --- Bottom-card actors ---
  /**
   * Physical identity cards split from templateRoles during dealing.
   * Contains three cards for treasureMaster or two cards for thief.
   */
  bottomCards?: readonly RoleId[];

  /**
   * Treasure Master seat number.
   * Written during dealing, used for resolver actor routing and check disguise.
   */
  treasureMasterSeat?: number;

  /**
   * Thief seat number.
   * Written during dealing, used for resolver actor routing and check disguise.
   */
  thiefSeat?: number;

  // --- Cupid ---

  // --- Board Nomination ---
  /**
   * Board nomination list (userId -> BoardNomination).
   * Any connected player can submit, max one per person (later submissions override).
   * Host can adopt a nomination (triggers UPDATE_TEMPLATE).
   * Cleared on UPDATE_TEMPLATE / RESTART_GAME.
   */
  boardNominations?: Readonly<Record<string, BoardNomination>>;
}
