/**
 * Protocol Types - Protocol layer type definitions (single source of truth)
 *
 * Single Source of Truth for all wire protocol types.
 * Other files must import these types from here; importing from RealtimeService.ts is forbidden.
 *
 * ⚠️ This file may only contain type-only imports and type definitions; no runtime code allowed.
 */

// ⚠️ Use existing repo export paths as canonical reference
import type { DeathReason } from '../engine/DeathCalculator';
import type { GameStatus, RoleId, SchemaId } from '../models';
import type { WolfKillOverride } from '../models/roles/spec/schema.types';
import type { Team } from '../models/roles/spec/types';
import type { CurrentNightResults } from '../resolvers/types';

// =============================================================================
// Confirm Status (discriminated union, role tag)
// =============================================================================

/** Hunter/Dark Wolf King: can only activate when killed by wolf attack or exile vote */
export interface ShootConfirmStatus {
  readonly role: 'hunter' | 'darkWolfKing';
  /** true = can shoot (died by wolfKill or exile); false = cannot (poison/lover-suicide/dream/charm) */
  readonly canShoot: boolean;
}

/** Avenger: faction depends on shadow mimic target */
export interface FactionConfirmStatus {
  readonly role: 'avenger';
  /** Team.Good / Team.Evil / Team.Third */
  readonly faction: Team;
}

/** Hidden Wolf: learns wolf teammate seats */
export interface WolfTeammatesConfirmStatus {
  readonly role: 'hiddenWolf';
  /** Array of other wolves' seat numbers (excluding self) */
  readonly wolfTeammates: readonly number[];
}

/** Discriminated union (discriminant: role). */
export type ConfirmStatus = ShootConfirmStatus | FactionConfirmStatus | WolfTeammatesConfirmStatus;

// =============================================================================
// Protocol Action Record (ProtocolAction) — wire-safe, stable
// =============================================================================

/** Action record for wire transmission */
export interface ProtocolAction {
  readonly schemaId: SchemaId;
  readonly actorSeat: number;
  /** Target seat number; undefined = no-target action (e.g. witch "no potion") */
  readonly targetSeat?: number;
  /** Submission timestamp (epoch ms) */
  readonly timestamp: number;
}

// =============================================================================
// Audio Effects (AudioEffect) — produced by server-side inline progression
// =============================================================================

/**
 * Audio effect descriptor
 *
 * Produced during server-side inline progression, written to `GameStatePayload.pendingAudioEffects`.
 * Host device consumes queue to play audio; cleared via POST `/game/night/audio-ack` after playback.
 * Non-Host devices ignore this.
 */
export interface AudioEffect {
  /** Audio resource key (role ID / 'night' / 'night_end') */
  readonly audioKey: string;
  /** Whether this is end audio (true -> audio_end directory) */
  readonly isEndAudio?: boolean;
}

// =============================================================================
// Player — wire protocol
// =============================================================================

export interface Player {
  userId: string;
  seat: number;
  role?: RoleId | null;
  /** Whether this player has viewed their assigned role; set to false after assignRoles, true after viewRole.
   *  Host can only startNight after all players have hasViewedRole=true. */
  hasViewedRole: boolean;
  /** true = bot placeholder (debug mode); affects: skip reveal ack, groupConfirm, XP settlement */
  isBot?: boolean;
}

// =============================================================================
// RosterEntry — display fields, separated from game logic
// =============================================================================

/**
 * RosterEntry — player display info within a room (nickname / avatar / level).
 *
 * Separated from Player (game logic fields):
 * - Player: userId / seat / role / hasViewedRole / isBot
 * - RosterEntry: displayName / avatarUrl / avatarFrame / level
 *
 * keyed by userId in GameStatePayload.roster.
 */
export interface RosterEntry {
  displayName: string;
  avatarUrl?: string;
  avatarFrame?: string;
  /** Equipped seat flair gacha item ID */
  seatFlair?: string;
  /** Equipped seat animation gacha item ID */
  seatAnimation?: string;
  /** Equipped name style gacha item ID */
  nameStyle?: string;
  /** Equipped role reveal effect gacha item ID */
  roleRevealEffect?: string;
  level?: number;
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
// GameState — single authoritative state type
// =============================================================================

export interface GameState {
  // --- Core fields (existing) ---
  roomCode: string;
  hostUserId: string;
  status: GameStatus;
  templateRoles: RoleId[];
  /** Plague mode: all wolf-faction roles replaced with villager during dealing */
  isPlagueMode?: boolean;

  // ⚠️ Phase 1: players remains Record<number, ...> unchanged, consistent with existing implementation
  players: Record<number, Player | null>;

  /**
   * Player display info (RosterEntry), keyed by userId.
   * Display fields (displayName / avatarUrl / avatarFrame / level) separated from Player.
   * Written on join, removed on leave, updated on updateProfile.
   */
  roster: Record<string, RosterEntry>;

  /**
   * Current night step index.
   * -1 = night not started (Setup phase); >= 0 = nightSteps array index.
   * Only meaningful when status=Ongoing.
   */
  currentStepIndex: number;
  isAudioPlaying: boolean;

  /**
   * Random seed for role reveal animation (used for random parsing + speech order RNG)
   * Generated by Host on room creation / game restart
   * seed = roomCode + ':' + roleRevealRandomNonce
   */
  roleRevealRandomNonce?: string;

  /** Current night step ID (from NIGHT_STEPS table-driven single source) */
  currentStepId?: SchemaId;

  // --- Seat-map fields ---
  // NOTE: single source of truth for wolf vote is:
  // currentNightResults.wolfVotesBySeat

  // --- Execution state ---
  /** Night-1 action records (normalizeState guarantees non-undefined). Cleared on endNight. */
  actions: ProtocolAction[];

  /** Current night accumulated results (type-only from resolver types, single source of truth) */
  currentNightResults?: CurrentNightResults;

  /** Pending reveal ack userId[] (normalizeState guarantees non-undefined). Cleared and progresses after all ack. */
  pendingRevealAcks: string[];

  /** Previous night death seats[]; undefined before night-1. Computed by deathResolution on endNight. */
  lastNightDeaths?: number[];

  /** Previous night death reasons (seat -> cause) */
  deathReasons?: Readonly<Record<number, DeathReason>>;

  // --- Nightmare blocking ---
  /** Seat blocked by nightmare; cannot act this night (resolver returns skip). Valid for current night only. */
  nightmareBlockedSeat?: number;

  /**
   * Self-contained wolf kill override (nightmare / poisoner).
   * Presence means wolf kill is disabled; ui field provides all display text.
   */
  wolfKillOverride?: WolfKillOverride;

  // --- Wolf Robot disguise context ---
  /**
   * Wolf Robot disguise context (for identity resolution in "check-type" resolvers)
   *
   * Purpose: computation context for server-only resolvers/engine, used by unified
   * `resolveRoleForChecks()`: when a seat's effective identity is wolfRobot, interprets it
   * as `disguisedRole`, affecting seer/psychic/gargoyle check results.
   *
   * Notes:
   * - Part of GameStatePayload (publicly broadcast), but UI generally doesn't depend on it;
   *   UI only renders from schema + GameStatePayload, filtered by myRole.
   * - Maintaining parallel "disguised identity" state outside engine is forbidden to avoid server/client drift.
   */
  wolfRobotContext?: {
    /** The seat wolfRobot learned from */
    learnedSeat: number;
    /** The role wolfRobot is disguised as (learned target's role) */
    disguisedRole: RoleId;
  };

  // --- Role-specific context (all public, UI filters by myRole) ---
  /** Witch turn context - only display to witch via UI filter */
  witchContext?: {
    killedSeat: number;
    canSave: boolean;
    canPoison: boolean;
  };

  /** Seer reveal result - only display to seer via UI filter */
  seerReveal?: {
    targetSeat: number;
    result: '好人' | '狼人';
  };

  /** MirrorSeer reveal result - only display to mirrorSeer via UI filter (inverted) */
  mirrorSeerReveal?: {
    targetSeat: number;
    result: '好人' | '狼人';
  };

  /** DrunkSeer reveal result - only display to drunkSeer via UI filter (random) */
  drunkSeerReveal?: {
    targetSeat: number;
    result: '好人' | '狼人';
  };

  /** Psychic reveal result - only display to psychic via UI filter */
  psychicReveal?: {
    targetSeat: number;
    result: string;
  };

  /** Gargoyle reveal result - only display to gargoyle via UI filter */
  gargoyleReveal?: {
    targetSeat: number;
    result: string;
  };

  /** PureWhite reveal result - only display to pureWhite via UI filter */
  pureWhiteReveal?: {
    targetSeat: number;
    result: string;
  };

  /** WolfWitch reveal result - only display to wolfWitch via UI filter */
  wolfWitchReveal?: {
    targetSeat: number;
    result: string;
  };

  /**
   * Wolf Robot learn result (publicly broadcast "factual result")
   *
   * Purpose: describes wolfRobot's computation result in the wolfRobotLearn step (who/what was learned).
   * This is the single source of truth: server writes and broadcasts after executing resolver.
   *
   * UI: all clients receive it but must filter by myRole, showing only to wolfRobot (or Host UI).
   */
  wolfRobotReveal?: {
    targetSeat: number;
    result: string;
    /**
     * The learned role ID (strict RoleId) - REQUIRED for hunter gate check and disguise.
     * This is never optional when wolfRobotReveal exists.
     */
    learnedRoleId: RoleId;
    /** When learned hunter, whether wolfRobot can shoot as hunter */
    canShootAsHunter?: boolean;
  };

  /**
   * Gate (flow precondition): after wolfRobot learns hunter, must "view status" before night can progress
   *
   * Purpose: this is a server-authoritative flow gate.
   * - Server writes: set to false when `wolfRobotReveal.learnedRoleId === 'hunter'` (requires viewing).
   * - Server clears: set to true after receiving player confirmation `WOLF_ROBOT_HUNTER_STATUS_VIEWED`.
   * - NightFlow: if gate not cleared, server must refuse to progress (prevents authority split).
   * - UI: renders bottom buttons solely from schema + GameStatePayload, no local state machine derivation allowed.
   */
  wolfRobotHunterStatusViewed?: boolean;

  /**
   * Confirm status (discriminated by role).
   *
   * - hunter / darkWolfKing -> ShootConfirmStatus (canShoot: can only activate when killed by wolf attack or exile)
   * - avenger -> FactionConfirmStatus (faction: good/wolf/bound)
   *
   * Only display to that role via UI filter.
   */
  confirmStatus?: ConfirmStatus;

  /** Action rejected feedback - only display to the rejected player via UI filter */
  actionRejected?: {
    action: string;
    reason: string;
    targetUserId: string;
    /** Unique id for this rejection event (UI uses it for dedupe). */
    rejectionId: string;
  };

  // --- Step progression deadline ---
  /**
   * Current step progression deadline (epoch ms).
   *
   * Unified deadline-gate: inlineProgression allows advance after expiry.
   * Usage:
   * - wolfKill step: set (now + WOLF_VOTE_COUNTDOWN_MS) after all votes, cleared on change/retract
   * - Empty deck step: set (now + random(5000, 10000)) on entry
   *
   * Lifecycle:
   * - Set: internal engine (wolf vote post-action / unchosen step entry)
   * - Check: evaluateProgression (inlineProgression.ts)
   * - Clear: ADVANCE_TO_NEXT_ACTION reducer
   */
  stepDeadline?: number;

  // --- Pending audio queue (produced by server-side inline progression) ---
  /**
   * Pending audio list written during server-side progression.
   *
   * Host device consumes and plays in order, cleared via POST `/game/night/audio-ack` after playback.
   * Non-Host devices ignore this.
   *
   * Lifecycle:
   * - Write: extracted from sideEffects during server-side inline progression (action -> advance/endNight)
   * - Consume: Host device watches state changes -> detects non-empty -> plays -> POST ack clears
   * - Clear: `/game/night/audio-ack` empties array + sets isAudioPlaying=false
   */
  pendingAudioEffects?: AudioEffect[];

  // --- UI Hints (server broadcast driven, UI read-only display) ---
  /**
   * UI hint for current step - Server writes, UI reads only (no derivation).
   *
   * Purpose: allows Host to broadcast "early hints" to specific roles (e.g. blocked/attack disabled).
   * Host writes after resolver/handler determination, cleared on next step entry or block release.
   *
   * UI rules:
   * - targetRoleIds determines "who can see" this hint (UI filters by myRole)
   * - bottomAction === 'skipOnly' -> bottom only shows skip
   * - bottomAction === 'wolfEmptyOnly' -> bottom only shows abandon attack
   * - promptOverride present -> replaces actionPrompt text
   * - message used for banner/prompt/button text
   */
  ui?: {
    currentActorHint?: {
      kind:
        | 'blocked_by_nightmare'
        | 'wolf_kill_disabled'
        | 'wolf_unanimity_required'
        | 'wolf_tie_random';
      /**
       * Which roles can see this hint (UI filters by myRole)
       * - blocked_by_nightmare: [roleId of blocked role]
       * - wolf_kill_disabled: all wolf roles (wolf, darkWolfKing, wolfRobot, wolfQueen, etc.)
       */
      targetRoleIds: RoleId[];
      message: string;
      bottomAction?: 'skipOnly' | 'wolfEmptyOnly';
      promptOverride?: { title?: string; text?: string };
    } | null;
  };

  // --- Debug mode ---
  /**
   * Debug mode settings (optional, for development/testing only).
   * When debugMode.botsEnabled is true, bot-related UI and features are enabled.
   */
  debugMode?: {
    /** Whether bot placeholder mode is enabled */
    botsEnabled: boolean;
  };

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
  /**
   * List of hypnotized seats (Night-1 only).
   * Written by server after piperHypnotize resolver executes.
   * UI in piperHypnotizedReveal step filters by mySeat, showing hypnotized/not-hypnotized info.
   * Initialized as `[]`, server guarantees non-undefined.
   */
  hypnotizedSeats: readonly number[];

  /**
   * List of seats that have acknowledged (ack) in piperHypnotizedReveal step.
   * Server progresses to next step after all alive players ack.
   * Reset to empty on next night entry.
   * Initialized as `[]`, server guarantees non-undefined.
   */
  piperRevealAcks: readonly number[];

  // --- Awakened Gargoyle ---
  /**
   * Converted seat (Night-1 only).
   * Written by server after awakenedGargoyleConvert resolver executes.
   * UI in awakenedGargoyleConvertReveal step filters by mySeat, showing converted/not-converted info.
   */
  convertedSeat?: number;

  /**
   * List of seats that have acknowledged (ack) in awakenedGargoyleConvertReveal step.
   * Server progresses to next step after all alive players ack.
   * Reset to empty on next night entry.
   * Initialized as `[]`, server guarantees non-undefined.
   */
  conversionRevealAcks: readonly number[];

  // --- Treasure Master ---
  /**
   * Deck cards (3 identity cards), split from 15 template roles during dealing.
   * Only exists when Treasure Master is present. Unchanged after dealing.
   */
  bottomCards?: readonly RoleId[];

  /**
   * Treasure Master seat number.
   * Written during dealing, used for resolver actor routing and check disguise.
   */
  treasureMasterSeat?: number;

  /**
   * Identity chosen by Treasure Master from deck.
   * Written by treasureMasterChoose resolver.
   * Returns this identity when checking treasureMasterSeat.
   */
  treasureMasterChosenCard?: RoleId;

  /**
   * Treasure Master's dynamic faction after card selection.
   * Determined by deck composition (contains wolf->Wolf, >=2 god->Good, >=2 villager->Good).
   * Used when checking treasureMasterSeat's team.
   */
  effectiveTeam?: Team;

  /**
   * List of deck roles with night steps that were not chosen by Treasure Master.
   * These roles' steps remain in nightPlan but no one operates them (auto-skip).
   * Written by handleStartNight / treasureMasterChoose resolver.
   */
  bottomCardStepRoles?: readonly RoleId[];

  // --- Thief ---
  /**
   * Thief seat number.
   * Written during dealing, used for resolver actor routing and check disguise.
   */
  thiefSeat?: number;

  /**
   * Identity chosen by Thief from deck.
   * Written by thiefChoose resolver.
   * Returns this identity when checking thiefSeat.
   */
  thiefChosenCard?: RoleId;

  // --- Cupid ---
  /**
   * Lover seat pair (sorted ascending).
   * Written by cupidChooseLovers resolver.
   */
  loverSeats?: readonly [number, number];

  /**
   * Cupid seat number.
   * Written during dealing.
   */
  cupidSeat?: number;

  /**
   * List of seats that have acknowledged (ack) in cupidLoversReveal step.
   * Server progresses to next step after all alive players ack.
   * Initialized as `[]`, server guarantees non-undefined.
   */
  cupidLoversRevealAcks: readonly number[];

  // --- Board Nomination ---
  /**
   * Board nomination list (userId -> BoardNomination).
   * Any connected player can submit, max one per person (later submissions override).
   * Host can adopt a nomination (triggers UPDATE_TEMPLATE).
   * Cleared on UPDATE_TEMPLATE / RESTART_GAME.
   */
  boardNominations?: Readonly<Record<string, BoardNomination>>;
}

// =============================================================================
// Player Message (PlayerMessage) — integration test only
// =============================================================================

/**
 * Integration test only — message type simulating player->server intents
 *
 * In production, players submit actions via HTTP API; this type is not used.
 * Retained for board integration tests (hostGameContext / hostGameFactory).
 */
export type PlayerMessage =
  | { type: 'REQUEST_STATE'; userId: string }
  | { type: 'JOIN'; seat: number; userId: string; displayName: string; avatarUrl?: string }
  | { type: 'LEAVE'; seat: number; userId: string }
  | { type: 'ACTION'; seat: number; role: RoleId; target: number | null; extra?: unknown }
  | { type: 'WOLF_VOTE'; seat: number; target: number }
  | { type: 'VIEWED_ROLE'; seat: number }
  | { type: 'REVEAL_ACK'; seat: number; role: RoleId; revision: number }
  | { type: 'SNAPSHOT_REQUEST'; requestId: string; userId: string; lastRevision?: number }
  /** WolfRobot learned hunter: player viewed status, Host clears gate */
  | { type: 'WOLF_ROBOT_HUNTER_STATUS_VIEWED'; seat: number };
